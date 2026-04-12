const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRepoStatus: (repoPath) => ipcRenderer.invoke('get-repo-status', repoPath),
  getRecentCommits: (repoPath) => ipcRenderer.invoke('get-recent-commits', repoPath),
  generateCommit: (data) => ipcRenderer.invoke('generate-commit', data),
  runPush: (data) => ipcRenderer.invoke('run-push', data),
  testApiKey: (apiKey) => ipcRenderer.invoke('test-api-key', apiKey),
  detectProvider: (apiKey) => ipcRenderer.invoke('detect-provider', apiKey),
  onTerminalOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  }
});
