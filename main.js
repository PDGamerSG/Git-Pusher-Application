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

function getDeskBandDllCandidates() {
  return [
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Release', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Debug', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'Release', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'Debug', 'net48', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Release', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'x64', 'Debug', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'Release', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'bin', 'Debug', 'GitPusherBand.dll'),
    path.join(__dirname, 'GitPusherBand', 'GitPusherBand.dll')
  ];
}

function resolveDeskBandDllPath() {
  return getDeskBandDllCandidates().find((candidatePath) => fs.existsSync(candidatePath)) || null;
}

function resolveMsBuildPathFromKnownLocations() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  const candidates = [
    path.join(programFiles, 'Microsoft Visual Studio', '2022', 'BuildTools', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Community', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Professional', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Enterprise', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2022', 'BuildTools', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2022', 'Community', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2022', 'Professional', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2022', 'Enterprise', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2019', 'BuildTools', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2019', 'Community', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2019', 'Professional', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'),
    path.join(programFilesX86, 'Microsoft Visual Studio', '2019', 'Enterprise', 'MSBuild', 'Current', 'Bin', 'MSBuild.exe')
  ];

  return candidates.find((candidatePath) => fs.existsSync(candidatePath)) || null;
}

function resolveVsWherePath() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const candidates = [
    path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
    path.join(programFiles, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
  ];
  return candidates.find((candidatePath) => fs.existsSync(candidatePath)) || null;
}

async function resolveMsBuildPath() {
  const knownPath = resolveMsBuildPathFromKnownLocations();
  if (knownPath) {
    return knownPath;
  }

  const vsWherePath = resolveVsWherePath();
  if (vsWherePath) {
    try {
      const { stdout } = await runExecFile(vsWherePath, [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.Component.MSBuild',
        '-find',
        'MSBuild\\**\\Bin\\MSBuild.exe'
      ]);

      const fromVsWhere = (stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && fs.existsSync(line));

      if (fromVsWhere) {
        return fromVsWhere;
      }
    } catch {
      // fallback to PATH lookup below
    }
  }

  try {
    const { stdout } = await runExecFile('where', ['msbuild']);
    const fromPath = (stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && fs.existsSync(line));
    return fromPath || null;
  } catch {
    return null;
  }
}

async function tryBuildDeskBandDll() {
  const projectPath = path.join(__dirname, 'GitPusherBand', 'GitPusherBand.csproj');
  if (!fs.existsSync(projectPath)) {
    return { success: false, error: `Project file not found: ${projectPath}` };
  }

  const msBuildPath = await resolveMsBuildPath();
  const errors = [];

  if (!msBuildPath) {
    errors.push('MSBuild.exe not found in Visual Studio installation or PATH.');
  } else {
    try {
      await runExecFile(msBuildPath, [
        projectPath,
        '/restore',
        '/t:Build',
        '/p:Configuration=Release',
        '/p:Platform=x64',
        '/p:TargetFramework=net48',
        '/nologo',
        '/verbosity:minimal'
      ]);
      return { success: true };
    } catch (error) {
      errors.push(`MSBuild failed: ${error?.message || 'Unknown error.'}`);
    }
  }

  try {
    await runExecFile('dotnet', [
      'build',
      projectPath,
      '-c',
      'Release',
      '-p:Platform=x64',
      '-p:TargetFramework=net48',
      '-v',
      'minimal'
    ]);
    return { success: true };
  } catch (error) {
    errors.push(`dotnet build failed: ${error?.message || 'Unknown error.'}`);
  }

  return {
    success: false,
    error: `${errors.join(' ')} Install Visual Studio Build Tools with MSBuild and the .NET Framework 4.8 targeting pack.`
  };
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

function getWindowsVersionInfo() {
  const versionParts = os.release().split('.').map((part) => Number(part));
  const major = versionParts[0] || 0;
  const build = versionParts[2] || 0;

  return {
    major,
    build,
    isWindows11OrLater: major >= 10 && build >= 22000
  };
}

async function detectTaskbarMode() {
  if (process.platform !== 'win32') {
    return { mode: 'unsupported' };
  }

  const versionInfo = getWindowsVersionInfo();
  if (!versionInfo.isWindows11OrLater) {
    return { mode: 'classic', source: 'os-version' };
  }

  // TrafficMonitor-style probe: modern Win11 taskbar contains this child class.
  const script = [
    '$signature = \'using System; using System.Runtime.InteropServices; public static class GitPusherTaskbarProbe { [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindow(string lpClassName, string lpWindowName); [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindowEx(System.IntPtr hWndParent, System.IntPtr hWndChildAfter, string lpszClass, string lpszWindow); }\'',
    'Add-Type -TypeDefinition $signature -Language CSharp -ErrorAction SilentlyContinue | Out-Null',
    '$taskbar = [GitPusherTaskbarProbe]::FindWindow("Shell_TrayWnd", $null)',
    'if ($taskbar -eq [System.IntPtr]::Zero) { Write-Output "unknown"; exit 0 }',
    '$bridge = [GitPusherTaskbarProbe]::FindWindowEx($taskbar, [System.IntPtr]::Zero, "Windows.UI.Composition.DesktopWindowContentBridge", $null)',
    'if ($bridge -eq [System.IntPtr]::Zero) { Write-Output "classic" } else { Write-Output "windows11" }'
  ].join('; ');

  try {
    const { stdout } = await runExecFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ]);

    const mode = (stdout || '').trim().toLowerCase();
    if (mode === 'classic' || mode === 'windows11') {
      return { mode, source: 'shell-probe' };
    }

    return {
      mode: 'unknown',
      source: 'shell-probe',
      details: `Unexpected taskbar probe output: ${mode || '<empty>'}`
    };
  } catch (error) {
    return {
      mode: 'unknown',
      source: 'shell-probe',
      details: error?.message || 'Taskbar probe failed.'
    };
  }
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

  const taskbarMode = await detectTaskbarMode();
  if (taskbarMode.mode === 'windows11') {
    return {
      success: false,
      error: 'Detected the modern Windows 11 taskbar. This desk band works only when a classic Windows 10-style taskbar is active.'
    };
  }

  const preflightWarnings = [];
  if (taskbarMode.mode === 'unknown' && taskbarMode.details) {
    preflightWarnings.push(`Could not verify taskbar mode automatically: ${taskbarMode.details}`);
  }

  const storePath = await writeBandSharedState(payload);
  const regAsmPath = resolveRegAsmPath();
  if (!regAsmPath) {
    return {
      success: false,
      error: 'RegAsm.exe was not found at C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\RegAsm.exe.'
    };
  }

  let deskBandDllPath = resolveDeskBandDllPath();
  if (!deskBandDllPath) {
    const buildResult = await tryBuildDeskBandDll();
    if (!buildResult.success) {
      return {
        success: false,
        error: `GitPusherBand.dll not found, and automatic build failed: ${buildResult.error}`,
        details: buildResult.error
      };
    }

    deskBandDllPath = resolveDeskBandDllPath();
    if (!deskBandDllPath) {
      const searchedPaths = getDeskBandDllCandidates().join(' | ');
      return {
        success: false,
        error: 'GitPusherBand.dll is still missing after build.',
        details: `Build completed, but DLL was not found in expected paths: ${searchedPaths}`
      };
    }

    preflightWarnings.push('GitPusherBand.dll was built automatically before registration.');
  }

  try {
    const warnings = [...preflightWarnings];

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
