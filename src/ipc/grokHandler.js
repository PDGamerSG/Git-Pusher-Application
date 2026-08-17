const OpenAI = require('openai');

// Preferred models per provider, best first. The first id that the API key
// actually has access to wins, so a deprecated/ungranted model never hard-fails.
const PROVIDERS = [
  {
    match: (key) => key.startsWith('gsk_'),
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    models: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'groq/compound-mini',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ]
  },
  {
    match: (key) => key.startsWith('xai-'),
    name: 'Grok (xAI)',
    baseURL: 'https://api.x.ai/v1',
    models: ['grok-3-mini', 'grok-4-fast-non-reasoning', 'grok-2-1212']
  },
  {
    match: (key) => key.startsWith('sk-'),
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o']
  }
];

// Default: try Groq since that's what user has
const FALLBACK_PROVIDER = { ...PROVIDERS[0], name: 'Unknown (trying Groq)' };

// Models exposed by these APIs that cannot serve chat completions.
const NON_CHAT = /whisper|tts|embed|moderation|guard|playai|orpheus|canopylabs|rerank|image|dall-e/i;

// Reasoning models need room to think before they emit any answer. A tight
// budget spends every token on reasoning and returns empty content, and a
// merely small one truncates mid-thought. Commit messages are one line, so the
// ceiling only ever costs us on models that think out loud.
const MAX_TOKENS = 1024;

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]*\))?!?:\s?.+/i;

// Cache resolved model per API key + provider, for this process only.
const modelCache = new Map();

function getProvider(apiKey) {
  const key = (apiKey || '').trim();
  const provider = PROVIDERS.find((p) => p.match(key));
  return provider || FALLBACK_PROVIDER;
}

function makeClient(apiKey, provider) {
  return new OpenAI({ apiKey: apiKey.trim(), baseURL: provider.baseURL });
}

function isModelError(err) {
  const status = err?.status ?? err?.error?.status;
  const code = err?.code || err?.error?.code || '';
  const message = err?.error?.message || err?.message || '';
  if (code === 'model_not_found' || code === 'model_decommissioned') return true;
  if (status === 404 && /model/i.test(message)) return true;
  return /does not exist|has been decommissioned|no longer supported/i.test(message);
}

/**
 * Ask the provider which models this key can use, and pick the best available
 * from our preference list. Falls back to the preference list unchanged when
 * the listing call is unavailable.
 */
async function resolveModels(client, provider, apiKey) {
  const cacheKey = `${provider.baseURL}|${apiKey.trim().slice(-8)}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  let candidates = provider.models;
  try {
    const list = await client.models.list();
    const available = (list?.data || [])
      .map((m) => m.id)
      .filter((id) => id && !NON_CHAT.test(id));

    if (available.length) {
      const preferred = provider.models.filter((id) => available.includes(id));
      // Anything the key can use, preferred models first, as a last resort.
      const rest = available.filter((id) => !preferred.includes(id));
      candidates = [...preferred, ...rest];
    }
  } catch {
    // Listing not permitted or offline: keep the static preference list.
  }

  modelCache.set(cacheKey, candidates);
  return candidates;
}

/**
 * Some models return their chain of thought inline in the message content
 * wrapped in <think> tags, and some wrap the answer in a code fence. Strip both
 * so only the answer is left.
 */
function cleanCompletion(raw) {
  if (!raw) return '';
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/```[a-z]*\n?/gi, '')
    .trim();
}

/** Reduce a completion to a single commit message line. */
function pickCommitLine(raw) {
  const lines = cleanCompletion(raw)
    .split('\n')
    .map((line) => line.trim().replace(/^["'`]|["'`]$/g, '').trim())
    .filter(Boolean);

  return lines.find((line) => CONVENTIONAL.test(line)) || lines[0] || '';
}

/**
 * Run a chat completion, walking the candidate list whenever a model turns out
 * to be missing, decommissioned, or unable to produce usable content for this
 * key. `extract` turns a response into the value we want; returning an empty
 * string moves on to the next candidate.
 */
async function chatWithFallback(client, provider, apiKey, params, extract) {
  const candidates = await resolveModels(client, provider, apiKey);
  const cacheKey = `${provider.baseURL}|${apiKey.trim().slice(-8)}`;
  let lastErr = null;

  for (const model of candidates) {
    try {
      const response = await client.chat.completions.create({
        max_tokens: MAX_TOKENS,
        ...params,
        model
      });
      const value = extract(response);
      if (value) return { value, model };
      lastErr = new Error(`Model ${model} returned no usable content.`);
    } catch (err) {
      lastErr = err;
      if (!isModelError(err)) throw err;
      modelCache.delete(cacheKey);
    }
  }

  throw lastErr || new Error('No usable model for this API key.');
}

const COMMIT_SYSTEM_PROMPT =
  'You are a Git commit message generator. Given a short feature description and a git diff stat, return ONLY a single conventional commit message (e.g. feat: add user login page). No explanation, no quotes, just the commit message string.';

/**
 * Shared commit-message generation used by both the renderer IPC handler and
 * the taskbar quick-push flow in main.js.
 */
async function generateCommitMessage({ diff, featureName, apiKey }) {
  if (!apiKey || !apiKey.trim()) {
    return { message: null, error: 'API key not set. Open Settings to add it.' };
  }

  const provider = getProvider(apiKey);

  try {
    const client = makeClient(apiKey, provider);
    const { value } = await chatWithFallback(
      client,
      provider,
      apiKey,
      {
        messages: [
          { role: 'system', content: COMMIT_SYSTEM_PROMPT },
          { role: 'user', content: `Feature: ${featureName}\n\nDiff stat:\n${diff}` }
        ],
        temperature: 0.3
      },
      (response) => pickCommitLine(response.choices[0]?.message?.content)
    );

    return { message: value, error: null };
  } catch (err) {
    const errorMsg = err?.error?.message || err?.message || String(err);
    return { message: null, error: `[${provider.name}] ${errorMsg}` };
  }
}

function registerGrokHandler(ipcMain) {
  ipcMain.handle('detect-provider', async (_event, apiKey) => {
    const provider = getProvider(apiKey);
    if (!apiKey || !apiKey.trim()) {
      return { provider: provider.name, model: provider.models[0] };
    }
    const client = makeClient(apiKey, provider);
    const candidates = await resolveModels(client, provider, apiKey);
    return { provider: provider.name, model: candidates[0] };
  });

  ipcMain.handle('generate-commit', async (_event, args) => generateCommitMessage(args));

  ipcMain.handle('test-api-key', async (_event, apiKey) => {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'API key is empty.', provider: null };
    }

    const provider = getProvider(apiKey);

    try {
      const client = makeClient(apiKey, provider);
      const { model } = await chatWithFallback(
        client,
        provider,
        apiKey,
        { messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }] },
        (response) => cleanCompletion(response.choices[0]?.message?.content)
      );

      return { success: true, error: null, provider: provider.name, model };
    } catch (err) {
      const errorMsg = err?.error?.message || err?.message || String(err);
      return { success: false, error: errorMsg, provider: provider.name };
    }
  });
}

module.exports = { registerGrokHandler, getProvider, generateCommitMessage };
