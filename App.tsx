import React, { useState, useEffect } from 'react';
import { User, MoodEntry, UserRole, Language, DoctorNote } from './types';
import { storageService } from './services/storageService';
import { TRANSLATIONS, MOODS } from './constants';
import { Analytics } from './components/charts/Analytics';
import { EntryForm } from './components/entry/EntryForm';
import { DoctorPortal } from './components/doctor/DoctorPortal';
import { Button } from './components/ui/Button';
import { Sidebar } from './components/ui/Sidebar';
import { BottomNav } from './components/ui/BottomNav';
import Auth from './components/Auth';
import { ConsentSettings } from './components/settings/ConsentSettings';

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [entries, setEntries] = useState<MoodEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'home' | 'diary' | 'stats' | 'settings' | 'consent'>('home');
    const [showEntryForm, setShowEntryForm] = useState(false);
    const [entryMode, setEntryMode] = useState<'mood' | 'voice' | 'diary'>('mood');
    const [lang, setLang] = useState<Language>('pt');
    const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    useEffect(() => {
        const unsub = storageService.onAuthStateChanged((u) => {
            if (u) {
                setLang(u.language);
                setUser(u);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (user && user.role !== UserRole.PROFESSIONAL) {
            const unsub = storageService.subscribeEntries(user.id, (data) => setEntries(data));
            const unsubNotes = storageService.subscribeNotes(undefined, user.id, (notes) => setDoctorNotes(notes));
            storageService.getAuditLogs(user.id).then(setAuditLogs);
            return () => { unsub(); unsubNotes(); }
        }
    }, [user]);

    const handleSaveEntry = async (entry: MoodEntry) => {
        if (!user) return;
        setEntries(prev => [entry, ...prev]);
        setShowEntryForm(false);
        try {
            await storageService.addEntry(user.id, entry);
        } catch (error) {
            console.error("Error saving entry:", error);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#7c3aed]/20 border-t-[#7c3aed] rounded-full animate-spin"></div>
        </div>
    );

    if (!user) return <Auth />;
    if (user.role === UserRole.PROFESSIONAL) return <DoctorPortal user={user} onLogout={storageService.logout} />;

    const t = TRANSLATIONS[lang] || TRANSLATIONS['pt'];
    const latestEntry = entries[0];
    const isMoodEntry = latestEntry ? (latestEntry.entryMode === 'mood' || (latestEntry.entryMode === undefined && latestEntry.mood !== null)) : false;
    const lastMood = (isMoodEntry && latestEntry?.mood) ? MOODS.find(m => m.value === latestEntry.mood) : null;

    return (
        <div className="flex h-screen bg-[#050505] text-[#e5e5e5] font-sans overflow-hidden">
            <Sidebar
                currentView={view}
                onViewChange={setView}
                userName={user.name}
                userRole={user.role}
                translations={{
                    home: t.home,
                    diary: t.diary,
                    stats: t.stats,
                    settings: t.settings
                }}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-0">
                {view === 'home' && (
                    <div className="p-4 md:p-10 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{t.hello} {user.name.split(' ')[0]}!</h1>
                                <p className="text-sm text-gray-500 mt-1 font-medium">{t.readyTrack}</p>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => { setShowEntryForm(true); setEntryMode('mood'); }}
                                    className="flex-1 md:flex-none px-6 py-3.5 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-[0_8px_20px_-4px_rgba(124,58,237,0.4)] hover:scale-[1.02] transition-all"
                                >
                                    {t.logMood}
                                </button>
                                <button
                                    onClick={() => { setShowEntryForm(true); setEntryMode('voice'); }}
                                    className="px-4 py-3.5 bg-[#1A1A1A] text-white rounded-2xl border border-white/5 hover:bg-white/5 transition-all"
                                    title={t.voiceLog}
                                >
                                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Top Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0D0D0D] p-8 rounded-[36px] border border-white/5 shadow-2xl flex items-center justify-between group h-48 hover:border-white/10 transition-all">
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 block">{t.lastMood}</label>
                                    {latestEntry ? (
                                        <div className="space-y-1">
                                            <h3 className="text-3xl font-black text-white tracking-tight">
                                                {isMoodEntry ? (lastMood?.label || 'Okay') : t.diary}
                                            </h3>
                                            <p className="text-xs text-gray-600 font-bold uppercase tracking-tight">
                                                {new Date(latestEntry.timestamp).toLocaleDateString('pt-BR')} • {new Date(latestEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 font-medium italic">{t.noEntries}</p>
                                    )}
                                </div>
                                <div className="text-7xl md:text-8xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-500">
                                    {isMoodEntry ? (lastMood?.emoji || '😐') : '📖'}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] p-8 rounded-[36px] border border-white/5 shadow-2xl flex flex-col justify-between h-48 group hover:border-white/10 transition-all relative overflow-hidden">
                                <div className="z-10 relative">
                                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">{t.diaryTitle}</h2>
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-[200px]">{t.diarySubtitle}</p>
                                </div>
                                <button
                                    onClick={() => { setShowEntryForm(true); setEntryMode('diary'); }}
                                    className="bg-white text-black font-black text-[11px] uppercase tracking-widest py-3 px-6 rounded-2xl shadow-xl w-max z-10 hover:scale-[1.05] transition-all"
                                >
                                    {t.writeNew}
                                </button>
                                <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
                                    <svg className="w-40 h-40 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 2H5C3.34 2 2 3.34 2 5V21C2 21.55 2.45 22 3 22H19C19.55 22 20 21.55 20 21V5C20 3.34 18.66 2 17 2H19V2ZM18 20H4V5C4 4.45 4.45 4 5 4H17C17.55 4 18 4.45 18 5V20Z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity List */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                {t.recentActivity}
                                <span className="text-xs bg-white/5 text-gray-500 px-3 py-1 rounded-full border border-white/5 font-bold">{entries.length}</span>
                            </h3>
                            <div className="space-y-4">
                                {entries.length === 0 ? (
                                    <div className="bg-[#0D0D0D] border border-dashed border-white/10 rounded-[32px] p-16 text-center">
                                        <span className="text-4xl mb-4 block">📔</span>
                                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{t.emptyBook}</p>
                                    </div>
                                ) : (
                                    entries.slice(0, 5).map(e => {
                                        const entryIsMood = e.entryMode === 'mood' || (!e.entryMode && e.mood !== null);
                                        const m = entryIsMood ? MOODS.find(mood => mood.value === e.mood) : null;
                                        return (
                                            <div key={e.id} className="bg-[#0D0D0D] p-5 rounded-[28px] border border-white/5 flex items-center justify-between group hover:bg-[#111] hover:border-white/10 transition-all gap-4">
                                                <div className="flex items-center gap-5 min-w-0 flex-1">
                                                    <span className="text-3xl flex-shrink-0 select-none">{m?.emoji || '📖'}</span>
                                                    <div className="min-w-0">
                                                        <div className="font-black text-white text-sm tracking-tight">{m?.label || t.diary}</div>
                                                        <p className="text-xs text-gray-500 truncate max-w-md font-medium tracking-tight mt-0.5">{e.text || 'Sem texto...'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    <span className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">{new Date(e.timestamp).toLocaleDateString('pt-BR')}</span>
                                                    {user.role === UserRole.PATIENT && (
                                                        <span className={`w-2 h-2 rounded-full ${e.isLocked ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-green-500 shadow-[0_0_8px_#10b981]'}`} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'diary' && (
                    <div className="p-4 md:p-10 max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="flex justify-between items-center">
                            <h2 className="text-4xl font-black text-white tracking-tighter">{t.diaryTitle}</h2>
                            <button onClick={() => { setShowEntryForm(true); setEntryMode('diary'); }} className="bg-white text-black px-6 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                                {t.writeNew}
                            </button>
                        </div>
                        <div className="space-y-6">
                            {entries.map(entry => (
                                <div key={entry.id} className="bg-[#0D0D0D] p-8 rounded-[36px] border border-white/5 space-y-6 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all">
                                    <div className="flex justify-between items-start z-10 relative">
                                        <div className="space-y-1">
                                            <h4 className="text-[#8b5cf6] font-black text-[11px] uppercase tracking-[0.2em]">
                                                {new Date(entry.timestamp).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </h4>
                                            <span className="text-gray-600 text-[10px] font-black">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${entry.isLocked ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                            {entry.isLocked ? '🔒 Privado' : '🔓 Visível'}
                                        </div>
                                    </div>
                                    <p className="text-[#e5e5e5] text-base leading-relaxed font-medium tracking-tight whitespace-pre-wrap">
                                        {entry.text}
                                    </p>
                                    {entry.energy && (
                                        <div className="flex items-center gap-2 text-yellow-500/80 font-black text-[11px] uppercase tracking-widest pt-4 border-t border-white/5">
                                            <span>⚡ Energia: {entry.energy}/10</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'stats' && (
                    <div className="p-4 md:p-10 max-w-5xl mx-auto space-y-8">
                        <h2 className="text-3xl font-black text-white tracking-tighter">{t.stats}</h2>
                        <Analytics entries={entries} lang={lang} />
                    </div>
                )}

                {view === 'settings' && user && (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
                        <h2 className="text-3xl font-black text-white tracking-tighter">{t.accountSettings}</h2>
                        <div className="space-y-6">
                            <div className="bg-[#0D0D0D] p-8 rounded-[36px] border border-white/5 space-y-8 shadow-2xl">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-[#7c3aed]/20">
                                        {(user.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-white tracking-tight">{user.name}</h3>
                                        <p className="text-sm text-gray-500 font-medium">{user.email}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest">{t.role}</span>
                                        <span className="bg-[#1A1A1A] text-[10px] px-3 py-1 rounded-full text-white font-black border border-white/10 uppercase">{user.role}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Idioma</span>
                                        <div className="flex gap-2">
                                            {['pt', 'en'].map(l => (
                                                <button key={l} onClick={() => setLang(l as Language)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${lang === l ? 'bg-white text-black' : 'text-gray-600 hover:text-white'}`}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Button variant="secondary" onClick={storageService.logout} className="w-full bg-[#1A1A1A] border-none text-white h-12 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#222]">
                                    {t.signOut}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'consent' && user && (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 py-10">
                        <button onClick={() => setView('settings')} className="text-xs text-gray-500 font-black uppercase tracking-widest hover:text-white flex items-center gap-2 mb-6 transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Voltar
                        </button>
                        <ConsentSettings user={user} />
                    </div>
                )}
            </main>

            <BottomNav currentView={view} onViewChange={setView} />

            {showEntryForm && user && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
                    <EntryForm
                        userId={user.id}
                        userRole={user.role}
                        onSave={handleSaveEntry}
                        onCancel={() => setShowEntryForm(false)}
                        initialMode={entryMode}
                        lang={lang}
                    />
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #050505; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222; }
                
                @media (max-width: 768px) {
                    .custom-scrollbar::-webkit-scrollbar { width: 0px; }
                }
                
                body { overflow: hidden; height: 100%; position: fixed; width: 100%; }
                #root { height: 100%; }
            `}} />
        </div>
    );
}
