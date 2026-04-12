import React, { useState, useEffect, useRef } from 'react';

export default function NamePrompt({ folderPath, onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Derive a suggested name from the folder path
  useEffect(() => {
    if (folderPath) {
      const parts = folderPath.replace(/\\/g, '/').split('/');
      const suggestion = parts[parts.length - 1] || '';
      setName(suggestion);
      // Select all text so user can easily replace
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [folderPath]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-[#151515] border border-neutral-700 rounded-lg w-[400px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Add Project</h2>
          <button
            onClick={onCancel}
            className="text-neutral-500 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4">
          {/* Show the selected path */}
          <div className="mb-4">
            <label className="block text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
              Folder
            </label>
            <p className="text-[11px] text-neutral-400 font-mono truncate bg-black/30 px-2 py-1.5 rounded border border-neutral-800">
              {folderPath}
            </p>
          </div>

          {/* Project name input */}
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-2">
            Project Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. my-app"
            className="w-full bg-[#0a0a0a] border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-600 transition-colors"
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors font-medium"
            >
              Add Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
