const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { registerGitHandlers } = require('./src/ipc/gitHandlers');
const { registerGrokHandler } = require('./src/ipc/grokHandler');

let mainWindow;
let taskbarWindow = null;
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

function createTaskbarWindow() {
  if (taskbarWindow && !taskbarWindow.isDestroyed()) {
    taskbarWindow.show();
    taskbarWindow.focus();
    return;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const winWidth = 480;
  const winHeight = 264; // fixed: bar (48px) + dropdown space (200px) + padding

  taskbarWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((width - winWidth) / 2),
    y: height - winHeight - 8,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'taskbar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  taskbarWindow.loadFile(path.join(__dirname, 'dist', 'taskbar.html'));

  taskbarWindow.once('ready-to-show', () => {
    taskbarWindow.show();
  });

  taskbarWindow.on('closed', () => {
    taskbarWindow = null;
  });
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

  // Taskbar mini-window IPC
  ipcMain.handle('toggle-taskbar-window', () => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.close();
      taskbarWindow = null;
      return { visible: false };
    }
    createTaskbarWindow();
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

    try {
      // 1. Check for changes
      const git = simpleGit(repoPath);
      const status = await git.status();
      if (status.files.length === 0) {
        return { success: false, error: 'No changes to push' };
      }

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

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('taskbar-push-complete', { repoPath });
      }
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('taskbar-close', () => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.close();
    }
  });

  ipcMain.on('taskbar-set-ignore-mouse-events', (_event, ignore, options) => {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
    taskbarWindow.setIgnoreMouseEvents(ignore, options || {});
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
