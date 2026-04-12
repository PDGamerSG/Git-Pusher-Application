const OpenAI = require('openai');

// Auto-detect provider from API key prefix
function getProvider(apiKey) {
  const key = (apiKey || '').trim();
  if (key.startsWith('gsk_')) {
    return {
      name: 'Groq',
      baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile'
    };
  }
  if (key.startsWith('xai-')) {
    return {
      name: 'Grok (xAI)',
      baseURL: 'https://api.x.ai/v1',
      model: 'grok-3-mini'
    };
  }
  if (key.startsWith('sk-')) {
    return {
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini'
    };
  }
  // Default: try Groq since that's what user has
  return {
    name: 'Unknown (trying Groq)',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile'
  };
}

function registerGrokHandler(ipcMain) {
  ipcMain.handle('detect-provider', async (_event, apiKey) => {
    const provider = getProvider(apiKey);
    return { provider: provider.name, model: provider.model };
  });

  ipcMain.handle('generate-commit', async (_event, { diff, featureName, apiKey }) => {
    if (!apiKey) {
      return { message: null, error: 'API key not set. Open Settings to add it.' };
    }

    const provider = getProvider(apiKey);

    try {
      const client = new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: provider.baseURL
      });

      const response = await client.chat.completions.create({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Git commit message generator. Given a short feature description and a git diff stat, return ONLY a single conventional commit message (e.g. feat: add user login page). No explanation, no quotes, just the commit message string.'
          },
          {
            role: 'user',
            content: `Feature: ${featureName}\n\nDiff stat:\n${diff}`
          }
        ],
        temperature: 0.3
      });

      const message = response.choices[0].message.content.trim();
      return { message, error: null };
    } catch (err) {
      const errorMsg = err?.error?.message || err?.message || String(err);
      return { message: null, error: `[${provider.name}] ${errorMsg}` };
    }
  });

  ipcMain.handle('test-api-key', async (_event, apiKey) => {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'API key is empty.', provider: null };
    }

    const provider = getProvider(apiKey);

    try {
      const client = new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: provider.baseURL
      });

      const response = await client.chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'user', content: 'Say "ok" and nothing else.' }
        ],
        max_tokens: 5
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (text) {
        return { success: true, error: null, provider: provider.name, model: provider.model };
      }
      return { success: false, error: 'Empty response from API.', provider: provider.name };
    } catch (err) {
      const errorMsg = err?.error?.message || err?.message || String(err);
      return { success: false, error: errorMsg, provider: provider.name };
    }
  });
}

module.exports = { registerGrokHandler };
