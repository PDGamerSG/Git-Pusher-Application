import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import RepoPanel from './components/RepoPanel';
import TerminalLog from './components/TerminalLog';
import BottomBar from './components/BottomBar';
import SettingsModal from './components/SettingsModal';
import NamePrompt from './components/NamePrompt';
import GitInitPanel from './components/GitInitPanel';

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function App() {
  const [projects, setProjects] = useState(() => loadFromStorage('projects', []));
  const [activeProjectId, setActiveProjectId] = useState(() => loadFromStorage('activeProjectId', null));
  const [grokApiKey, setGrokApiKey] = useState(() => loadFromStorage('grokApiKey', ''));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState([]);
  const [isPushing, setIsPushing] = useState(false);
  const [repoStatus, setRepoStatus] = useState(null);
  const [recentCommits, setRecentCommits] = useState([]);
  const [pushHistory, setPushHistory] = useState(() => loadFromStorage('pushHistory', {}));
  const [pendingFolderPath, setPendingFolderPath] = useState(null);
  const [apiStatus, setApiStatus] = useState(() => loadFromStorage('apiStatus', 'unknown')); // 'unknown' | 'valid' | 'invalid'
  const [gitInitStatus, setGitInitStatus] = useState(null); // null | { initialized, hasRemote }
  const [isInitializing, setIsInitializing] = useState(false);
  const [taskbarOpen, setTaskbarOpen] = useState(true); // auto-opened on app start
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [taskbarDirection, setTaskbarDirection] = useState(() => loadFromStorage('taskbarDirection', 'up'));

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // Persist state
  useEffect(() => { saveToStorage('projects', projects); }, [projects]);
  useEffect(() => { saveToStorage('activeProjectId', activeProjectId); }, [activeProjectId]);
  useEffect(() => { saveToStorage('grokApiKey', grokApiKey); }, [grokApiKey]);
  useEffect(() => { saveToStorage('pushHistory', pushHistory); }, [pushHistory]);
  useEffect(() => { saveToStorage('apiStatus', apiStatus); }, [apiStatus]);
  useEffect(() => {
    if (!window.electronAPI?.syncBandData) return;
    window.electronAPI.syncBandData({
      projects,
      activeProjectId,
      grokApiKey
    }).catch((err) => {
      console.error('Failed to sync taskbar band state:', err);
    });
  }, [projects, activeProjectId, grokApiKey]);

  // Sync state to the taskbar mini-window
  useEffect(() => {
    if (!window.electronAPI?.syncTaskbarState) return;
    window.electronAPI.syncTaskbarState({
      projects,
      activeProjectId,
      grokApiKey
    }).catch(() => {});
  }, [projects, activeProjectId, grokApiKey]);

  // Listen for project switch from taskbar window
  useEffect(() => {
    if (!window.electronAPI?.onTaskbarProjectChanged) return;
    const cleanup = window.electronAPI.onTaskbarProjectChanged((projectId) => {
      setActiveProjectId(projectId);
    });
    return cleanup;
  }, []);

  // Listen for taskbar window being closed
  useEffect(() => {
    if (!window.electronAPI?.onTaskbarClosed) return;
    return window.electronAPI.onTaskbarClosed(() => {
      setTaskbarOpen(false);
    });
  }, []);

  // Listen for taskbar auto-opened on app start
  useEffect(() => {
    if (!window.electronAPI?.onTaskbarAutoOpened) return;
    return window.electronAPI.onTaskbarAutoOpened(() => {
      setTaskbarOpen(true);
    });
  }, []);

  // Persist and sync taskbar direction
  useEffect(() => { saveToStorage('taskbarDirection', taskbarDirection); }, [taskbarDirection]);
  useEffect(() => {
    if (!window.electronAPI?.setTaskbarDirection) return;
    window.electronAPI.setTaskbarDirection(taskbarDirection).catch(() => {});
  }, [taskbarDirection]);

  // Always-fresh ref so the taskbar push handler never has stale state
  const stateRef = useRef({});
  stateRef.current = { projects, activeProject, refreshStatus };

  // Taskbar push started — add 'working' entry (same as main app's addActivity)
  useEffect(() => {
    if (!window.electronAPI?.onTaskbarPushStarted) return;
    return window.electronAPI.onTaskbarPushStarted(({ repoPath, featureName }) => {
      const { projects } = stateRef.current;
      const proj = projects.find(p => p.path === repoPath);
      if (!proj) return;
      setPushHistory(prev => {
        const entry = {
          id: crypto.randomUUID(),
          message: featureName,
          status: 'working',
          time: new Date().toISOString()
        };
        const existing = prev[proj.id] || [];
        return { ...prev, [proj.id]: [entry, ...existing].slice(0, 3) };
      });
    });
  }, []);

  // Taskbar push finished — flip latest entry to completed/failed + refresh commits
  useEffect(() => {
    if (!window.electronAPI?.onTaskbarPushComplete) return;
    return window.electronAPI.onTaskbarPushComplete(({ repoPath, featureName, commitMessage, success }) => {
      const { projects, activeProject, refreshStatus } = stateRef.current;
      const proj = projects.find(p => p.path === repoPath);
      if (proj) {
        setPushHistory(prev => {
          const existing = prev[proj.id] || [];
          if (existing.length === 0) return prev;
          const updated = [...existing];
          updated[0] = {
            ...updated[0],
            message: commitMessage || featureName || updated[0].message,
            status: success ? 'completed' : 'failed',
            time: new Date().toISOString()
          };
          return { ...prev, [proj.id]: updated };
        });
      }
      if (success) {
        stateRef.current.refreshStatus();
      }
    });
  }, []);

  // Listen for terminal output from main process
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.onTerminalOutput((data) => {
      setTerminalLines(prev => [...prev, data]);
    });
    return cleanup;
  }, []);

  // Fetch repo status when active project changes
  const refreshStatus = useCallback(async () => {
    if (!activeProject || !window.electronAPI) return;
    const status = await window.electronAPI.getRepoStatus(activeProject.path);
    setRepoStatus(status);
    const commits = await window.electronAPI.getRecentCommits(activeProject.path);
    setRecentCommits(commits.commits || []);
  }, [activeProject]);

  // Check git init status when active project changes
  const checkGitInit = useCallback(async () => {
    if (!activeProject || !window.electronAPI?.checkGitInit) {
      setGitInitStatus(null);
      return;
    }
    const result = await window.electronAPI.checkGitInit(activeProject.path);
    setGitInitStatus(result);
  }, [activeProject]);

  useEffect(() => {
    checkGitInit();
  }, [checkGitInit]);

  useEffect(() => {
    if (gitInitStatus?.initialized && gitInitStatus?.hasRemote) {
      refreshStatus();
    }
  }, [gitInitStatus, refreshStatus]);

  // Auto-refresh commits every 30s so new commits appear without manual refresh
  useEffect(() => {
    if (!activeProject) return;
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [activeProject, refreshStatus]);

  // Add a push activity entry for a project
  const addActivity = (projectId, message, status) => {
    setPushHistory(prev => {
      const existing = prev[projectId] || [];
      const entry = {
        id: crypto.randomUUID(),
        message,
        status,
        time: new Date().toISOString()
      };
      // Keep last 3 activities per project
      const updated = [entry, ...existing].slice(0, 3);
      return { ...prev, [projectId]: updated };
    });
  };

  // Update the most recent activity's status
  const updateLatestActivity = (projectId, status) => {
    setPushHistory(prev => {
      const existing = prev[projectId] || [];
      if (existing.length === 0) return prev;
      const updated = [...existing];
      updated[0] = { ...updated[0], status, time: new Date().toISOString() };
      return { ...prev, [projectId]: updated };
    });
  };

  const handleAddRepo = async () => {
    if (!window.electronAPI) return;
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;
    // Open name prompt modal instead of window.prompt()
    setPendingFolderPath(folderPath);
  };

  const handleConfirmName = (name) => {
    const newProject = {
      id: crypto.randomUUID(),
      name,
      path: pendingFolderPath
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setPendingFolderPath(null);
  };

  const handleRemoveProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(projects.length > 1 ? projects.find(p => p.id !== id)?.id : null);
    }
    // Clean up push history
    setPushHistory(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handlePush = async (featureName) => {
    if (!activeProject || !window.electronAPI || isPushing) return;

    setIsPushing(true);
    setTerminalLines([]);

    // Add "working" activity
    addActivity(activeProject.id, featureName, 'working');

    try {
      // 1. Get diff stat
      setTerminalLines(prev => [...prev, '$ git diff --stat\n']);
      const diffResult = await window.electronAPI.getRepoStatus(activeProject.path);
      if (diffResult.error) {
        setTerminalLines(prev => [...prev, `Error: ${diffResult.error}\n`]);
        updateLatestActivity(activeProject.id, 'failed');
        setIsPushing(false);
        return;
      }

      const diffStat = diffResult.changedFiles.map(f => `${f.status} ${f.path}`).join('\n') || 'No changes';
      setTerminalLines(prev => [...prev, diffStat + '\n']);

      // 2. Generate commit message via Grok
      setTerminalLines(prev => [...prev, '\n⟳ Generating commit message via Grok...\n']);
      const commitResult = await window.electronAPI.generateCommit({
        diff: diffStat,
        featureName,
        apiKey: grokApiKey
      });

      if (commitResult.error) {
        setTerminalLines(prev => [...prev, `Error: ${commitResult.error}\n`]);
        updateLatestActivity(activeProject.id, 'failed');
        setIsPushing(false);
        return;
      }

      const commitMessage = commitResult.message;
      setTerminalLines(prev => [...prev, `Commit message: ${commitMessage}\n`]);

      // 3. Run add, commit, push
      const pushResult = await window.electronAPI.runPush({
        repoPath: activeProject.path,
        commitMessage
      });

      if (pushResult.success) {
        updateLatestActivity(activeProject.id, 'completed');
        await refreshStatus();
      } else {
        updateLatestActivity(activeProject.id, 'failed');
      }
    } catch (err) {
      setTerminalLines(prev => [...prev, `\nUnexpected error: ${err.message}\n`]);
      updateLatestActivity(activeProject.id, 'failed');
    } finally {
      setIsPushing(false);
    }
  };

  const handleInitAndPush = async (remoteUrl) => {
    if (!activeProject || !window.electronAPI?.initAndPush || isInitializing) return;

    setIsInitializing(true);
    setTerminalLines([]);

    addActivity(activeProject.id, 'Initialize & Push', 'working');

    try {
      const result = await window.electronAPI.initAndPush({
        repoPath: activeProject.path,
        remoteUrl
      });

      if (result.success) {
        updateLatestActivity(activeProject.id, 'completed');
        // Re-check init status — will trigger refreshStatus via effect
        await checkGitInit();
      } else {
        updateLatestActivity(activeProject.id, 'failed');
      }
    } catch (err) {
      setTerminalLines(prev => [...prev, `\nUnexpected error: ${err.message}\n`]);
      updateLatestActivity(activeProject.id, 'failed');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleTaskbar = async () => {
    if (!window.electronAPI?.toggleTaskbarWindow) return;
    const result = await window.electronAPI.toggleTaskbarWindow();
    setTaskbarOpen(result?.visible || false);
  };

  const handleToggleTaskbarDirection = () => {
    setTaskbarDirection(prev => prev === 'up' ? 'down' : 'up');
  };

  const handleToggleAlwaysOnTop = async () => {
    if (!window.electronAPI?.toggleAlwaysOnTop) return;
    const result = await window.electronAPI.toggleAlwaysOnTop();
    setAlwaysOnTop(result?.alwaysOnTop || false);
  };

  const handleInstallTaskbarBand = async () => {
    if (!window.electronAPI?.installTaskbarBand) {
      return { success: false, error: 'Taskbar integration is unavailable.' };
    }

    return window.electronAPI.installTaskbarBand({
      projects,
      activeProjectId,
      grokApiKey
    });
  };

  return (
    <div className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden">
      {/* Left sidebar */}
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={setActiveProjectId}
        onAdd={handleAddRepo}
        onRemove={handleRemoveProject}
        onSettingsOpen={() => setSettingsOpen(true)}
        pushHistory={pushHistory}
        isPushing={isPushing}
        apiStatus={apiStatus}
        taskbarOpen={taskbarOpen}
        onToggleTaskbar={handleToggleTaskbar}
        taskbarDirection={taskbarDirection}
        onToggleTaskbarDirection={handleToggleTaskbarDirection}
        alwaysOnTop={alwaysOnTop}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
      />

      {/* Right: main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeProject ? (
          gitInitStatus && (!gitInitStatus.initialized || !gitInitStatus.hasRemote) ? (
            <>
              <GitInitPanel
                project={activeProject}
                onInitComplete={handleInitAndPush}
                isWorking={isInitializing}
              />
              <TerminalLog lines={terminalLines} />
            </>
          ) : (
            <>
              <RepoPanel
                project={activeProject}
                status={repoStatus}
                commits={recentCommits}
                onRefresh={refreshStatus}
              />
              <TerminalLog lines={terminalLines} />
              <BottomBar
                onPush={handlePush}
                disabled={!activeProject || isPushing}
                isPushing={isPushing}
              />
            </>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-neutral-700">
                <path d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 11v4M10 13h4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-neutral-500 mb-1">No project selected</p>
              <p className="text-xs text-neutral-600">Add a project from the sidebar to get started</p>
            </div>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          apiKey={grokApiKey}
          apiStatus={apiStatus}
          onInstallTaskbarBand={handleInstallTaskbarBand}
          onSave={(key, isValid) => {
            setGrokApiKey(key);
            setApiStatus(isValid ? 'valid' : (key ? 'invalid' : 'unknown'));
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Name prompt modal */}
      {pendingFolderPath && (
        <NamePrompt
          folderPath={pendingFolderPath}
          onConfirm={handleConfirmName}
          onCancel={() => setPendingFolderPath(null)}
        />
      )}
    </div>
  );
}
