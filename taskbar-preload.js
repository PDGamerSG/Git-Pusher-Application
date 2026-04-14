const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskbarAPI', {
  getState: () => ipcRenderer.invoke('taskbar-get-state'),
  setActiveProject: (id) => ipcRenderer.invoke('taskbar-set-active-project', id),
  push: (data) => ipcRenderer.invoke('taskbar-push', data),
  close: () => ipcRenderer.send('taskbar-close'),
  quitApp: () => ipcRenderer.send('app-quit'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('taskbar-set-ignore-mouse-events', ignore, options),
  dragStart: (data) => ipcRenderer.send('taskbar-drag-start', data),
  dragMove:  (data) => ipcRenderer.send('taskbar-drag-move', data),
  dragEnd:   ()     => ipcRenderer.send('taskbar-drag-end'),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('taskbar-state-update', handler);
    return () => ipcRenderer.removeListener('taskbar-state-update', handler);
  },
  onDirectionChanged: (callback) => {
    const handler = (_event, dir) => callback(dir);
    ipcRenderer.on('taskbar-direction-changed', handler);
    return () => ipcRenderer.removeListener('taskbar-direction-changed', handler);
  }
});
