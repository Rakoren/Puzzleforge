/**
 * ComfyUI integration (publisher-only, local).
 *
 * Talks to a ComfyUI instance (default http://localhost:8188) to generate art
 * for covers, coloring pages, and borders. ComfyUI is never deployed publicly;
 * this is meant to run on the publisher's own machine.
 *
 * Flow: build a txt2img workflow (API format) → POST /prompt → poll /history
 * until the run finishes → fetch the image via /view → return it as a data URL.
 *
 * The model checkpoint and base URL are configurable (the user's models differ),
 * and everything degrades gracefully when ComfyUI isn't running.
 */
const crypto = require('crypto');

const BASE_URL = (process.env.COMFYUI_URL || 'http://localhost:8188').replace(/\/$/, '');
const DEFAULT_CKPT = process.env.COMFYUI_CKPT || 'v1-5-pruned-emaonly.safetensors';

// Style presets → prompt additions + a negative prompt.
const STYLES = {
  lineart: {
    add: ', black and white line art, clean bold outlines, coloring book style, white background, no shading, no color',
    negative: 'color, shading, grayscale gradients, photo, realistic, text, watermark',
  },
  silhouette: {
    add: ', solid black silhouette on a plain white background, simple bold shape',
    negative: 'color, detail, shading, photo, text, watermark',
  },
  detailed: {
    add: ', detailed illustration, intricate line work, white background',
    negative: 'photo, blurry, text, watermark',
  },
};

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Is a ComfyUI server reachable? */
async function status() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/system_stats`, {}, 3000);
    return { available: res.ok, url: BASE_URL };
  } catch (_) {
    return { available: false, url: BASE_URL };
  }
}

/** List installed checkpoints (for a model dropdown), [] if unavailable. */
async function listCheckpoints() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/object_info/CheckpointLoaderSimple`, {}, 4000);
    if (!res.ok) return [];
    const info = await res.json();
    const node = info.CheckpointLoaderSimple || Object.values(info)[0];
    const opts = node && node.input && node.input.required && node.input.required.ckpt_name;
    return Array.isArray(opts) && Array.isArray(opts[0]) ? opts[0] : [];
  } catch (_) {
    return [];
  }
}

// Canonical txt2img workflow in ComfyUI API format. Values are real numbers so
// the graph validates; node ids are stable strings.
function buildWorkflow({ prompt, negative, width, height, seed, steps, cfg, ckpt }) {
  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    5: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: 'PuzzleForge', images: ['8', 0] } },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate one image from a text prompt.
 * @param {object} opts { prompt, style, negative?, width?, height?, seed?, steps?, cfg?, ckpt?, workflow? }
 * @returns {Promise<{ dataUrl, seed }>}
 */
async function generate(opts = {}) {
  const prompt = String(opts.prompt || '').trim();
  if (!prompt) {
    const e = new Error('Enter a prompt.');
    e.status = 400;
    throw e;
  }
  const st = await status();
  if (!st.available) {
    const e = new Error(`ComfyUI is not reachable at ${BASE_URL}. Start ComfyUI (or set COMFYUI_URL).`);
    e.status = 503;
    e.code = 'NO_COMFY';
    throw e;
  }

  const style = STYLES[opts.style] || STYLES.lineart;
  const seed = opts.seed != null ? Number(opts.seed) : Math.floor(Math.random() * 1e15);
  const workflow =
    opts.workflow ||
    buildWorkflow({
      prompt: prompt + style.add,
      negative: opts.negative ? String(opts.negative) : style.negative,
      width: clampDim(opts.width, 1024),
      height: clampDim(opts.height, 1024),
      seed,
      steps: Math.max(1, Math.min(60, Number(opts.steps) || 25)),
      cfg: Math.max(1, Math.min(20, Number(opts.cfg) || 7)),
      ckpt: opts.ckpt || DEFAULT_CKPT,
    });

  const clientId = crypto.randomUUID();
  let promptId;
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/prompt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      },
      15000
    );
    const data = await res.json();
    if (!res.ok || !data.prompt_id) {
      throw new Error(comfyError(data) || 'ComfyUI rejected the workflow (check the checkpoint name).');
    }
    promptId = data.prompt_id;
  } catch (err) {
    const e = new Error(err.message || 'Could not submit the job to ComfyUI.');
    e.status = 502;
    throw e;
  }

  // Poll history until the run produces an image (or we give up).
  const deadline = Date.now() + 180000; // 3 min
  while (Date.now() < deadline) {
    await sleep(1500);
    let hist;
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/history/${promptId}`, {}, 8000);
      hist = await res.json();
    } catch (_) {
      continue;
    }
    const entry = hist && hist[promptId];
    if (!entry) continue;
    const image = firstImage(entry.outputs);
    if (image) {
      const buf = await fetchImage(image);
      return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, seed };
    }
    if (entry.status && entry.status.status_str === 'error') {
      const e = new Error('ComfyUI reported an error running the workflow.');
      e.status = 502;
      throw e;
    }
  }
  const e = new Error('Timed out waiting for ComfyUI to finish.');
  e.status = 504;
  throw e;
}

function clampDim(v, def) {
  const n = Math.round(Number(v) || def);
  if (!Number.isFinite(n)) return def;
  return Math.max(256, Math.min(2048, Math.round(n / 8) * 8)); // multiple of 8
}

function firstImage(outputs) {
  for (const nodeId of Object.keys(outputs || {})) {
    const imgs = outputs[nodeId].images;
    if (Array.isArray(imgs) && imgs.length) return imgs[0];
  }
  return null;
}

async function fetchImage({ filename, subfolder, type }) {
  const qs = new URLSearchParams({ filename, subfolder: subfolder || '', type: type || 'output' });
  const res = await fetchWithTimeout(`${BASE_URL}/view?${qs.toString()}`, {}, 15000);
  if (!res.ok) throw new Error('Could not fetch the generated image from ComfyUI.');
  return Buffer.from(await res.arrayBuffer());
}

function comfyError(data) {
  if (data && data.error) {
    const m = data.error.message || data.error;
    return typeof m === 'string' ? m : JSON.stringify(m);
  }
  return null;
}

module.exports = { status, listCheckpoints, generate, buildWorkflow, STYLES, BASE_URL };
