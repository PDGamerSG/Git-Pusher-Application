const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { registerGitHandlers } = require('./src/ipc/gitHandlers');
const { registerGrokHandler } = require('./src/ipc/grokHandler');

let mainWindow;
let taskbarWindow = null;
let taskbarDragOffset = null;
let mainWindowPinned = false;
let virtualDesktopWatcher = null;
let mainWindowMinimized = false;
let isQuitting = false;
let alwaysOnTopEnforcer = null;
let taskbarPrefs = { x: null, y: null };
let tray = null;

const TASKBAR_WIDTH = 340;
const TASKBAR_HEIGHT = 238;  // bar (38px) + dropdown space (200px)
const TASKBAR_BAR_HEIGHT = 38;

const DESK_BAND_CLSID = '{A47D7A2A-1F8D-4C79-8DD9-4D9724E4C8F0}';
const DESK_BAND_NAME = 'GitPusherBand';

// Cached state for the taskbar mini-window
let taskbarState = { projects: [], activeProjectId: '', grokApiKey: '' };

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

async function loadTaskbarPrefs() {
  const prefsPath = path.join(app.getPath('appData'), 'GitPusher', 'taskbar-prefs.json');
  try {
    const data = await fs.promises.readFile(prefsPath, 'utf8');
    const parsed = JSON.parse(data);
    return {
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null
    };
  } catch {
    return { x: null, y: null };
  }
}

async function saveTaskbarPrefs(prefs) {
  const dir = path.join(app.getPath('appData'), 'GitPusher');
  const prefsPath = path.join(dir, 'taskbar-prefs.json');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
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

// Uses the documented IVirtualDesktopManager COM API (stable since Win10 1607)
// to detect when the user switches virtual desktops. We watch the MAIN window's
// desktop assignment (not the taskbar overlay, which is HWND_TOPMOST and always
// reports "on current desktop"). When the main window is on a different desktop
// we hide the overlay; when it returns we show it again.
function startVirtualDesktopWatcher() {
  stopVirtualDesktopWatcher();

  if (process.platform !== 'win32') return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const hwndBuffer = mainWindow.getNativeWindowHandle();
  // HWND is pointer-sized; on 64-bit Windows the buffer is 8 bytes but the
  // actual HWND value fits in 32 bits.
  const hwnd = hwndBuffer.length >= 8
    ? Number(hwndBuffer.readBigUInt64LE(0))
    : hwndBuffer.readUInt32LE(0);

  const script = `
$sig = @'
using System;
using System.Runtime.InteropServices;
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("A5CD92FF-29BE-454C-8D04-D82879FB3F1B")]
public interface IVirtualDesktopManager {
    bool IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow);
    Guid GetWindowDesktopId(IntPtr topLevelWindow);
    void MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
}
public class VDM {
    public static IVirtualDesktopManager Create() {
        return (IVirtualDesktopManager)Activator.CreateInstance(
            Type.GetTypeFromCLSID(new Guid("AA509086-5CA9-4C25-8F95-589D3C07B48A")));
    }
}
'@
Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue
try { $vdm = [VDM]::Create() } catch { exit 1 }
$hwnd = [IntPtr]${hwnd}
while ($true) {
    try {
        $r = $vdm.IsWindowOnCurrentVirtualDesktop($hwnd)
        [Console]::WriteLine($(if ($r) { '1' } else { '0' }))
        [Console]::Out.Flush()
    } catch {
        [Console]::WriteLine('1')
        [Console]::Out.Flush()
    }
    [System.Threading.Thread]::Sleep(150)
}
`;

  const { spawn } = require('child_process');
  virtualDesktopWatcher = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-Command', script
  ], { windowsHide: true });

  let buf = '';
  virtualDesktopWatcher.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      const val = line.trim();
      if (!val) continue;
      if (!taskbarWindow || taskbarWindow.isDestroyed()) continue;
      if (val === '0') {
        // Main window is on a different virtual desktop — hide overlay
        if (taskbarWindow.isVisible()) taskbarWindow.hide();
      } else {
        // Main window is on the current desktop — ensure overlay is visible
        if (!taskbarWindow.isVisible()) showTaskbarOnTop(false);
      }
    }
  });

  virtualDesktopWatcher.on('error', () => { virtualDesktopWatcher = null; });
  virtualDesktopWatcher.on('close', () => { virtualDesktopWatcher = null; });
}

