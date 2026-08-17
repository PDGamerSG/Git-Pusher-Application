const OpenAI = require('openai');

// Preferred models per provider, best first. The first id that the API key
// actually has access to wins, so a deprecated/ungranted model never hard-fails.
const PROVIDERS = [
  {
    match: (key) => key.startsWith('gsk_'),
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'moonshotai/kimi-k2-instruct-0905',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'meta-llama/llama-4-scout-17b-16e-instruct',
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
const NON_CHAT = /whisper|tts|embed|moderation|guard|playai|rerank|image|dall-e/i;

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
 * Run a chat completion, walking the candidate list whenever a model turns out
 * to be missing or decommissioned for this key.
 */
async function chatWithFallback(client, provider, apiKey, params) {
  const candidates = await resolveModels(client, provider, apiKey);
  let lastErr = null;

  for (const model of candidates) {
    try {
      const response = await client.chat.completions.create({ ...params, model });
      return { response, model };
    } catch (err) {
      lastErr = err;
      if (!isModelError(err)) throw err;
      modelCache.delete(`${provider.baseURL}|${apiKey.trim().slice(-8)}`);
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
    const { response } = await chatWithFallback(client, provider, apiKey, {
      messages: [
        { role: 'system', content: COMMIT_SYSTEM_PROMPT },
        { role: 'user', content: `Feature: ${featureName}\n\nDiff stat:\n${diff}` }
      ],
      temperature: 0.3
    });

    const message = response.choices[0].message.content.trim();
    return { message, error: null };
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
      const { response, model } = await chatWithFallback(client, provider, apiKey, {
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
        max_tokens: 5
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (text) {
        return { success: true, error: null, provider: provider.name, model };
      }
      return { success: false, error: 'Empty response from API.', provider: provider.name };
    } catch (err) {
      const errorMsg = err?.error?.message || err?.message || String(err);
      return { success: false, error: errorMsg, provider: provider.name };
    }
  });
}

module.exports = { registerGrokHandler, getProvider, generateCommitMessage };
