import React from 'react';

export default function RepoPanel({ project, status, commits, onRefresh }) {
  const branch = status?.branch || '—';
  const changedFiles = status?.changedFiles || [];
  const error = status?.error;

  return (
    <div className="px-4 py-3 border-b border-neutral-800 flex-shrink-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">{project.name}</h2>
          <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-emerald-400 rounded-full font-mono">
            {branch}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-[10px] text-neutral-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-neutral-800"
        >
          Refresh
        </button>
      </div>

      {/* Path */}
      <p className="text-[11px] text-neutral-500 font-mono mb-3 truncate">{project.path}</p>

      {error && (
        <p className="text-[11px] text-red-400 mb-2">{error}</p>
      )}

      {/* Two columns: changed files + recent commits */}
      <div className="grid grid-cols-2 gap-4">
        {/* Changed files */}
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">
            Changed Files ({changedFiles.length})
          </h3>
          <div className="max-h-[100px] overflow-y-auto">
            {changedFiles.length === 0 ? (
              <p className="text-[11px] text-neutral-600 italic">Working tree clean</p>
            ) : (
              changedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <span className={`text-[10px] font-mono w-4 text-center font-bold ${
                    f.status === 'M' ? 'text-yellow-500' :
                    f.status === 'A' || f.status === '?' ? 'text-emerald-500' :
                    f.status === 'D' ? 'text-red-500' : 'text-neutral-400'
                  }`}>
                    {f.status === '?' ? 'U' : f.status}
                  </span>
                  <span className="text-[11px] text-neutral-300 font-mono truncate">{f.path}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent commits */}
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">
            Recent Commits
          </h3>
          <div className="max-h-[100px] overflow-y-auto">
            {commits.length === 0 ? (
              <p className="text-[11px] text-neutral-600 italic">No commits yet</p>
            ) : (
              commits.map((c, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">{c.hash}</span>
                  <span className="text-[11px] text-neutral-300 truncate">{c.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
