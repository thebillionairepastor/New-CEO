import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Mail, MessageCircle, Check, Link, Printer } from 'lucide-react';
import { View } from '../types';

interface ShareButtonProps {
  content: string;
  title: string;
  view?: View;
  id?: string;
  topic?: string;
  onPrint?: () => void;
  triggerClassName?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ content, title, view, id, topic, onPrint, triggerClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyText = () => {
    navigator.clipboard.writeText(content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = new URL(baseUrl);
    
    if (view) url.searchParams.set('view', view);
    if (id) url.searchParams.set('id', id);
    if (topic) url.searchParams.set('topic', topic);
      
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`*${title}*\n\n${content}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`AntiRisk Security: ${title}`);
    const body = encodeURIComponent(content);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const defaultTriggerClasses = "flex items-center gap-2 bg-[#2563eb] hover:bg-blue-600 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all font-bold text-[10px] sm:text-sm shadow-lg shadow-blue-600/20 active:scale-95 z-10 whitespace-nowrap";

  return (
    <div className={`relative inline-block text-left ${triggerClassName?.includes('w-full') ? 'w-full' : ''}`} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || defaultTriggerClasses}
      >
        <Share2 size={triggerClassName?.includes('text-lg') ? 20 : 16} strokeWidth={2.5} />
        <span className="hidden xs:inline">Broadcast</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 sm:w-64 bg-[#0a1222] border border-slate-800/60 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in duration-150 origin-top-right ring-1 ring-white/5">
          <div className="p-1 space-y-0.5">
            <button 
              onClick={() => { handleWhatsApp(); setIsOpen(false); }}
              className="flex items-center w-full gap-3 px-4 py-3 text-left text-xs sm:text-[14px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors rounded-xl"
            >
              <MessageCircle size={18} className="text-[#25D366]" />
              WhatsApp
            </button>
            
            <button 
              onClick={() => { handleEmail(); setIsOpen(false); }}
              className="flex items-center w-full gap-3 px-4 py-3 text-left text-xs sm:text-[14px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors rounded-xl"
            >
              <Mail size={18} className="text-blue-500" />
              Email Team
            </button>

            <div className="h-px bg-slate-800/40 mx-2 my-1" />

            <button 
              onClick={handleCopyLink}
              className="flex items-center w-full justify-between px-4 py-3 text-left text-xs sm:text-[14px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3"><Link size={18} className="text-slate-400" /> Link</div>
              {copiedLink && <Check size={14} className="text-emerald-500" />}
            </button>

            <button 
              onClick={() => { handlePrint(); setIsOpen(false); }}
              className="flex items-center w-full gap-3 px-4 py-3 text-left text-xs sm:text-[14px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors rounded-xl"
            >
              <Printer size={18} className="text-slate-400" /> Print
            </button>

            <button 
              onClick={handleCopyText}
              className="flex items-center w-full justify-between px-4 py-3 text-left text-xs sm:text-[14px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3"><Copy size={18} className="text-slate-400" /> Plain Text</div>
              {copiedText && <Check size={14} className="text-emerald-500" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareButton;