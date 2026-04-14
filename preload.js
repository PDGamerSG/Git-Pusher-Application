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
  },
  onTaskbarPushStarted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('taskbar-push-started', handler);
    return () => ipcRenderer.removeListener('taskbar-push-started', handler);
  },
  onTaskbarPushComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('taskbar-push-complete', handler);
    return () => ipcRenderer.removeListener('taskbar-push-complete', handler);
  },
  onTaskbarClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('taskbar-closed', handler);
    return () => ipcRenderer.removeListener('taskbar-closed', handler);
  },
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  setTaskbarDirection: (dir) => ipcRenderer.invoke('taskbar-set-direction', dir),
  onTaskbarAutoOpened: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('taskbar-auto-opened', handler);
    return () => ipcRenderer.removeListener('taskbar-auto-opened', handler);
  }
});
