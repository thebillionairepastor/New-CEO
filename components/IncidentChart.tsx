import React, { useMemo } from 'react';
import { StoredReport } from '../types';

interface IncidentChartProps {
  reports: StoredReport[];
}

interface CategoryStat {
  count: number;
  color: string;
  keywords: string[];
}

const IncidentChart: React.FC<IncidentChartProps> = ({ reports }) => {
  const stats = useMemo(() => {
    const categories: Record<string, CategoryStat> = {
      'Loss': { count: 0, color: 'bg-red-500', keywords: ['theft', 'stolen', 'missing', 'loss', 'robbery'] },
      'Access': { count: 0, color: 'bg-blue-500', keywords: ['access', 'badge', 'gate', 'door', 'intruder', 'denied', 'visitor'] },
      'Safety': { count: 0, color: 'bg-emerald-500', keywords: ['injury', 'medical', 'fire', 'hazard', 'safety', 'slip', 'fall', 'ambulance'] },
      'Violation': { count: 0, color: 'bg-yellow-500', keywords: ['uniform', 'sleep', 'late', 'procedure', 'insubordination', 'phone'] },
      'Other': { count: 0, color: 'bg-slate-500', keywords: [] }
    };

    reports.forEach(r => {
      const text = r.content.toLowerCase();
      let matched = false;
      for (const [key, config] of Object.entries(categories)) {
        if (key === 'Other') continue;
        if (config.keywords.some(k => text.includes(k))) {
          config.count++;
          matched = true;
          break;
        }
      }
      if (!matched) categories['Other'].count++;
    });

    const maxCount = Math.max(...Object.values(categories).map(c => c.count), 1);
    return { categories, maxCount, total: reports.length };
  }, [reports]);

  if (stats.total === 0) return null;

  return (
    <div className="bg-slate-900/50 rounded-3xl p-5 sm:p-8 border border-slate-800/50 mb-6 overflow-hidden shadow-lg ring-1 ring-white/5">
      <h4 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase mb-6 sm:mb-8 tracking-widest">Frequency (30 Days)</h4>
      
      <div className="flex items-end justify-between gap-3 sm:gap-6 h-32 sm:h-48 px-1">
        {Object.entries(stats.categories).map(([label, data]: [string, CategoryStat]) => {
          const heightPct = Math.max((data.count / stats.maxCount) * 100, 5);
          
          return (
            <div key={label} className="flex-1 flex flex-col items-center group relative">
              <div className="relative w-full flex justify-center items-end h-full">
                 <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-all transform -translate-y-1 bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap z-10 pointer-events-none">
                   {data.count} incidents
                 </div>
                 <div 
                   className={`w-full max-w-[20px] xs:max-w-[32px] sm:max-w-[48px] rounded-t-lg transition-all duration-700 ease-out ${data.color} ${data.count === 0 ? 'opacity-10 h-[2px]' : 'opacity-80 hover:opacity-100 shadow-[0_0_15px_rgba(0,0,0,0.3)]'}`}
                   style={{ height: `${data.count === 0 ? 2 : heightPct}%` }}
                 ></div>
              </div>
              <span className="mt-3 text-[7px] sm:text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate w-full text-center leading-tight">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IncidentChart;