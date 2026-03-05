
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-invert prose-sm sm:prose-base max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({node, ...props}) => <h1 className="text-lg sm:text-xl font-black text-white border-b border-slate-700/50 pb-2 mb-4 uppercase tracking-tighter" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-base sm:text-lg font-bold text-blue-400 mt-5 mb-2 uppercase tracking-wide" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-sm sm:text-base font-black text-emerald-400 mt-4 mb-2 flex items-center gap-2 border-l-2 border-emerald-500 pl-3 bg-emerald-500/5 py-1 rounded-r-lg" {...props} />,
          h4: ({node, ...props}) => <h4 className="text-[10px] sm:text-xs font-black text-slate-300 mt-3 mb-1 uppercase tracking-widest" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-inside my-3 space-y-1.5 text-slate-300 ml-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-inside my-3 space-y-2 text-slate-300 bg-slate-900/30 p-4 rounded-xl border border-slate-800/40" {...props} />,
          li: ({node, ...props}) => <li className="text-slate-300 leading-relaxed font-medium text-[11px] sm:text-sm" {...props} />,
          strong: ({node, ...props}) => <strong className="text-blue-300 font-bold" {...props} />,
          p: ({node, ...props}) => <p className="mb-3 text-slate-300 leading-relaxed last:mb-0 text-[11px] sm:text-sm" {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-blue-600/50 pl-4 my-4 italic text-slate-400 bg-blue-600/5 py-3 pr-3 rounded-r-xl border-dashed" {...props} />
          ),
          a: ({node, ...props}) => <a className="text-blue-400 hover:text-blue-300 underline font-bold transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
          code: ({node, inline, className, children, ...props}) => {
            const isInline = !className?.includes('language-');
            return isInline ? (
              <code className="bg-slate-900/80 text-blue-400 px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-slate-700/50" {...props}>
                {children}
              </code>
            ) : (
              <div className="relative group my-5">
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto shadow-inner">
                  <code className="text-blue-300 font-mono text-[10px] sm:text-xs leading-relaxed" {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
