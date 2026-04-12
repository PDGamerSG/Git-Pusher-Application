const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { registerGitHandlers } = require('./src/ipc/gitHandlers');
const { registerGrokHandler } = require('./src/ipc/grokHandler');

let mainWindow;
const DESK_BAND_CLSID = '{A47D7A2A-1F8D-4C79-8DD9-4D9724E4C8F0}';
const DESK_BAND_NAME = 'GitPusherBand';

function normalizeBandPayload(payload = {}) {
  const incomingProjects = Array.isArray(payload.projects) ? payload.projects : [];
  const projects = incomingProjects
    .map((project) => ({
      id: String(project?.id || '').trim(),
      name: String(project?.name || '').trim(),
      path: String(project?.path || '').trim()
    }))
    .filter((project) => project.id && project.name && project.path);

  const requestedActiveProjectId = typeof payload.activeProjectId === 'string'
    ? payload.activeProjectId
    : '';

  const activeProjectId = projects.some((project) => project.id === requestedActiveProjectId)
    ? requestedActiveProjectId
    : (projects[0]?.id || '');

  return {
    projects,
    activeProjectId,
    grokApiKey: typeof payload.grokApiKey === 'string' ? payload.grokApiKey : ''
  };
}

async function writeBandSharedState(payload = {}) {
  const data = normalizeBandPayload(payload);
  const storeDir = path.join(app.getPath('appData'), 'GitPusher');
  const storePath = path.join(storeDir, 'projects.json');

  await fs.promises.mkdir(storeDir, { recursive: true });
  await fs.promises.writeFile(storePath, JSON.stringify(data, null, 2), 'utf8');

  return storePath;
}

function resolveRegAsmPath() {
  const windir = process.env.WINDIR || 'C:\\Windows';
  const regAsmPath = path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'RegAsm.exe');
  return fs.existsSync(regAsmPath) ? regAsmPath : null;
}

function resolveDeskBandDllPath() {
  const candidates = [
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Release', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Debug', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Release', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Debug', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'GitPusherBand.dll')
  ];

  return candidates.find((candidatePath) => fs.existsSync(candidatePath)) || null;
}

function runExecFile(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ stdout, stderr });
        return;
      }

      const details = (stderr || stdout || error.message || '').trim();
      reject(new Error(details || 'Unknown process error.'));
    });
  });
}

function isWindows11OrLater() {
  if (process.platform !== 'win32') return false;

  const versionParts = os.release().split('.').map((part) => Number(part));
  const major = versionParts[0] || 0;
  const build = versionParts[2] || 0;
  return major >= 10 && build >= 22000;
}

async function ensureToolbarRegistryEntries() {
  await runExecFile('reg', [
    'add',
    'HKCU\\Software\\Microsoft\\Internet Explorer\\Toolbar',
    '/v',
    DESK_BAND_CLSID,
    '/t',
    'REG_SZ',
    '/d',
    DESK_BAND_NAME,
    '/f'
  ]);

  await runExecFile('reg', [
    'add',
    'HKCU\\Software\\Microsoft\\Internet Explorer\\Toolbar\\ShellBrowser',
    '/v',
    DESK_BAND_CLSID,
    '/t',
    'REG_SZ',
    '/d',
    DESK_BAND_NAME,
    '/f'
  ]);
}

async function restartExplorerShell() {
  await runExecFile('taskkill', ['/F', '/IM', 'explorer.exe']);
  await runExecFile('cmd', ['/c', 'start', 'explorer.exe']);
}

async function installTaskbarBand(payload = {}) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Taskbar desk band is only supported on Windows.' };
  }

  if (isWindows11OrLater()) {
    return {
      success: false,
      error: 'Windows 11 taskbar does not support classic Desk Band toolbars, so this cannot be shown there.'
    };
  }

  const storePath = await writeBandSharedState(payload);
  const regAsmPath = resolveRegAsmPath();
  if (!regAsmPath) {
    return {
      success: false,
      error: 'RegAsm.exe was not found at C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\RegAsm.exe.'
    };
  }

  const deskBandDllPath = resolveDeskBandDllPath();
  if (!deskBandDllPath) {
    return {
      success: false,
      error: 'GitPusherBand.dll not found. Build GitPusherBand.sln (x64) first.'
    };
  }

  try {
    const warnings = [];

    await runExecFile(regAsmPath, [deskBandDllPath, '/codebase']);
    try {
      await ensureToolbarRegistryEntries();
    } catch (error) {
      warnings.push(`Registered COM class, but failed to write toolbar registry entry: ${error.message}`);
    }

    try {
      await restartExplorerShell();
    } catch (error) {
      warnings.push(`Registered COM class, but failed to restart Explorer automatically: ${error.message}`);
    }

    return {
      success: true,
      message: 'Taskbar band registered. Right-click taskbar → Toolbars → GitPusherBand.',
      warning: warnings.length > 0 ? warnings.join(' ') : null,
      sharedStatePath: storePath,
      dllPath: deskBandDllPath
    };
  } catch (error) {
    const details = error.message || 'Registration failed.';
    const needsAdmin = /access is denied|0x80070005/i.test(details);
    return {
      success: false,
      error: needsAdmin
        ? 'Failed to register desk band. Run Git Pusher as Administrator and try again.'
        : 'Failed to register desk band.',
      details
    };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  if (process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC: folder picker
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('sync-band-data', async (_event, payload) => {
    try {
      const storePath = await writeBandSharedState(payload);
      return { success: true, path: storePath };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to sync taskbar band data.' };
    }
  });

  ipcMain.handle('install-taskbar-band', async (_event, payload) => {
    try {
      return await installTaskbarBand(payload);
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to add taskbar band.' };
    }
  });

  // Register git and grok IPC handlers
  registerGitHandlers(ipcMain);
  registerGrokHandler(ipcMain);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
