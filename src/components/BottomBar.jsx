import React, { useState } from 'react';

export default function BottomBar({ onPush, disabled, isPushing }) {
  const [feature, setFeature] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!feature.trim() || disabled) return;
    onPush(feature.trim());
    setFeature('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#111] border-t border-neutral-700 flex-shrink-0"
    >
      <label className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wide flex-shrink-0">
        Feature:
      </label>
      <input
        type="text"
        value={feature}
        onChange={(e) => setFeature(e.target.value)}
        placeholder="e.g. add user login page"
        disabled={disabled}
        className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-600 transition-colors disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || !feature.trim()}
        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-1.5 flex-shrink-0"
      >
        {isPushing ? (
          <>
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Pushing...
          </>
        ) : (
          <>Push →</>
        )}
      </button>
    </form>
  );
}
