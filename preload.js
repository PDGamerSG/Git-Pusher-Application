const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRepoStatus: (repoPath) => ipcRenderer.invoke('get-repo-status', repoPath),
  getRecentCommits: (repoPath) => ipcRenderer.invoke('get-recent-commits', repoPath),
  generateCommit: (data) => ipcRenderer.invoke('generate-commit', data),
  runPush: (data) => ipcRenderer.invoke('run-push', data),
  testApiKey: (apiKey) => ipcRenderer.invoke('test-api-key', apiKey),
  detectProvider: (apiKey) => ipcRenderer.invoke('detect-provider', apiKey),
  checkGitInit: (repoPath) => ipcRenderer.invoke('check-git-init', repoPath),
  initAndPush: (data) => ipcRenderer.invoke('init-and-push', data),
  toggleTaskbarWindow: () => ipcRenderer.invoke('toggle-taskbar-window'),
  syncTaskbarState: (data) => ipcRenderer.invoke('sync-taskbar-state', data),
  onTaskbarProjectChanged: (callback) => {
    const handler = (_event, projectId) => callback(projectId);
    ipcRenderer.on('taskbar-project-changed', handler);
    return () => ipcRenderer.removeListener('taskbar-project-changed', handler);
  },
  syncBandData: (data) => ipcRenderer.invoke('sync-band-data', data),
  installTaskbarBand: (data) => ipcRenderer.invoke('install-taskbar-band', data),
  onTerminalOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  }
});
