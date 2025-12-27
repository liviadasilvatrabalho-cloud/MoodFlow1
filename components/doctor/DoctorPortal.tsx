
import React, { useState, useEffect, useRef } from 'react';
import { MOODS, TRANSLATIONS } from '../../constants';
import { storageService } from '../../services/storageService';
import { MoodEntry, User, DoctorNote, Language, UserRole } from '../../types';
import { Button } from '../ui/Button';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DoctorPortalProps {
    user: User;
    onLogout: () => void;
}

const CustomizedDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
        <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24" className="overflow-visible drop-shadow-md cursor-pointer hover:scale-125 transition-transform z-50">
            <text x="50%" y="50%" dy=".3em" textAnchor="middle" fontSize="20">
                {payload.emoji || '•'}
            </text>
        </svg>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const dateObj = new Date(data.timestamp);
        return (
            <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl shadow-2xl max-w-[250px] z-50">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{data.emoji}</span>
                    <div>
                        <p className="text-white font-bold">{data.moodLabel}</p>
                        <p className="text-xs text-textMuted capitalize">{dateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                        <p className="text-xs text-primary font-bold">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Energy</span>
                        <span className="text-blue-400 font-bold">{data.energy}/10</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ user, onLogout }) => {
    const [patients, setPatients] = useState<User[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [entries, setEntries] = useState<MoodEntry[]>([]);
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [connectEmail, setConnectEmail] = useState('');
    const chartScrollRef = useRef<HTMLDivElement>(null);

    const [isRecording, setIsRecording] = useState(false);

    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [detailedNotifications, setDetailedNotifications] = useState<Array<{ patient: User, note: DoctorNote }>>([]);

    const [chartViewMode, setChartViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    });
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

    const [commentingEntryId, setCommentingEntryId] = useState<string | null>(null);
    const [entryComment, setEntryComment] = useState('');

    const lang: Language = user.language || 'pt';
    const t = TRANSLATIONS[lang];
    const recognitionRef = useRef<any>(null);

    // Initial Load & Polling
    useEffect(() => {
        loadDashboard();
        const interval = setInterval(loadDashboard, 15000);
        return () => clearInterval(interval);
    }, [user.id]);

    const loadDashboard = async () => {
        // 1. Fetch Dashboard View
        const dashboardRows = await storageService.getMedicalDashboard(user.id);

        // Map View Rows to Patient Objects for sidebar
        const patientList = dashboardRows.map(row => ({
            id: row.patient_id,
            name: row.patient_name || 'Unknown',
            email: row.patient_email || 'No Email',
            role: UserRole.PATIENT,
            language: 'pt', // View doesn't have lang yet, default
            joinedAt: new Date().toISOString()
        }));

        setPatients(patientList);
        // Unread counts could come from view later, keeping simplistic for now
    };

    // When selecting a patient - Subscribe + Fetch Charts
    useEffect(() => {
        if (selectedPatientId) {
            // Entries (Realtime)
            const unsubEntries = storageService.subscribeEntries(selectedPatientId, (data) => {
                const unlockedEntries = data.filter(e => !e.isLocked);
                setEntries(unlockedEntries);
            });

            // Notes (Realtime)
            const unsubNotes = storageService.subscribeNotes(user.id, selectedPatientId, (data) => {
                setNotes(data);
                console.log("Doctor received notes:", data.length);
            });

            // Fetch Charts from 'charts' table (New!)
            loadPatientCharts(selectedPatientId);

            // Mark Read
            storageService.markNotesAsRead(user.id, selectedPatientId, 'DOCTOR');

            return () => {
                unsubEntries();
                unsubNotes();
            }
        }
    }, [selectedPatientId, user.id]);

    const [precomputedChartData, setPrecomputedChartData] = useState<any[]>([]);

    const loadPatientCharts = async (pid: string) => {
        const charts = await storageService.getPatientCharts(pid);
        if (charts.length > 0) {
            // Assuming chart JSONB structure matches Recharts expectation
            setPrecomputedChartData(charts[0].data);
        } else {
            setPrecomputedChartData([]);
        }
    };



    const toggleRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Browser does not support speech recognition");
            return;
        }

        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = lang === 'pt' ? 'pt-BR' : 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (commentingEntryId) {
                    setEntryComment(prev => prev + ' ' + transcript);
                } else {
                    setNewNote(prev => prev + ' ' + transcript);
                }
                setIsRecording(false);
            };

            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    const handleConnectPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await storageService.connectPatient(user.id, connectEmail);
        if (result.success) {
            loadDashboard();
            setConnectEmail('');
            alert("Success");
        } else {
            alert((t as any)[result.message] || result.message);
        }
    };

    const handleSavePrivateNote = async () => {
        if (!newNote.trim() || !selectedPatientId) return;
        const note: DoctorNote = {
            id: crypto.randomUUID(),
            doctorId: user.id,
            patientId: selectedPatientId,
            text: newNote,
            isShared: false,
            authorRole: 'DOCTOR',
            read: true,
            createdAt: new Date().toISOString()
        };

        // Optimistic update
        setNotes(prev => [...prev, note]);
        const currentNote = newNote;
        setNewNote('');

        try {
            await storageService.saveDoctorNote(note);
        } catch (error) {
            console.error("Error saving private note:", error);
            setNewNote(currentNote); // Restore text on failure
        }
    };

    const handleSaveEntryComment = async (entryId: string) => {
        if (!entryComment.trim() || !selectedPatientId) return;
        const note: DoctorNote = {
            id: crypto.randomUUID(),
            doctorId: user.id,
            patientId: selectedPatientId,
            entryId: entryId,
            text: entryComment,
            isShared: true,
            authorRole: 'DOCTOR',
            read: false,
            createdAt: new Date().toISOString()
        };

        // Optimistic update
        setNotes(prev => [...prev, note]);
        const currentComment = entryComment;
        setEntryComment('');
        setCommentingEntryId(null);

        try {
            await storageService.saveDoctorNote(note);
        } catch (error) {
            console.error("Error saving entry comment:", error);
            setEntryComment(currentComment); // Restore text on failure
        }
    };

    const handleNotificationClick = (patientId: string, entryId?: string) => {
        setSelectedPatientId(patientId);
        if (entryId) {
            setTimeout(() => {
                const el = document.getElementById(`doc-entry-${entryId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-primary');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
                }
            }, 500);
        }
    };

    const getFilteredEntries = () => {
        // Filter out entries with null mood for the chart (Diary/Voice)
        const validEntries = entries.filter(e => {
            const isMood = e.entryMode === 'mood' || (!e.entryMode && e.mood !== null);
            return isMood && e.mood !== null && e.mood !== undefined;
        });
        const sorted = [...validEntries].sort((a, b) => a.timestamp - b.timestamp);

        if (chartViewMode === 'day') {
            return sorted.filter(e => {
                const d = new Date(e.timestamp);
                const offset = d.getTimezoneOffset() * 60000;
                const localISODate = new Date(d.getTime() - offset).toISOString().slice(0, 10);
                return localISODate === selectedDate;
            });
        } else if (chartViewMode === 'month') {
            return sorted.filter(e => {
                const d = new Date(e.timestamp);
                const offset = d.getTimezoneOffset() * 60000;
                const localISOMonth = new Date(d.getTime() - offset).toISOString().slice(0, 7);
                return localISOMonth === selectedMonth;
            });
        } else {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
            return sorted.filter(e => e.timestamp >= sevenDaysAgo);
        }
    };

    const filteredChartData = getFilteredEntries().map(e => {
        const d = new Date(e.timestamp);
        const moodVal = Number(e.mood);
        const moodObj = MOODS.find(m => m.value === moodVal);
        return {
            ...e,
            timestamp: e.timestamp,
            mood: moodVal,
            emoji: moodObj?.emoji || '❓',
            moodLabel: moodObj?.label || e.moodLabel,
        };
    });

    // Updated render logic for Charts:
    // We prioritize the client-side filteredChartData as it is GUARANTEED to respect privacy (e.isLocked filters)
    // The precomputed backend charts might not respect privacy yet, so we only use them as a secondary source if we can verify them.
    // For now, let's favor safety.
    const chartDataToRender = filteredChartData;

    // Auto-scroll to end on mobile when data changes
    useEffect(() => {
        if (chartScrollRef.current && window.innerWidth < 768) {
            const el = chartScrollRef.current;
            el.scrollLeft = el.scrollWidth;
            const timer = setTimeout(() => {
                el.scrollLeft = el.scrollWidth;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [chartDataToRender.length, chartViewMode]);

    const formatXAxis = (tickItem: number) => {
        const d = new Date(tickItem);
        if (chartViewMode === 'day') {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };

    const displayedPrivateNotes = notes.filter(n => !n.isShared);

    return (
        <div className="min-h-screen md:h-screen w-full bg-background text-textMain flex flex-col md:flex-row overflow-hidden">
            <aside className={`w-full md:w-80 bg-surfaceHighlight border-r border-neutral-800 flex flex-col flex-shrink-0 md:h-full absolute md:relative z-20 h-full transition-transform duration-300 ${selectedPatientId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                    <div>
                        <h1 className="font-black text-xl md:text-2xl text-primary mb-1">MoodFlow <span className="text-xs text-white bg-primary px-2 py-0.5 rounded ml-1">PRO</span></h1>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-textMuted">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Dr. {user.name}
                        </div>
                    </div>
                    <button onClick={onLogout} className="md:hidden p-2 text-textMuted">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
                <div className="p-4 bg-neutral-900/50 border-b border-neutral-800">
                    <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">{t.connectPatient}</h3>
                    <form onSubmit={handleConnectPatient} className="flex gap-2">
                        <input type="email" placeholder={t.enterPatientEmail} required value={connectEmail} onChange={e => setConnectEmail(e.target.value)} className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:border-primary focus:outline-none min-w-0" />
                        <button type="submit" className="bg-primary text-white px-3 rounded-lg text-sm font-bold">+</button>
                    </form>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4 text-[10px] font-bold text-textMuted uppercase tracking-wider sticky top-0 bg-surfaceHighlight/95 backdrop-blur-sm">{t.yourPatients}</div>
                    {patients.length === 0 && <p className="text-textMuted text-sm text-center italic p-4 opacity-50">{t.noPatients}</p>}
                    {patients.map(patient => (
                        <button key={patient.id} onClick={() => setSelectedPatientId(patient.id)} className={`w-full text-left p-4 hover:bg-white/5 transition-all border-l-4 flex justify-between items-center group ${selectedPatientId === patient.id ? 'border-primary bg-white/5' : 'border-transparent'}`}>
                            <div className="truncate pr-2 flex-1">
                                <div className="font-medium text-white group-hover:text-primary transition-colors truncate">{patient.name}</div>
                                <div className="text-xs text-textMuted mt-0.5 truncate">{patient.email}</div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="hidden md:block p-4 border-t border-neutral-800">
                    <button onClick={onLogout} className="flex items-center gap-2 text-textMuted hover:text-white text-sm w-full px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {t.signOut}
                    </button>
                </div>
            </aside>

            <main className="flex-1 h-full overflow-y-auto bg-black relative w-full">
                <div className="md:hidden p-4 border-b border-neutral-800 flex items-center gap-4 sticky top-0 bg-black/90 backdrop-blur z-10">
                    <button onClick={() => setSelectedPatientId(null)} className="text-white flex items-center gap-2 text-sm font-bold">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back to Patients
                    </button>
                    {selectedPatientId && <span className="text-xs text-gray-500">| {patients.find(p => p.id === selectedPatientId)?.name}</span>}
                </div>

                {!selectedPatientId ? (
                    <div className="h-full flex flex-col items-center justify-start p-8 md:p-12">
                        <div className="text-center mb-12 mt-12">
                            <div className="w-20 h-20 bg-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl">👨‍⚕️</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t.hello} Dr. {user.name}</h2>
                            <p className="text-textMuted">{t.selectPatient}</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-neutral-800 pb-6 gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">{patients.find(p => p.id === selectedPatientId)?.name}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="bg-neutral-800 text-xs px-2 py-1 rounded text-gray-400">{patients.find(p => p.id === selectedPatientId)?.email}</span>
                                </div>
                            </div>
                            <div className="flex gap-4 md:gap-8 w-full lg:w-auto justify-between lg:justify-end">
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider">{t.visibleEntries}</div>
                                    <div className="text-2xl md:text-3xl font-light text-white">{entries.length}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="xl:col-span-2 space-y-8">
                                <div className="bg-surface p-4 md:p-6 rounded-3xl border border-neutral-800 h-[450px] md:h-[500px] shadow-2xl relative overflow-hidden flex flex-col">
                                    <div className="flex flex-col gap-4 mb-6">
                                        <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider">{t.moodProgression}</h3>
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <div className="flex bg-neutral-900 rounded-lg p-1">
                                                <button onClick={() => setChartViewMode('day')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded transition-colors ${chartViewMode === 'day' ? 'bg-neutral-700 text-white' : 'text-gray-500'}`}>{t.viewDay}</button>
                                                <button onClick={() => setChartViewMode('week')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded transition-colors ${chartViewMode === 'week' ? 'bg-neutral-700 text-white' : 'text-gray-500'}`}>{t.days7}</button>
                                                <button onClick={() => setChartViewMode('month')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded transition-colors ${chartViewMode === 'month' ? 'bg-neutral-700 text-white' : 'text-gray-500'}`}>{t.viewMonth}</button>
                                            </div>
                                        </div>
                                    </div>

                                    {chartDataToRender.length > 0 ? (
                                        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden no-scrollbar cursor-grab active:cursor-grabbing select-none"
                                            ref={chartScrollRef}>
                                            <div style={{
                                                width: typeof window !== 'undefined' && window.innerWidth < 768 ? `${Math.max(100, filteredChartData.length * 60)}px` : '100%',
                                                height: '100%'
                                            }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartDataToRender} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="docMood" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                                        <XAxis
                                                            dataKey="timestamp"
                                                            type="category"
                                                            tickFormatter={formatXAxis}
                                                            stroke="#525252"
                                                            tick={{ fontSize: 10, fill: '#a3a3a3' }}
                                                            interval={0}
                                                            padding={{ left: 30, right: 30 }}
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={60}
                                                        />
                                                        <YAxis domain={[0, 6]} hide />
                                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                        <Area type="monotone" dataKey="mood" stroke="#7c3aed" strokeWidth={3} strokeLinecap="round" fill="url(#docMood)" dot={<CustomizedDot />} animationDuration={500} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-textMuted text-sm bg-neutral-900/30 rounded-2xl border border-dashed border-neutral-800 animate-pulse">
                                            <span className="text-4xl mb-2">📊</span>
                                            <p className="font-medium">{chartViewMode === 'day' ? 'Nenhum registro hoje' : 'Sem dados para este período'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Energy Levels Chart (New for Doctor) */}
                                <div className="bg-surface p-4 md:p-6 rounded-3xl border border-neutral-800 shadow-xl relative overflow-hidden">
                                    <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider mb-4">{t.energyLevels}</h3>
                                    <div className="h-[150px] w-full min-w-0">
                                        {filteredChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={filteredChartData}>
                                                    <defs>
                                                        <linearGradient id="docEnergy" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                                    <XAxis dataKey="timestamp" type="category" hide padding={{ left: 20, right: 20 }} />
                                                    <YAxis domain={[0, 10]} hide />
                                                    <Tooltip
                                                        content={<CustomTooltip />}
                                                        cursor={{ stroke: '#525252', strokeWidth: 1 }}
                                                    />
                                                    <Area type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} fill="url(#docEnergy)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-textMuted text-xs italic">Sem dados de energia</div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-textMuted uppercase mb-4 tracking-wider">{t.visibleEntries}</h3>
                                    <div className="space-y-3">
                                        {entries.length === 0 ? <p className="text-neutral-600 italic">No unlocked entries.</p> : entries.slice(0, 10).map(entry => {
                                            const moodObj = entry.mood ? MOODS.find(m => m.value === entry.mood) : null;
                                            const entryNotes = notes.filter(n => n.entryId === entry.id);

                                            return (
                                                <div key={entry.id} id={`doc-entry-${entry.id}`} className="bg-surface hover:bg-surfaceHighlight transition-colors p-4 md:p-5 rounded-2xl border border-neutral-800 flex gap-4 md:gap-5 items-start group relative">
                                                    <div className="text-2xl md:text-3xl flex-shrink-0">{moodObj?.emoji || '📖'}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 gap-1">
                                                            <span className={`font-bold text-sm truncate ${moodObj?.color || 'text-white'}`}>{moodObj?.label || 'Diary Entry'}</span>
                                                            <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">{new Date(entry.date).toLocaleDateString()} • {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mt-1 break-words overflow-hidden [overflow-wrap:anywhere]">{entry.text}</p>

                                                        {entryNotes.length > 0 && (
                                                            <div className="mt-4 space-y-3 border-t border-white/5 pt-3">
                                                                {entryNotes.map(note => (
                                                                    <div key={note.id} className={`flex flex-col ${note.authorRole === 'PATIENT' ? 'items-start' : 'items-end'}`}>
                                                                        <div className={`max-w-[85%] p-2 rounded-xl text-xs ${note.authorRole === 'PATIENT' ? 'bg-neutral-800 text-gray-300' : 'bg-blue-900/30 text-blue-100 border border-blue-900/50'}`}>
                                                                            <span className="font-bold block text-[10px] opacity-50 mb-1">{note.authorRole === 'PATIENT' ? 'Patient Reply' : 'Dr. ' + user.name}</span>
                                                                            {note.text}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {commentingEntryId === entry.id ? (
                                                            <div className="mt-4">
                                                                <div className="relative">
                                                                    <textarea className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-sm text-white focus:outline-none min-h-[80px]" placeholder="Write a comment..." value={entryComment} onChange={e => setEntryComment(e.target.value)} autoFocus />
                                                                    <button onClick={toggleRecording} className={`absolute right-2 bottom-2 p-1.5 rounded-full ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-white'}`}>
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                                    </button>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                                                                    <Button variant="ghost" className="h-10 text-xs flex-1 sm:flex-none" onClick={() => setCommentingEntryId(null)}>Cancel</Button>
                                                                    <Button className="h-10 text-xs bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none" onClick={() => handleSaveEntryComment(entry.id)}>Send</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setCommentingEntryId(entry.id)} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-400">
                                                                {entryNotes.length > 0 ? 'Reply to Thread' : 'Add Comment'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="xl:col-span-1">
                                <div className="bg-surfaceHighlight rounded-3xl border border-neutral-800 p-6 flex flex-col shadow-2xl min-h-[400px]">
                                    <h3 className="text-sm font-bold text-textMuted uppercase mb-4 flex items-center gap-2 tracking-wider"><span className="text-lg">📝</span> {t.clinicalNotes}</h3>
                                    <div className="mb-6 space-y-3 bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800">
                                        <div className="relative">
                                            <textarea className="w-full bg-transparent text-sm text-white focus:outline-none resize-none h-24 placeholder-gray-600 pr-8" placeholder="Confidential observation..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                                            <button onClick={toggleRecording} className={`absolute right-0 top-0 p-2 rounded-full ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-white'}`}>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-white/5 pt-3">
                                            <span className="text-[10px] text-gray-500">{isRecording ? t.micOn : t.micOff}</span>
                                            <Button onClick={handleSavePrivateNote} disabled={!newNote.trim()} className="py-1 px-4 text-xs h-8">Save</Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                        {displayedPrivateNotes.length === 0 && <p className="text-center text-textMuted text-xs italic pt-10 opacity-50">No private observations.</p>}
                                        {displayedPrivateNotes.map(note => (
                                            <div key={note.id} className="p-4 rounded-xl border bg-black border-white/5">
                                                <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere]">{note.text}</p>
                                                <div className="flex justify-between items-center mt-3">
                                                    <span className="text-[10px] opacity-50">PRIVATE</span>
                                                    <div className="text-[10px] text-gray-600 font-mono">{new Date(note.createdAt).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