function stopVirtualDesktopWatcher() {
  if (virtualDesktopWatcher) {
    try { virtualDesktopWatcher.kill(); } catch (_) {}
    virtualDesktopWatcher = null;
  }
}

// Re-applies always-on-top every time the taskbar is shown.
// Windows drops HWND_TOPMOST after hide→show cycles and when other windows take focus.
function enforceTaskbarOnTop() {
  if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
  taskbarWindow.setAlwaysOnTop(true, 'pop-up-menu');
}

// Show taskbar window and guarantee it stays on top.
// activate=false uses showInactive (no focus steal); activate=true brings it forward.
function showTaskbarOnTop(activate) {
  if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
  if (activate) {
    taskbarWindow.show();
  } else {
    taskbarWindow.showInactive();
  }
  enforceTaskbarOnTop();
}

function startAlwaysOnTopEnforcer() {
  stopAlwaysOnTopEnforcer();
  // Periodic safety net: Windows can silently demote the Z-order when the user
  // interacts with other always-on-top windows or full-screen apps.
  alwaysOnTopEnforcer = setInterval(() => {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) {
      stopAlwaysOnTopEnforcer();
      return;
    }
    if (taskbarWindow.isVisible()) {
      enforceTaskbarOnTop();
    }
  }, 3000);
}

function stopAlwaysOnTopEnforcer() {
  if (alwaysOnTopEnforcer) {
    clearInterval(alwaysOnTopEnforcer);
    alwaysOnTopEnforcer = null;
  }
}

async function createTaskbarWindow() {
  if (taskbarWindow && !taskbarWindow.isDestroyed()) {
    showTaskbarOnTop(true);
    return;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  taskbarPrefs = await loadTaskbarPrefs();

  // Use saved position if valid, otherwise center horizontally at bottom
  const x = taskbarPrefs.x != null ? taskbarPrefs.x : Math.round((screenW - TASKBAR_WIDTH) / 2);
  const y = taskbarPrefs.y != null ? taskbarPrefs.y : screenH - TASKBAR_HEIGHT - 8;

  taskbarWindow = new BrowserWindow({
    width: TASKBAR_WIDTH,
    height: TASKBAR_HEIGHT,
    x, y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,   // HWND_TOPMOST: stays on top; the virtualDesktopWatcher
    skipTaskbar: true,   // hides it when the user is on a different virtual desktop
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'taskbar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  enforceTaskbarOnTop();

  // Re-apply always-on-top every time the window becomes visible (covers all show paths)
  taskbarWindow.on('show', () => {
    enforceTaskbarOnTop();
  });

  taskbarWindow.loadFile(path.join(__dirname, 'dist', 'taskbar.html'));

  taskbarWindow.once('ready-to-show', () => {
    showTaskbarOnTop(true);
    startAlwaysOnTopEnforcer();
    startVirtualDesktopWatcher();
  });

  taskbarWindow.on('closed', () => {
    stopAlwaysOnTopEnforcer();
    stopVirtualDesktopWatcher();
    destroyTray();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('taskbar-closed');
      // If main window was hidden to tray while taskbar was open, restore it
      // so the user isn't left with no visible window
      if (mainWindowMinimized || !mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindowMinimized = false;
      }
    }
    taskbarWindow = null;
  });
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;

  const iconCandidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(process.resourcesPath || '', 'assets', 'icon.ico')
  ];
  const iconPath = iconCandidates.find(p => fs.existsSync(p));
  const trayIcon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip('Git Pusher');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
          mainWindowMinimized = false;
        }
        destroyTray();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindowMinimized = false;
    }
    destroyTray();
  });
}

function destroyTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}

function createWindow() {
  // Resolve icon path — works both in dev and packaged app
  // In packaged app: extraResources puts assets in resources/assets/
  // In dev: assets/ is next to main.js
  const iconCandidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(process.resourcesPath || '', 'assets', 'icon.ico')
  ];
  const iconPath = iconCandidates.find(p => fs.existsSync(p));
  const iconExists = !!iconPath;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    frame: true,
    icon: iconExists ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Track minimize state — keeps taskbar overlay visible when main window is minimized
  mainWindow.on('minimize', () => {
    mainWindowMinimized = true;
    // Ensure the taskbar overlay stays visible and on top
    showTaskbarOnTop(false);
  });

  mainWindow.on('restore', () => {
    mainWindowMinimized = false;
    // Re-enforce after restore — Windows may have demoted the overlay Z-order
    enforceTaskbarOnTop();
  });

  // When main window gains focus, Windows can push the overlay behind it.
  // Re-enforce on a short delay so the focus transition completes first.
  mainWindow.on('focus', () => {
    setTimeout(enforceTaskbarOnTop, 100);
  });

  // When the taskbar overlay is active, intercept close → hide to system tray.
  // This keeps the overlay running. User can restore from tray or quit via tray menu.
  mainWindow.on('close', (e) => {
    if (!isQuitting && taskbarWindow && !taskbarWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.hide();
      mainWindowMinimized = true;
      createTray();
    }
  });

  if (process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  createWindow();

  // Auto-open the taskbar overlay on app start
  await createTaskbarWindow();
  // Notify the renderer that taskbar is open
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('taskbar-auto-opened');
  });

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

  // Taskbar mini-window IPC
  ipcMain.handle('toggle-taskbar-window', async () => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.close(); // 'closed' event handles interval cleanup + notify main
      return { visible: false };
    }
    await createTaskbarWindow();
    return { visible: true };
  });

  ipcMain.handle('taskbar-get-state', () => {
    return taskbarState;
  });

  ipcMain.handle('taskbar-set-active-project', (_event, projectId) => {
    taskbarState.activeProjectId = projectId;
    // Notify main window about the project switch
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('taskbar-project-changed', projectId);
    }
    return { success: true };
  });

  ipcMain.handle('taskbar-push', async (_event, { repoPath, featureName, apiKey }) => {
    const simpleGit = require('simple-git');
    const { spawn } = require('child_process');

    function runGit(args) {
      return new Promise((resolve, reject) => {
        const proc = spawn('git', args, { cwd: repoPath });
        let output = '';
        proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
        proc.stderr.on('data', (chunk) => { output += chunk.toString(); });
        proc.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`git ${args.join(' ')} failed: ${output}`));
        });
        proc.on('error', reject);
      });
    }

    function notifyMain(event, data) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(event, data);
      }
    }

    try {
      // 1. Check for changes
      const git = simpleGit(repoPath);
      const status = await git.status();
      if (status.files.length === 0) {
        return { success: false, error: 'No changes to push' };
      }

      // Notify main window: push starting (working state)
      notifyMain('taskbar-push-started', { repoPath, featureName });

      const diffStat = status.files.map(f => `${f.working_dir || f.index} ${f.path}`).join('\n');

      // 2. Generate commit message
      const OpenAI = require('openai');
      function getProvider(key) {
        if (key.startsWith('gsk_')) return { name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' };
        if (key.startsWith('xai-')) return { name: 'Grok (xAI)', baseURL: 'https://api.x.ai/v1', model: 'grok-3-mini' };
        if (key.startsWith('sk-')) return { name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
        return { name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' };
      }

      let commitMessage = `feat: ${featureName}`;
      if (apiKey && apiKey.trim()) {
        const provider = getProvider(apiKey.trim());
        const client = new OpenAI({ apiKey: apiKey.trim(), baseURL: provider.baseURL });
        const response = await client.chat.completions.create({
          model: provider.model,
          messages: [
            { role: 'system', content: 'You are a Git commit message generator. Given a short feature description and a git diff stat, return ONLY a single conventional commit message. No explanation, no quotes, just the commit message string.' },
            { role: 'user', content: `Feature: ${featureName}\n\nDiff stat:\n${diffStat}` }
          ],
          temperature: 0.3
        });
        commitMessage = response.choices[0].message.content.trim();
      }

      // 3. Add, commit, push
      await runGit(['add', '.']);
      await runGit(['commit', '-m', commitMessage]);

      try {
        await runGit(['push']);
      } catch (pushErr) {
        if (/no upstream branch|--set-upstream/i.test(pushErr.message)) {
          const branch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
          await runGit(['push', '--set-upstream', 'origin', branch]);
        } else {
          throw pushErr;
        }
      }

      notifyMain('taskbar-push-complete', { repoPath, featureName, commitMessage, success: true });
      return { success: true, error: null };
    } catch (err) {
      notifyMain('taskbar-push-complete', { repoPath, featureName, success: false });
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('taskbar-close', () => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.close();
    }
  });

  // Allow quitting the entire app (e.g. from taskbar overlay or when user really wants to exit)
  ipcMain.on('app-quit', () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.on('taskbar-set-ignore-mouse-events', (_event, ignore, options) => {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
    taskbarWindow.setIgnoreMouseEvents(ignore, options || {});
  });

  ipcMain.on('taskbar-drag-start', (_event, { screenX, screenY }) => {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
    const [winX, winY] = taskbarWindow.getPosition();
    const [winW, winH] = taskbarWindow.getSize();
    taskbarDragOffset = { x: screenX - winX, y: screenY - winY, w: winW, h: winH };
  });

  ipcMain.on('taskbar-drag-move', (_event, { screenX, screenY }) => {
    if (!taskbarWindow || taskbarWindow.isDestroyed() || !taskbarDragOffset) return;
    taskbarWindow.setBounds({
      x: Math.round(screenX - taskbarDragOffset.x),
      y: Math.round(screenY - taskbarDragOffset.y),
      width: taskbarDragOffset.w,
      height: taskbarDragOffset.h
    });
  });

  ipcMain.on('taskbar-drag-end', () => {
    taskbarDragOffset = null;
    // Persist position after drag
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      const [x, y] = taskbarWindow.getPosition();
      taskbarPrefs = { ...taskbarPrefs, x, y };
      saveTaskbarPrefs(taskbarPrefs).catch(() => {});
    }
  });

  // Sync state to taskbar window when main window sends updates
  ipcMain.handle('sync-taskbar-state', (_event, data) => {
    taskbarState = {
      projects: Array.isArray(data.projects) ? data.projects : [],
      activeProjectId: data.activeProjectId || '',
      grokApiKey: data.grokApiKey || ''
    };
    // Forward to taskbar window if open
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.webContents.send('taskbar-state-update', taskbarState);
    }
    return { success: true };
  });

  ipcMain.handle('taskbar-set-direction', (_event, dir) => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.webContents.send('taskbar-direction-changed', dir);
    }
    return { success: true };
  });

  ipcMain.handle('get-auto-launch', () => {
    const settings = app.getLoginItemSettings();
    return { enabled: settings.openAtLogin };
  });

  ipcMain.handle('set-auto-launch', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return { enabled };
  });

  ipcMain.handle('toggle-always-on-top', () => {
    mainWindowPinned = !mainWindowPinned;
    mainWindow.setAlwaysOnTop(mainWindowPinned, 'floating');
    return { alwaysOnTop: mainWindowPinned };
  });

  // Register git and grok IPC handlers
  registerGitHandlers(ipcMain);
  registerGrokHandler(ipcMain);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopAlwaysOnTopEnforcer();
  stopVirtualDesktopWatcher();
  destroyTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
