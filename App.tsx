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

// --- 1. Role Selection Screen ---
const RoleSelectionScreen = ({ user, onSelect, onBack }: { user: User, onSelect: (role: UserRole) => void, onBack: () => void }) => {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
            <div className="w-full max-w-[400px] animate-in fade-in duration-500">

                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 mb-4">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">MoodFlow</h1>
                    <p className="text-gray-500 text-xs tracking-wide">AI-Powered Mood & Journal Companion</p>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <button
                        onClick={() => onSelect(UserRole.STANDARD)}
                        className="w-full text-left bg-[#111] hover:bg-[#1A1A1A] border border-neutral-800 hover:border-neutral-700 p-6 rounded-2xl transition-all group"
                    >
                        <h3 className="text-white font-bold text-xl mb-2 group-hover:text-primary transition-colors">Usuário Comum</h3>
                        <p className="text-base text-gray-400 leading-relaxed">Diário pessoal. Análises privadas.</p>
                    </button>

                    <button
                        onClick={() => onSelect(UserRole.PATIENT)}
                        className="w-full text-left bg-[#111] hover:bg-[#1A1A1A] border border-neutral-800 hover:border-neutral-700 p-6 rounded-2xl transition-all group"
                    >
                        <h3 className="text-white font-bold text-xl mb-2 group-hover:text-primary transition-colors">Paciente</h3>
                        <p className="text-base text-gray-400 leading-relaxed">Compartilhe registros específicos com seu terapeuta.</p>
                    </button>

                    <button
                        onClick={() => onSelect(UserRole.DOCTOR)}
                        className="w-full text-left bg-[#111] hover:bg-[#1A1A1A] border border-neutral-800 hover:border-neutral-700 p-6 rounded-2xl transition-all group"
                    >
                        <h3 className="text-white font-bold text-xl mb-2 group-hover:text-primary transition-colors">Profissional</h3>
                        <p className="text-base text-gray-400 leading-relaxed">Para terapeutas visualizarem dados de pacientes.</p>
                    </button>
                </div>

                {/* Back */}
                <div className="mt-8 text-center">
                    <button onClick={onBack} className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors">
                        Voltar
                    </button>
                </div>

            </div>
        </div>
    );
};

