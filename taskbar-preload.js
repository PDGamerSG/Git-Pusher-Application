const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskbarAPI', {
  getState: () => ipcRenderer.invoke('taskbar-get-state'),
  setActiveProject: (id) => ipcRenderer.invoke('taskbar-set-active-project', id),
  push: (data) => ipcRenderer.invoke('taskbar-push', data),
  close: () => ipcRenderer.send('taskbar-close'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('taskbar-set-ignore-mouse-events', ignore, options),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('taskbar-state-update', handler);
    return () => ipcRenderer.removeListener('taskbar-state-update', handler);
  }
});
