import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text?: string | number | null;
  label?: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label = 'Asset Number',
  className = '',
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const textToCopy = String(text ?? '');
    if (!textToCopy) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure contexts or older browsers
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand copy failed');
      }

      setCopied(true);
      setError(false);
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch {
      setError(true);
      const timer = setTimeout(() => setError(false), 2000);
      return () => clearTimeout(timer);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        className={`p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          copied ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' : ''
        } ${className}`}
        title={copied ? 'Copied' : error ? 'Copy failed' : `Copy ${label}`}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-75 duration-150" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Brief feedback tooltip */}
      {copied && (
        <span
          role="status"
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] font-medium rounded shadow-md whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          Copied
        </span>
      )}
      {error && (
        <span
          role="status"
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-medium rounded shadow-md whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          Failed
        </span>
      )}
    </div>
  );
};
