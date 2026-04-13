import React, { useState, useRef, useEffect } from 'react';

export default function GitInitPanel({ project, onInitComplete, isWorking }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValidUrl = (url) => {
    const trimmed = url.trim();
    // Accept HTTPS or SSH git URLs
    return (
      /^https:\/\/(github|gitlab|bitbucket)\.com\/.+\/.+\.git$/.test(trimmed) ||
      /^https:\/\/(github|gitlab|bitbucket)\.com\/.+\/.+$/.test(trimmed) ||
      /^git@(github|gitlab|bitbucket)\.com:.+\/.+\.git$/.test(trimmed) ||
      /^git@(github|gitlab|bitbucket)\.com:.+\/.+$/.test(trimmed)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed) return;

    if (!isValidUrl(trimmed)) {
      setError('Enter a valid GitHub/GitLab/Bitbucket repo URL');
      return;
    }

    setError(null);
    onInitComplete(trimmed);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500">
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-white text-center mb-1">
          Initialize Repository
        </h2>
        <p className="text-[11px] text-neutral-500 text-center mb-5">
          This project isn't a git repository yet. Enter your remote URL to initialize and push.
        </p>

        {/* Project path */}
        <div className="mb-4">
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
            Project
          </label>
          <p className="text-[11px] text-neutral-400 font-mono truncate bg-black/30 px-2.5 py-1.5 rounded border border-neutral-800">
            {project.path}
          </p>
        </div>

        {/* URL input */}
        <form onSubmit={handleSubmit}>
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1.5">
            Remote Repository URL
          </label>
          <input
            ref={inputRef}
            type="text"
            value={repoUrl}
            onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
            placeholder="https://github.com/user/repo.git"
            disabled={isWorking}
            className="w-full bg-[#0a0a0a] border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-600 transition-colors font-mono disabled:opacity-40"
          />

          {error && (
            <p className="text-[11px] text-red-400 mt-1.5">{error}</p>
          )}

          {/* What will happen */}
          <div className="mt-4 bg-black/30 border border-neutral-800 rounded px-3 py-2.5">
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">
              This will run
            </p>
            <div className="space-y-0.5 font-mono text-[11px] text-neutral-400">
              <p><span className="text-neutral-600">$</span> git init</p>
              <p><span className="text-neutral-600">$</span> git remote add origin <span className="text-emerald-500/70">&lt;url&gt;</span></p>
              <p><span className="text-neutral-600">$</span> git add .</p>
              <p><span className="text-neutral-600">$</span> git commit -m "Initial Commit"</p>
              <p><span className="text-neutral-600">$</span> git branch -M main</p>
              <p><span className="text-neutral-600">$</span> git push -u origin main</p>
            </div>
          </div>

          {/* Actions */}
          <button
            type="submit"
            disabled={!repoUrl.trim() || isWorking}
            className="w-full mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          >
            {isWorking ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Initializing...
              </>
            ) : (
              <>Initialize & Push</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
