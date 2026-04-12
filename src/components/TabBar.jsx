import React from 'react';

export default function TabBar({ projects, activeProjectId, onSelect, onAdd, onRemove, onSettingsOpen }) {
  return (
    <div className="flex items-center bg-[#111] border-b border-neutral-800 px-2 h-10 flex-shrink-0 no-drag">
      <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => onSelect(project.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors relative whitespace-nowrap ${
              project.id === activeProjectId
                ? 'bg-[#0a0a0a] text-white border-t border-l border-r border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              project.id === activeProjectId ? 'bg-emerald-500' : 'bg-neutral-600'
            }`} />
            <span className="truncate max-w-[120px]">{project.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(project.id); }}
              className="ml-1 opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity cursor-pointer"
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {/* Add repo button */}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors ml-1 flex-shrink-0"
      >
        <span className="text-sm">+</span>
        <span>Add Repo</span>
      </button>

      {/* Settings button */}
      <button
        onClick={onSettingsOpen}
        className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors ml-1 flex-shrink-0"
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
    </div>
  );
}
