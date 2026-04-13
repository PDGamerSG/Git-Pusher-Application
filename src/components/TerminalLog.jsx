import React, { useRef, useEffect } from 'react';

// Strip ANSI escape codes from terminal output
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

function lineColor(line) {
  const t = line.trimStart();
  if (t.startsWith('$')) return 'text-cyan-400';
  if (t.startsWith('✓')) return 'text-emerald-400';
  if (t.startsWith('✗') || t.startsWith('Error') || t.startsWith('error')) return 'text-red-400';
  if (t.startsWith('⟳') || t.startsWith('warning') || t.startsWith('Warning')) return 'text-yellow-400';
  if (t.startsWith('hint:') || t.startsWith('remote:')) return 'text-neutral-500';
  return 'text-neutral-300';
}

export default function TerminalLog({ lines }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Flatten all chunks into individual display lines
  const displayLines = lines
    .join('')
    .split(/\r?\n/)
    .map(l => stripAnsi(l));

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-neutral-800">
      <div className="px-4 py-1.5 flex items-center gap-2 border-b border-neutral-800/50 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Terminal</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-black p-3 font-mono text-xs">
        {displayLines.every(l => l === '') ? (
          <span className="text-neutral-600">Waiting for commands...</span>
        ) : (
          displayLines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap leading-5 ${lineColor(line)}`}>
              {line || '\u00A0'}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
