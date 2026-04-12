import React, { useState, useEffect, useCallback } from 'react';
import TabBar from './components/TabBar';
import RepoPanel from './components/RepoPanel';
import TerminalLog from './components/TerminalLog';
import BottomBar from './components/BottomBar';
import SettingsModal from './components/SettingsModal';

const Store = window.electronAPI ? null : null;

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

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // Persist state
  useEffect(() => { saveToStorage('projects', projects); }, [projects]);
  useEffect(() => { saveToStorage('activeProjectId', activeProjectId); }, [activeProjectId]);
  useEffect(() => { saveToStorage('grokApiKey', grokApiKey); }, [grokApiKey]);

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

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleAddRepo = async () => {
    if (!window.electronAPI) return;
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;

    const name = prompt('Enter a short project name:');
    if (!name) return;

    const newProject = {
      id: crypto.randomUUID(),
      name: name.trim(),
      path: folderPath
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const handleRemoveProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(projects.length > 1 ? projects.find(p => p.id !== id)?.id : null);
    }
  };

  const handlePush = async (featureName) => {
    if (!activeProject || !window.electronAPI || isPushing) return;

    setIsPushing(true);
    setTerminalLines([]);

    try {
      // 1. Get diff stat
      setTerminalLines(prev => [...prev, '$ git diff --stat\n']);
      const diffResult = await window.electronAPI.getRepoStatus(activeProject.path);
      if (diffResult.error) {
        setTerminalLines(prev => [...prev, `Error: ${diffResult.error}\n`]);
        setIsPushing(false);
        return;
      }

      const diffStat = await window.electronAPI.generateCommit
        ? (await (async () => {
            const git = await window.electronAPI.getRepoStatus(activeProject.path);
            return git.changedFiles.map(f => `${f.status} ${f.path}`).join('\n') || 'No changes';
          })())
        : 'No changes';

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
        await refreshStatus();
      }
    } catch (err) {
      setTerminalLines(prev => [...prev, `\nUnexpected error: ${err.message}\n`]);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* Title bar drag region */}
      <div className="drag-region h-[38px] flex-shrink-0" />

      {/* Tab bar */}
      <TabBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={setActiveProjectId}
        onAdd={handleAddRepo}
        onRemove={handleRemoveProject}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeProject ? (
          <>
            <RepoPanel
              project={activeProject}
              status={repoStatus}
              commits={recentCommits}
              onRefresh={refreshStatus}
            />
            <TerminalLog lines={terminalLines} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-30">⌥</div>
              <p className="text-sm">Add a repo to get started</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom input bar */}
      <BottomBar
        onPush={handlePush}
        disabled={!activeProject || isPushing}
        isPushing={isPushing}
      />

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          apiKey={grokApiKey}
          onSave={(key) => { setGrokApiKey(key); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