// --- Main App ---
export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [roleSelectionUser, setRoleSelectionUser] = useState<User | null>(null);
    const [entries, setEntries] = useState<MoodEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'home' | 'diary' | 'stats' | 'settings'>('home');
    const [showEntryForm, setShowEntryForm] = useState(false);
    const [entryMode, setEntryMode] = useState<'mood' | 'voice' | 'diary'>('mood');
    const [lang, setLang] = useState<Language>('pt');
    const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);

    useEffect(() => {
        const unsub = storageService.onAuthStateChanged((u) => {
            if (u) {
                setLang(u.language);
                if (u.roleConfirmed) {
                    setUser(u);
                    setRoleSelectionUser(null);
                } else {
                    setRoleSelectionUser(u);
                    setUser(null);
                }
            } else {
                setUser(null);
                setRoleSelectionUser(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (user && user.role !== UserRole.DOCTOR) {
            const unsub = storageService.subscribeEntries(user.id, (data) => {
                setEntries(data);
            });
            const unsubNotes = storageService.subscribeNotes(undefined, user.id, (notes) => {
                setDoctorNotes(notes);
            });
            return () => { unsub(); unsubNotes(); }
        }
    }, [user]);

    const handleRoleSelect = async (role: UserRole) => {
        if (!roleSelectionUser) return;
        try {
            const updatedUser = { ...roleSelectionUser, role, roleConfirmed: true };
            await storageService.saveUser(updatedUser);
            setUser(updatedUser);
            setRoleSelectionUser(null);
        } catch (error: any) {
            console.error("Error selecting role:", error);
            alert("Erro ao salvar papel: " + (error.message || "Erro desconhecido"));
        }
    };

    const updateUserLanguage = async (l: Language) => {
        if (!user) { setLang(l); return; }
        const updated = { ...user, language: l };
        setUser(updated);
        setLang(l);
        await storageService.saveUser(updated);
    };

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');

    const handleUpdateName = async () => {
        if (!user || !editNameValue.trim()) return;
        try {
            const updated = { ...user, name: editNameValue.trim() };
            setUser(updated);
            setIsEditingName(false);
            await storageService.saveUser(updated);
        } catch (error) {
            console.error("Error updating name:", error);
            alert("Erro ao atualizar nome.");
        }
    };

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

    const handleToggleLock = async (entry: MoodEntry) => {
        if (!user || user.role === UserRole.DOCTOR) return;
        const updatedEntry = { ...entry, isLocked: !entry.isLocked };
        setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e));
        try {
            await storageService.updateEntry(user.id, updatedEntry);
        } catch (error) {
            console.error("Error toggling lock:", error);
        }
    };

    const [commentingEntryId, setCommentingEntryId] = useState<string | null>(null);
    const [patientReply, setPatientReply] = useState('');

    const handleSavePatientReply = async (entryId: string) => {
        if (!patientReply.trim() || !user) return;

        // CRITICAL FIX: Find the correct doctorId for this thread
        let targetDoctorId = doctorNotes.find(n => n.entryId === entryId && n.doctorId)?.doctorId
            || doctorNotes.find(n => n.doctorId)?.doctorId;

        // If no doctor found in existing notes (first interaction), fetch from DB
        if (!targetDoctorId) {
            targetDoctorId = (await storageService.getConnectedDoctor(user.id)) || '';
        }

        if (!targetDoctorId) {
            alert("Erro: Você precisa estar conectado a um médico para enviar mensagens.");
            return;
        }

        const noteId = crypto.randomUUID();
        const note: DoctorNote = {
            id: noteId,
            doctorId: targetDoctorId,
            patientId: user.id,
            entryId,
            text: patientReply,
            isShared: true,
            authorRole: 'PATIENT',
            read: false,
            createdAt: new Date().toISOString()
        };
        setDoctorNotes(prev => [...prev, note]);
        const currentReply = patientReply;
        setPatientReply('');
        setCommentingEntryId(null);
        try {
            await storageService.saveDoctorNote(note);
        } catch (error) {
            console.error("Error saving reply:", error);
            setPatientReply(currentReply);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div></div>;
    if (roleSelectionUser) return <RoleSelectionScreen user={roleSelectionUser} onSelect={handleRoleSelect} onBack={storageService.logout} />;
    if (!user) return <Auth />;
    if (user.role === UserRole.DOCTOR) return <DoctorPortal user={user} onLogout={storageService.logout} />;

    const t = TRANSLATIONS[lang];
    const latestEntry = entries[0];
    const isMoodEntry = latestEntry ? (latestEntry.entryMode === 'mood' || (latestEntry.entryMode === undefined && latestEntry.mood !== null)) : false;
    const lastMood = (isMoodEntry && latestEntry?.mood) ? MOODS.find(m => m.value === latestEntry.mood) : null;

    return (
        <div className="flex h-screen bg-black text-textMain overflow-hidden">
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

            <main className="flex-1 relative overflow-y-auto custom-scrollbar pb-24 md:pb-0 bg-black">
                {view === 'home' && (
                    <div className="p-4 md:p-10 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 pt-2 md:pt-0">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white mb-0.5">{t.hello} {user.name.split(' ')[0]}</h1>
                                <p className="text-[11px] md:text-sm text-gray-400">{t.readyTrack}</p>
                            </div>
                            <div className="hidden md:flex bg-[#111] p-1 rounded-xl border border-white/5">
                                <button onClick={() => { setShowEntryForm(true); setEntryMode('mood'); }} className="px-4 py-2 bg-[#7c3aed] text-white text-xs font-bold rounded-lg hover:bg-[#6d28d9] transition-colors">
                                    {t.logMood}
                                </button>
                                <button onClick={() => { setShowEntryForm(true); setEntryMode('voice'); }} className="px-4 py-2 bg-[#dc2626] text-white text-xs font-bold rounded-lg hover:bg-[#b91c1c] transition-colors ml-2 flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    {t.voiceLog}
                                </button>
                                <button onClick={() => { setShowEntryForm(true); setEntryMode('diary'); }} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors ml-2 flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    {t.writeDiary}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-surface p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden flex items-center justify-between group h-40 md:h-48">
                                <div className="z-10">
                                    <h2 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 md:mb-4">{t.lastMood}</h2>
                                    {latestEntry ? (
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-0.5">
                                                {isMoodEntry ? (lastMood?.label || 'Okay') : t.diary}
                                            </h3>
                                            <p className="text-[10px] md:text-xs text-gray-500 font-mono">
                                                {new Date(latestEntry.timestamp).toLocaleDateString()} • {new Date(latestEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">{t.noEntries}</p>
                                    )}
                                </div>
                                <div className="text-[60px] md:text-[80px] leading-none opacity-100 filter grayscale-0">
                                    {isMoodEntry ? (lastMood?.emoji || '🙂') : '📖'}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between h-40 md:h-48 shadow-xl">
                                <div className="z-10">
                                    <h2 className="text-2xl font-bold text-white mb-2">{t.diaryTitle}</h2>
                                    <p className="text-xs text-purple-200 leading-relaxed max-w-[80%] opacity-90">{t.diarySubtitle}</p>
                                </div>
                                <button
                                    onClick={() => { setShowEntryForm(true); setEntryMode('diary'); }}
                                    className="bg-white text-primary font-bold text-xs py-2 px-4 rounded-xl shadow-lg w-max relative z-10 hover:scale-105 active:scale-95 transition-all mt-4"
                                >
                                    {t.writeNew}
                                </button>
                                <div className="absolute -bottom-6 -right-6 w-40 h-40 opacity-20 transform rotate-12 text-white">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M19 2H5C3.34 2 2 3.34 2 5V21C2 21.55 2.45 22 3 22H19C19.55 22 20 21.55 20 21V5C20 3.34 18.66 2 17 2H19V2ZM18 20H4V5C4 4.45 4.45 4 5 4H17C17.55 4 18 4.45 18 5V20Z" /><path d="M6 7H16V9H6V7ZM6 11H16V13H6V11ZM6 15H11V17H6V15Z" /></svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                {t.recentActivity}
                                <span className="text-xs bg-[#1A1A1A] text-gray-500 px-2 py-0.5 rounded-md font-mono">{entries.length}</span>
                            </h3>
                            <div className="space-y-3">
                                {entries.length === 0 ? (
                                    <p className="text-center text-gray-600 py-10">{t.emptyBook}</p>
                                ) : (
                                    entries.slice(0, 5).map(e => {
                                        const entryIsMood = e.entryMode === 'mood' || (!e.entryMode && e.mood !== null);
                                        const m = entryIsMood ? MOODS.find(mood => mood.value === e.mood) : null;
                                        return (
                                            <div key={e.id} className="bg-[#0A0A0A] p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all gap-3">
                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                    <span className="text-2xl flex-shrink-0">{m?.emoji || '📖'}</span>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-white text-sm truncate">{m?.label || t.diary}</div>
                                                        <p className="text-xs text-gray-500 break-words overflow-hidden [overflow-wrap:anywhere]">{e.text || 'No text...'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                                                    <span className="text-[10px] text-blue-500/70 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleDateString()}</span>
                                                    {user.role === UserRole.PATIENT ? (
                                                        <button
                                                            onClick={(ev) => { ev.stopPropagation(); handleToggleLock(e); }}
                                                            className="text-orange-400 hover:text-orange-300 transition-colors flex items-center"
                                                            title={e.isLocked ? "Unlock" : "Lock"}
                                                        >
                                                            {e.isLocked ? (
                                                                <span className="text-xs drop-shadow-[0_0_5px_rgba(251,146,60,0.6)]">🔒</span>
                                                            ) : (
                                                                <span className="text-xs text-green-500/50 grayscale hover:grayscale-0 transition-all">🔓</span>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        e.isLocked && <span className="text-orange-400 text-xs drop-shadow-[0_0_3px_rgba(251,146,60,0.5)]">🔒</span>
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
                    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-bold text-white">{t.diary}</h2>
                            <button
                                onClick={() => { setShowEntryForm(true); setEntryMode('diary'); }}
                                className="bg-white text-black px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                {t.writeNew}
                            </button>
                        </div>

                        <div className="relative border-l border-white/10 ml-3 space-y-8 pb-10">
                            {entries.map(entry => {
                                const dateObj = new Date(entry.timestamp);
                                return (
                                    <div key={entry.id} className="relative pl-8 group">
                                        <div className="absolute -left-[5px] top-0 w-3 h-3 rounded-full bg-orange-500 ring-4 ring-black"></div>
                                        <div className="bg-[#111] p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="text-[#7c3aed] font-bold text-xs uppercase tracking-wider mb-1">
                                                        {dateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </h4>
                                                    <span className="text-gray-500 text-xs font-mono">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {user.role === UserRole.PATIENT && (
                                                        <button
                                                            onClick={() => handleToggleLock(entry)}
                                                            className={`text-[10px] px-2 py-1 rounded-full border font-bold flex items-center gap-1 transition-colors ${entry.isLocked ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-green-900/20 text-green-400 border-green-900/30'}`}
                                                        >
                                                            {entry.isLocked ? '🔒 Private' : '🔓 Shared'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Shared Comments View (Diary) */}
                                            {doctorNotes.filter(n => n.entryId === entry.id).length > 0 && (
                                                <div className="mt-4 space-y-3 bg-neutral-900/30 p-4 rounded-xl border border-white/5">
                                                    {doctorNotes.filter(n => n.entryId === entry.id).map(note => (
                                                        <div key={note.id} className={`flex flex-col ${note.authorRole === 'PATIENT' ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[90%] p-2 rounded-xl text-[11px] ${note.authorRole === 'PATIENT' ? 'bg-neutral-800 text-gray-400' : 'bg-blue-900/20 text-blue-100 border border-blue-900/20'}`}>
                                                                <span className="font-bold block text-[9px] opacity-40 mb-1">{note.authorRole === 'PATIENT' ? 'Minha Resposta' : 'Dr. Note'}</span>
                                                                {note.text}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reply Form (Diary) */}
                                            {commentingEntryId === entry.id ? (
                                                <div className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-1">
                                                    <input
                                                        className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                                        placeholder="Sua resposta para o doutor..."
                                                        value={patientReply}
                                                        onChange={ev => setPatientReply(ev.target.value)}
                                                        autoFocus
                                                    />
                                                    <Button className="h-9 px-4" onClick={() => handleSavePatientReply(entry.id)}>Enviar</Button>
                                                    <Button variant="ghost" className="h-9 px-4" onClick={() => setCommentingEntryId(null)}>Cancelar</Button>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => setCommentingEntryId(entry.id)}
                                                    className="mt-4 text-gray-400 text-xs flex items-center gap-2 cursor-pointer hover:text-white transition-colors py-2 border-t border-white/5"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                    {doctorNotes.filter(n => n.entryId === entry.id).length > 0 ? 'Continuar conversa...' : 'Deixar nota para o doutor'}
                                                </div>
                                            )}

                                            {entry.energy && (
                                                <div className="inline-flex items-center gap-1 bg-blue-900/20 border border-blue-900/30 px-3 py-1.5 rounded-lg mb-4">
                                                    <span className="text-orange-400 text-xs">⚡</span>
                                                    <span className="text-blue-300 text-xs font-bold">Energy: {entry.energy}/10</span>
                                                </div>
                                            )}
                                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-light break-words overflow-hidden [overflow-wrap:anywhere]">
                                                {entry.text}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === 'stats' && (
                    <div className="p-6 md:p-10 max-w-5xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-6">{t.stats}</h2>
                        <Analytics entries={entries} lang={lang} />
                    </div>
                )}

                {view === 'settings' && (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-white">{t.accountSettings}</h2>
                        <div className="bg-[#111] p-6 rounded-xl border border-white/5">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-4 block">{t.language}</label>
                            <div className="grid grid-cols-4 gap-4">
                                {(['pt', 'en', 'es', 'fr'] as const).map(l => (
                                    <button
                                        key={l}
                                        onClick={() => updateUserLanguage(l)}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${user.language === l ? 'bg-white text-black' : 'bg-black border border-white/10 text-gray-500 hover:text-white'}`}
                                    >
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#111] p-6 rounded-xl border border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white font-bold text-xl">
                                    {user.name[0].toUpperCase()}
                                </div>
                                <div>
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary"
                                                value={editNameValue}
                                                onChange={e => setEditNameValue(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={handleUpdateName} className="text-green-500 hover:text-green-400">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:text-red-400">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <h3 className="text-white font-bold">{user.name}</h3>
                                            <button
                                                onClick={() => { setEditNameValue(user.name); setIsEditingName(true); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-gray-500 text-sm">{user.email}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-4 border-t border-white/5">
                                <span className="text-gray-400 text-sm">{t.role}</span>
                                <span className="bg-[#222] text-xs px-2 py-1 rounded text-gray-300 uppercase font-bold">{user.role}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-t border-white/5">
                                <span className="text-gray-400 text-sm">Member Since</span>
                                <span className="text-white text-sm font-mono">{new Date(user.joinedAt).toLocaleDateString()}</span>
                            </div>
                            <Button variant="secondary" onClick={storageService.logout} className="w-full mt-4 bg-[#222] border-none hover:bg-[#333] text-white h-10 text-sm">{t.signOut}</Button>
                            <button onClick={() => { if (confirm(t.deleteConfirm)) storageService.deleteAccount(user.id); }} className="w-full mt-2 text-xs text-red-500 hover:text-red-400 py-2 opacity-60 hover:opacity-100 transition-opacity">
                                {t.deleteAccount}
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <BottomNav currentView={view} onViewChange={setView} />

            {showEntryForm && user && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-xl h-auto flex items-center justify-center" onClick={(e) => {
                        if (e.target === e.currentTarget) setShowEntryForm(false);
                    }}>
                        <EntryForm
                            userId={user.id}
                            userRole={user.role}
                            onSave={handleSaveEntry}
                            onCancel={() => setShowEntryForm(false)}
                            initialMode={entryMode}
                            lang={lang}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
