'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { getSearchResults } from '@/lib/taskSearch';
import { ProjectSelector } from '@/components/ProjectSelector';
import { ScheduleVersionPanel } from '@/components/ScheduleVersionPanel';
import { 
  Sparkles, 
  Search, 
  Undo, 
  Redo, 
  Activity,
  LayoutDashboard,
  Package,
  ListChecks,
  ShieldAlert,
  CheckCircle,
  GitCommit,
  FileText
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    toggleAiSidebar,
    project,
    tasks,
    searchQuery,
    activeSearchResultIndex,
    setSearchQuery,
    advanceSearchResult,
  } = useStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResults = React.useMemo(() => getSearchResults(tasks, searchQuery), [tasks, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (!activeElement) return;
      const activeTag = activeElement.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';
      
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (!isInput && e.metaKey && e.key === 'z') {
        if (e.shiftKey) console.log('Redo');
        else console.log('Undo');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F8FAFB] text-slate-800 font-sans">
      <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">TaskPulse</h1>
          </div>
          <div className="h-6 w-[1px] bg-slate-200" />
          <ProjectSelector />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input 
              ref={searchInputRef}
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  advanceSearchResult();
                }
                if (e.key === 'Escape') {
                  setSearchQuery('');
                }
              }}
              placeholder="Search (Cmd+K)" 
              className="block w-72 pl-10 pr-16 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
            {searchQuery.trim() && (
              <div className="absolute inset-y-0 right-2 flex items-center text-[11px] text-slate-500 font-medium">
                {searchResults.length > 0 ? `${activeSearchResultIndex + 1 > 0 ? activeSearchResultIndex + 1 : 0}/${searchResults.length}` : '0'}
              </div>
            )}
          </div>
          <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
            <button className="p-1.5 hover:bg-slate-50 border-r border-slate-200 cursor-pointer" title="Undo"><Undo size={16} className="text-slate-600" /></button>
            <button className="p-1.5 hover:bg-slate-50 cursor-pointer" title="Redo"><Redo size={16} className="text-slate-600" /></button>
          </div>
          <ScheduleVersionPanel />
          <button 
            onClick={toggleAiSidebar} 
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-semibold hover:bg-indigo-100 cursor-pointer transition-colors"
          >
            <span className="text-sm">✨</span> AI Insights
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-white text-xs overflow-hidden">
            👤
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-[72px] bg-slate-50 border-r border-slate-200 flex flex-col items-center py-6 gap-4 shrink-0 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={20} />} label="Overview" active />
          <NavItem icon={<Package size={20} />} label="Products" />
          <NavItem icon={<ListChecks size={20} />} label="Requirements" />
          <NavItem icon={<ShieldAlert size={20} />} label="Risks" />
          <NavItem icon={<CheckCircle size={20} />} label="Verification" />
          <NavItem icon={<GitCommit size={20} />} label="Traceability" />
          <NavItem icon={<FileText size={20} />} label="Reports" />
        </nav>

        {children}
      </div>
    </div>
  );
};

function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div 
      className={`p-2.5 rounded-xl cursor-pointer transition-all flex flex-col items-center gap-1 ${
        active 
          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm' 
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      }`} 
      title={label}
    >
      {icon}
      <span className="text-[10px] font-medium hidden group-hover:block">{label}</span>
    </div>
  );
}
