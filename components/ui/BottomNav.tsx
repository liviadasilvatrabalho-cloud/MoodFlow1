
import React from 'react';

interface BottomNavProps {
    currentView: 'home' | 'diary' | 'stats' | 'settings';
    onViewChange: (view: 'home' | 'diary' | 'stats' | 'settings') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange }) => {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 pb-safe z-30">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto relative">
                <button
                    onClick={() => onViewChange('home')}
                    className={`relative w-16 h-full flex items-center justify-center transition-all ${currentView === 'home' ? 'text-primary' : 'text-neutral-500'
                        }`}
                >
                    {currentView === 'home' && (
                        <div className="absolute top-0 w-8 h-0.5 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.8)] rounded-b-full"></div>
                    )}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </button>

                <button
                    onClick={() => onViewChange('diary')}
                    className={`relative w-16 h-full flex items-center justify-center transition-all ${currentView === 'diary' ? 'text-primary' : 'text-neutral-500'
                        }`}
                >
                    {currentView === 'diary' && (
                        <div className="absolute top-0 w-8 h-0.5 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.8)] rounded-b-full"></div>
                    )}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </button>

                <button
                    onClick={() => onViewChange('stats')}
                    className={`relative w-16 h-full flex items-center justify-center transition-all ${currentView === 'stats' ? 'text-primary' : 'text-neutral-500'
                        }`}
                >
                    {currentView === 'stats' && (
                        <div className="absolute top-0 w-8 h-0.5 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.8)] rounded-b-full"></div>
                    )}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                </button>

                <button
                    onClick={() => onViewChange('settings')}
                    className={`relative w-16 h-full flex items-center justify-center transition-all ${currentView === 'settings' ? 'text-primary' : 'text-neutral-500'
                        }`}
                >
                    {currentView === 'settings' && (
                        <div className="absolute top-0 w-8 h-0.5 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.8)] rounded-b-full"></div>
                    )}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>
        </nav>
    );
};
