import React, { useState, useEffect } from 'react';

function detectProviderLocal(key) {
  if (!key) return null;
  if (key.startsWith('gsk_')) return { name: 'Groq', color: 'text-orange-400' };
  if (key.startsWith('xai-')) return { name: 'Grok (xAI)', color: 'text-blue-400' };
  if (key.startsWith('sk-')) return { name: 'OpenAI', color: 'text-green-400' };
  return { name: 'Unknown', color: 'text-neutral-400' };
}

export default function SettingsModal({ apiKey, apiStatus, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const detected = detectProviderLocal(key.trim());

  const handleTest = async () => {
    if (!key.trim() || !window.electronAPI) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.testApiKey(key.trim());
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(key.trim(), testResult?.success || false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#151515] border border-neutral-700 rounded-lg w-[440px] shadow-2xl"
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
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
              API Key
            </label>
            {/* Live provider detection badge */}
            {detected && key.trim() && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 ${detected.color}`}>
                {detected.name}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setTestResult(null); }}
              placeholder="gsk_... or xai-... or sk-..."
              className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-600 transition-colors font-mono"
            />
            <button
              onClick={handleTest}
              disabled={testing || !key.trim()}
              className="px-3 py-2 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              {testing ? (
                <>
                  <span className="w-3 h-3 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                'Test'
              )}
            </button>
          </div>

          {/* Test result feedback */}
          {testResult && (
            <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded text-xs ${
              testResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {testResult.success ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 flex-shrink-0 mt-0.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="text-emerald-400">
                    <span className="font-medium">Connected to {testResult.provider}</span>
                    <span className="block text-emerald-400/70 mt-0.5">Model: {testResult.model}</span>
                  </div>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                  </svg>
                  <div className="text-red-400">
                    <span className="font-medium">Connection failed{testResult.provider ? ` (${testResult.provider})` : ''}</span>
                    <span className="block text-red-400/70 mt-0.5">{testResult.error}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-[10px] text-neutral-600 mt-3">
            Supports <span className="text-neutral-400">Groq</span> (gsk_...), <span className="text-neutral-400">Grok/xAI</span> (xai-...), and <span className="text-neutral-400">OpenAI</span> (sk-...). Auto-detects provider from key prefix.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              apiStatus === 'valid' ? 'bg-emerald-500' :
              apiStatus === 'invalid' ? 'bg-red-500' :
              'bg-neutral-600'
            }`} />
            <span className={`text-[10px] ${
              apiStatus === 'valid' ? 'text-emerald-400' :
              apiStatus === 'invalid' ? 'text-red-400' :
              'text-neutral-500'
            }`}>
              {apiStatus === 'valid' ? 'Connected' :
               apiStatus === 'invalid' ? 'Not connected' :
               'Not tested'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
