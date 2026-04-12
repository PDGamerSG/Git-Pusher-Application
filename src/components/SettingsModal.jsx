import React, { useState } from 'react';

export default function SettingsModal({ apiKey, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#151515] border border-neutral-700 rounded-lg w-[420px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="block text-[11px] text-neutral-400 uppercase tracking-wider font-semibold mb-2">
            Grok API Key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="xai-..."
            className="w-full bg-[#0a0a0a] border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-600 transition-colors font-mono"
          />
          <p className="text-[10px] text-neutral-600 mt-2">
            Get your API key from <span className="text-neutral-400">console.x.ai</span>. Used to generate commit messages via Grok.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(key)}
            className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
