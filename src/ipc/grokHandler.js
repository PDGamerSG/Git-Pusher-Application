const OpenAI = require('openai');

function registerGrokHandler(ipcMain) {
  ipcMain.handle('generate-commit', async (_event, { diff, featureName, apiKey }) => {
    if (!apiKey) {
      return { message: null, error: 'Grok API key not set. Open Settings to add it.' };
    }

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.x.ai/v1'
      });

      const response = await client.chat.completions.create({
        model: 'grok-3-mini',
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
      return { message: null, error: err.message };
    }
  });
}

module.exports = { registerGrokHandler };
