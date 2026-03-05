import React from 'react';
import { View } from '../types';
import { LayoutDashboard, ShieldAlert, BookOpen, Briefcase, Lightbulb, Settings, X, User, Newspaper } from 'lucide-react';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
  isMobileMenuOpen: boolean;
  closeMobileMenu: () => void;
  onOpenSettings: () => void;
}

const AntiRiskLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 L95 85 L5 85 Z" fill="#000000" />
    <path d="M5 L85 L25 85 L15 65 Z" fill="#dc2626" />
    <path d="M95 85 L75 85 L85 65 Z" fill="#dc2626" />
    <circle cx="50" cy="55" r="30" fill="white" />
    <text x="50" y="68" fontFamily="Arial, sans-serif" fontSize="38" fontWeight="bold" fill="black" textAnchor="middle">AR</text>
    <rect x="0" y="85" width="100" height="15" fill="#000" />
  </svg>
);

const Navigation: React.FC<NavigationProps> = ({ 
  currentView, 
  setView, 
  isMobileMenuOpen, 
  closeMobileMenu, 
  onOpenSettings
}) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: View.NEWS_BLOG, label: 'Security News', icon: Newspaper },
    { id: View.ADVISOR, label: 'AI Advisor', icon: ShieldAlert },
    { id: View.WEEKLY_TIPS, label: 'Weekly Tips', icon: Lightbulb },
    { id: View.TRAINING, label: 'Training Builder', icon: BookOpen },
    { id: View.TOOLKIT, label: 'Ops Vault', icon: Briefcase },
  ];

  const baseClasses = "fixed inset-y-0 left-0 z-[100] w-[85vw] sm:w-72 bg-[#0a0f1a] border-r border-slate-800/40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 shadow-2xl lg:shadow-none ring-1 ring-white/5";
  const mobileClasses = isMobileMenuOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[90] lg:hidden animate-in fade-in duration-300"
          onClick={closeMobileMenu}
        />
      )}

      <div className={`${baseClasses} ${mobileClasses}`}>
        <div className="h-full flex flex-col">
          <div className="p-5 sm:p-8 border-b border-slate-800/40 flex justify-between items-center">
            <div className="flex items-center gap-3 sm:gap-4" onClick={() => { setView(View.DASHBOARD); closeMobileMenu(); }}>
              <AntiRiskLogo className="w-8 h-8 sm:w-10 sm:h-10" />
              <div>
                <h1 className="font-bold text-base sm:text-2xl text-white leading-tight tracking-tight uppercase">AntiRisk</h1>
                <p className="text-[7px] sm:text-[10px] text-red-500 font-black tracking-[0.2em] uppercase">MANAGEMENT</p>
              </div>
            </div>
            <button 
              onClick={closeMobileMenu}
              className="lg:hidden p-2.5 text-slate-500 hover:text-white bg-slate-900/50 rounded-lg active:scale-90 transition-transform border border-slate-800/50"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 py-4 px-2.5 sm:py-6 sm:px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    closeMobileMenu();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 rounded-xl transition-all group active:scale-[0.97] ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                      : 'text-slate-500 hover:bg-slate-900/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3.5 sm:gap-5">
                    <Icon className={`${isActive ? 'text-white' : 'text-slate-600 group-hover:text-blue-400'} w-5 h-5 sm:w-6 sm:h-6 transition-colors`} />
                    <span className="font-bold text-sm sm:text-lg text-left truncate tracking-tight">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="p-5 sm:p-8 border-t border-slate-800/40 space-y-4 sm:space-y-6 bg-slate-900/20">
            <button 
              onClick={() => { onOpenSettings(); closeMobileMenu(); }}
              className="w-full flex items-center gap-4 sm:gap-5 px-4 py-3 sm:px-6 sm:py-4 rounded-xl text-slate-500 hover:bg-slate-900/60 hover:text-white transition-all active:scale-[0.97] border border-transparent hover:border-slate-800/50"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center shrink-0">
                <User className="text-blue-400 w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="font-bold text-sm sm:text-lg tracking-tight">CEO Profile</span>
            </button>
            <div className="bg-slate-950/50 rounded-2xl p-4 sm:p-6 border border-slate-800/40">
              <h4 className="text-[8px] sm:text-[9px] font-black text-slate-700 uppercase mb-2 sm:mb-3 tracking-[0.25em]">System Status</h4>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;