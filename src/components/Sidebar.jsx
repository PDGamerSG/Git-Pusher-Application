import React, { useState } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusDot({ status }) {
  const colors = {
    working: 'bg-amber-400',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
    idle: 'bg-neutral-600'
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || colors.idle}`} />;
}

function StatusLabel({ status }) {
  const styles = {
    working: 'text-amber-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    idle: 'text-neutral-500'
  };
  const labels = {
    working: 'Working',
    completed: 'Completed',
    failed: 'Failed',
    idle: 'Idle'
  };
  return (
    <span className={`text-[10px] font-medium ${styles[status] || styles.idle}`}>
      {labels[status] || 'Idle'}
    </span>
  );
}

function FolderIcon({ expanded }) {
  if (expanded) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400 flex-shrink-0">
        <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.5 14.5h17l-2 5H5.5l-2-5z" fill="currentColor" opacity="0.15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400 flex-shrink-0">
      <path d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`text-neutral-500 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ProjectFolder({ project, isActive, isExpanded, onToggle, onSelect, onRemove, activity, isPushing }) {
  const projectStatus = isPushing && isActive ? 'working' : (activity.length > 0 ? activity[0].status : 'idle');

  return (
    <div className={`${isActive ? 'bg-neutral-800/30' : ''}`}>
      {/* Folder header row */}
      <div
        className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors hover:bg-neutral-800/40 ${
          isActive ? 'bg-neutral-800/50' : ''
        }`}
        onClick={() => { onSelect(project.id); onToggle(project.id); }}
      >
        <ChevronIcon expanded={isExpanded} />
        <FolderIcon expanded={isExpanded} />
        <span className={`text-[13px] font-medium truncate flex-1 ${isActive ? 'text-white' : 'text-neutral-300'}`}>
          {project.name}
        </span>

        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(project.id); }}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all text-sm leading-none p-0.5"
          title="Remove project"
        >
          ×
        </button>
      </div>

      {/* Expanded: activity items */}
      {isExpanded && (
        <div className="pb-1">
          {activity.length === 0 ? (
            <div className="flex items-center gap-2 pl-10 pr-3 py-1.5">
              <StatusDot status="idle" />
              <span className="text-[11px] text-neutral-600 italic truncate">No activity yet</span>
            </div>
          ) : (
            activity.map((item, i) => (
              <div
                key={item.id || i}
                className="flex items-start gap-2 pl-10 pr-3 py-1.5 hover:bg-neutral-800/20 transition-colors cursor-default"
              >
                <StatusDot status={item.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <StatusLabel status={item.status} />
                    <span className="text-[11px] text-neutral-400 truncate">{item.message}</span>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-600 flex-shrink-0 whitespace-nowrap">
                  {item.time ? timeAgo(item.time) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ projects, activeProjectId, onSelect, onAdd, onRemove, onSettingsOpen, pushHistory, isPushing, apiStatus }) {
  const [expandedIds, setExpandedIds] = useState(() => {
    // Expand the active project by default
    return activeProjectId ? new Set([activeProjectId]) : new Set();
  });
  const [taskbarOpen, setTaskbarOpen] = useState(false);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleTaskbar = async () => {
    if (!window.electronAPI?.toggleTaskbarWindow) return;
    try {
      const result = await window.electronAPI.toggleTaskbarWindow();
      setTaskbarOpen(result?.visible || false);
    } catch (err) {
      console.error('Failed to toggle taskbar window:', err);
    }
  };

  return (
    <div className="w-[280px] flex-shrink-0 bg-[#111111] border-r border-neutral-800 flex flex-col h-full select-none">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/60">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round"/>
            <path d="M5.636 5.636l2.121 2.121M16.243 16.243l2.121 2.121M5.636 18.364l2.121-2.121M16.243 7.757l2.121-2.121" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-bold text-white tracking-tight">Git Pusher</span>
        </div>
        <button
          onClick={onSettingsOpen}
          className="relative p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors"
          title={`Settings — API ${apiStatus === 'valid' ? 'connected' : apiStatus === 'invalid' ? 'not connected' : 'not tested'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          {/* API status dot */}
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111111] ${
            apiStatus === 'valid' ? 'bg-emerald-500' :
            apiStatus === 'invalid' ? 'bg-red-500' :
            'bg-neutral-600'
          }`} />
        </button>
      </div>

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-neutral-700 mb-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto">
                <path d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] text-neutral-600">No projects added yet</p>
          </div>
        ) : (
          projects.map(project => (
            <ProjectFolder
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isExpanded={expandedIds.has(project.id)}
              onToggle={toggleExpand}
              onSelect={onSelect}
              onRemove={onRemove}
              activity={(pushHistory[project.id] || []).slice(0, 3)}
              isPushing={isPushing}
            />
          ))
        )}
      </div>

      {/* Add project button at bottom */}
      <div className="border-t border-neutral-800/60 p-2">
        <div className="space-y-2">
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-md transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Add project</span>
          </button>

          <button
            onClick={handleToggleTaskbar}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-md transition-colors ${
              taskbarOpen
                ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="12" rx="1.5" />
              <path d="M8 20h8M12 16v4" />
            </svg>
            <span>{taskbarOpen ? 'Hide taskbar window' : 'Show taskbar window'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
