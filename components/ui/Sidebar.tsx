
import React from 'react';

interface SidebarProps {
  currentView: 'home' | 'diary' | 'stats' | 'settings';
  onViewChange: (view: 'home' | 'diary' | 'stats' | 'settings') => void;
  userName: string;
  userRole: string;
  translations: {
    home: string;
    diary: string;
    stats: string;
    settings: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  userName, 
  userRole, 
  translations 
}) => {
  const NavItem = ({ 
    id, 
    label, 
    icon 
  }: { 
    id: 'home' | 'diary' | 'stats' | 'settings', 
    label: string, 
    icon: React.ReactNode 
  }) => (
    <button 
      onClick={() => onViewChange(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        currentView === id 
          ? 'bg-[#1A1A1A] text-primary font-bold' 
          : 'text-gray-500 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <aside className="hidden md:flex w-64 bg-[#0a0a0a] border-r border-white/5 flex-col p-6">
      <div className="mb-10">
        <h1 className="text-2xl font-black text-[#8b5cf6] tracking-tight">MoodFlow.</h1>
        <p className="text-[10px] text-gray-500 tracking-[0.2em] uppercase font-bold mt-1">Mindful Journaling</p>
      </div>
      
      <nav className="space-y-2 flex-1">
        <NavItem 
          id="home" 
          label={translations.home} 
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          } 
        />
        <NavItem 
          id="diary" 
          label={translations.diary} 
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          } 
        />
        <NavItem 
          id="stats" 
          label={translations.stats} 
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          } 
        />
        <NavItem 
          id="settings" 
          label={translations.settings} 
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          } 
        />
      </nav>

      <div className="text-[10px] text-gray-700 mt-auto">v2.0.0 • {userRole}</div>
    </aside>
  );
};
