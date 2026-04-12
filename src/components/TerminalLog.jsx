import React, { useRef, useEffect } from 'react';

export default function TerminalLog({ lines }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-neutral-800">
      <div className="px-4 py-1.5 flex items-center gap-2 border-b border-neutral-800/50 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Terminal</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-black p-3 font-mono text-xs terminal-log">
        {lines.length === 0 ? (
          <span className="text-neutral-600">Waiting for commands...</span>
        ) : (
          lines.map((line, i) => (
            <span
              key={i}
              className={`block whitespace-pre-wrap ${
                line.startsWith('$') ? 'text-cyan-400' :
                line.startsWith('✓') ? 'text-emerald-400' :
                line.startsWith('✗') || line.startsWith('Error') ? 'text-red-400' :
                line.startsWith('⟳') ? 'text-yellow-400' :
                'text-neutral-300'
              }`}
            >
              {line}
            </span>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
