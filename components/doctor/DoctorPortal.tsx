import React, { useState, useEffect, useRef } from 'react';
import { MOODS, TRANSLATIONS } from '../../constants';
import { storageService } from '../../services/storageService';
import { aiService } from '../../services/aiService';
import { MoodEntry, User, DoctorNote, Language, UserRole, Notification } from '../../types';
import { Button } from '../ui/Button';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { NotificationPanel } from '../ui/NotificationPanel';

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

import { ExportReportModal } from './ExportReportModal';

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ user, onLogout }) => {
    const [patients, setPatients] = useState<User[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientEntries, setPatientEntries] = useState<MoodEntry[]>([]);
    const [portalView, setPortalView] = useState<'clinical' | 'administrative'>(user.role === UserRole.CLINIC_ADMIN ? 'administrative' : 'clinical');
    const [viewMode, setViewMode] = useState<'dashboard' | 'clinic'>(user.role === UserRole.CLINIC_ADMIN ? 'clinic' : 'dashboard');
    const [isConnecting, setIsConnecting] = useState(false);
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [connectEmail, setConnectEmail] = useState('');
    const chartScrollRef = useRef<HTMLDivElement>(null);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

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

    const [clinics, setClinics] = useState<any[]>([]);
    const [newClinicName, setNewClinicName] = useState('');
    const [isCreatingClinic, setIsCreatingClinic] = useState(false);

    const [aiSummary, setAiSummary] = useState<any | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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
            // Log entry view for audit
            storageService.logAudit(user.id, 'VIEW_PATIENT_DASHBOARD', selectedPatientId);

            // Entries (Realtime)
            const unsubEntries = storageService.subscribeEntries(selectedPatientId, (data) => {
                const unlockedEntries = data.filter(e => !e.isLocked || (e.permissions && e.permissions.includes(user.id)));
                setPatientEntries(unlockedEntries);
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

            // Reset AI Summary on patient change
            setAiSummary(null);

            return () => {
                unsubEntries();
                unsubNotes();
            };
        }
    }, [selectedPatientId, user.id]);

    useEffect(() => {
        if (viewMode === 'clinic') {
            storageService.getClinics(user.id).then(setClinics);
        }
    }, [viewMode, user.id]);

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
            authorRole: 'PROFESSIONAL',
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

        const currentComment = entryComment;
        try {
            // Get or Create Thread for this specific pair/specialty
            const thread = await storageService.getOrCreateThread(selectedPatientId, user.id, user.clinicalRole || 'psychologist');

            const newNote: DoctorNote = {
                id: crypto.randomUUID(),
                doctorId: user.id,
                doctorName: user.name,
                doctorRole: user.role,
                patientId: selectedPatientId,
                entryId,
                threadId: thread.id,
                text: entryComment,
                isShared: true,
                authorRole: 'PROFESSIONAL',
                read: false,
                createdAt: new Date().toISOString()
            };

            await storageService.saveDoctorNote(newNote);
            setEntryComment('');
            setCommentingEntryId(null);

            // Refresh notes for current patient (Subscription also handles this, but explicit refresh for immediate feedback)
            const patientNotes = await storageService.getNotes(user.id, selectedPatientId);
            setNotes(patientNotes);
        } catch (err) {
            console.error("Fail to save threaded comment", err);
            setEntryComment(currentComment);
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

    const handleExportDataCsv = () => {
        if (!selectedPatientId) return;
        const entriesToExport = patientEntries;

        // CSV Export
        const headers = ['Data', 'Humor', 'Energia', 'Texto', 'Tags'];
        const csvContent = [
            headers.join(','),
            ...entriesToExport.map(e => [
                new Date(e.timestamp).toLocaleDateString(),
                e.mood || '-',
                e.energy || '-',
                `"${e.text.replace(/"/g, '""')}"`,
                `"${e.tags.join(', ')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_paciente_${selectedPatientId}.csv`;
        link.click();
    };

    const handleExportPDF = () => {
        if (!selectedPatientId) return;
        const patient = patients.find(p => p.id === selectedPatientId);
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(124, 58, 237); // Brand Primary
        doc.text('MoodFlow Enterprise', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Relatório Clínico de Evolução - ${new Date().toLocaleDateString()}`, 14, 30);

        doc.setDrawColor(200);
        doc.line(14, 35, 196, 35);

        // Patient Info
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Paciente: ${patient?.name || 'N/A'}`, 14, 45);
        doc.setFontSize(10);
        doc.text(`Email: ${patient?.email || 'N/A'}`, 14, 50);
        doc.text(`Responsável: Dr(a). ${user.name}`, 14, 55);

        // Summary if available
        let startY = 65;
        if (aiSummary) {
            doc.setFontSize(11);
            doc.setTextColor(124, 58, 237);
            doc.text('Resumo Clínico (AI):', 14, startY);
            doc.setFontSize(9);
            doc.setTextColor(50);
            const splitSummary = doc.splitTextToSize(aiSummary.summaryText, 180);
            doc.text(splitSummary, 14, startY + 7);
            startY += (splitSummary.length * 5) + 15;
        }

        // Table
        const tableColumn = ["Data", "Humor", "Energia", "Tags", "Relato"];
        const tableRows = patientEntries.map(e => [
            new Date(e.timestamp).toLocaleDateString(),
            e.moodLabel || e.mood || '-',
            e.energy || '-',
            e.tags.join(', '),
            e.text.length > 50 ? e.text.substring(0, 47) + '...' : e.text
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: startY,
            theme: 'striped',
            headStyles: { fillColor: [124, 58, 237] },
            styles: { fontSize: 8 },
            columnStyles: {
                4: { cellWidth: 80 }
            }
        });

        doc.save(`relatorio_${patient?.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const handleExportXLSX = () => {
        if (!selectedPatientId) return;
        const patient = patients.find(p => p.id === selectedPatientId);

        const data = patientEntries.map(e => ({
            'Data': new Date(e.timestamp).toLocaleDateString(),
            'Humor': e.moodLabel || e.mood || '-',
            'Energia': e.energy || '-',
            'Tags': e.tags.join(', '),
            'Relato': e.text
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");

        XLSX.writeFile(wb, `relatorio_${patient?.name.replace(/\s+/g, '_')}.xlsx`);
    };



    const getClinicalTrends = () => {
        if (patientEntries.length < 2) return null;
        const now = new Date().getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        const last7Days = patientEntries.filter(e => e.timestamp > now - weekMs && e.mood !== null);
        const prev7Days = patientEntries.filter(e => e.timestamp <= now - weekMs && e.timestamp > now - (2 * weekMs) && e.mood !== null);

        const avg7 = last7Days.length ? last7Days.reduce((acc, curr) => acc + (curr.mood || 0), 0) / last7Days.length : null;
        const avgPrev = prev7Days.length ? prev7Days.reduce((acc, curr) => acc + (curr.mood || 0), 0) / prev7Days.length : null;

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (avg7 && avgPrev) {
            const diff = avg7 - avgPrev;
            if (diff > 0.5) trend = 'improving';
            else if (diff < -0.5) trend = 'declining';
        }

        // Detect Instability (high variance)
        let isUnstable = false;
        if (last7Days.length > 3) {
            const moods = last7Days.map(e => e.mood || 0);
            const mean = avg7 || 0;
            const variance = moods.reduce((acc, m) => acc + Math.pow(m - mean, 2), 0) / moods.length;
            if (variance > 1.5) isUnstable = true;
        }

        return { avg7, avgPrev, trend, isUnstable };
    };

    const handleGenerateAISummary = async () => {
        if (!patientEntries.length || !selectedPatientId) return;
        setIsGeneratingSummary(true);
        try {
            const summary = await aiService.summarizeHistory(patientEntries);
            setAiSummary(summary);
            storageService.logAudit(user.id, 'GENERATE_AI_SUMMARY', selectedPatientId);
        } catch (error) {
            console.error("AI Summary generation failed:", error);
            alert("Falha ao gerar resumo de IA. Verifique sua conexão ou chave de API.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    useEffect(() => {
        if (user) {
            const unsub = storageService.subscribeNotifications(user.id, (data) => setNotifications(data));
            return () => unsub();
        }
    }, [user]);

    const handleCreateClinic = async () => {
        if (!newClinicName.trim()) return;
        setIsCreatingClinic(true);
        try {
            await storageService.createClinic(newClinicName, user.id);
            setNewClinicName('');
            const updated = await storageService.getClinics(user.id);
            setClinics(updated);
            alert("Clínica criada com sucesso!");
        } catch (error) {
            console.error("Failed to create clinic:", error);
            alert("Erro ao criar clínica. Verifique as permissões.");
        } finally {
            setIsCreatingClinic(false);
        }
    };

    const getFilteredEntries = () => {
        // Filter out patientEntries with null mood for the chart (Diary/Voice)
        const validEntries = patientEntries.filter(e => {
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
            <aside className={`w-full md:w-80 bg-surfaceHighlight border-r border-neutral-800 flex flex-col flex-shrink-0 md:h-full absolute md:relative z-20 h-full transition-transform duration-300 ${selectedPatientId && portalView === 'clinical' ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                <div className="p-6 border-b border-neutral-800">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="font-black text-xl md:text-2xl text-primary mb-1">MoodFlow <span className="text-xs text-white bg-primary px-2 py-0.5 rounded ml-1">PRO</span></h1>
                        <button onClick={onLogout} className="md:hidden p-2 text-textMuted">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>

                    {/* Navigation Areas Switcher - Visible only to Admins */}
                    {user.role === UserRole.CLINIC_ADMIN && (
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
                            <button
                                onClick={() => { setPortalView('clinical'); setViewMode('dashboard'); setSelectedPatientId(null); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${portalView === 'clinical' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                <span>🧠</span> Clínica
                            </button>
                            <button
                                onClick={() => { setPortalView('administrative'); setViewMode('clinic'); setSelectedPatientId(null); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${portalView === 'administrative' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                <span>🏢</span> Adm
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-xs md:text-sm text-textMuted">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        {user.clinicalRole === 'psychologist' ? 'Psicólogo(a)' : user.clinicalRole === 'psychiatrist' ? 'Psiquiatra' : 'Profissional'} {user.name}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {portalView === 'clinical' ? (
                        <>
                            <div className="p-4 bg-neutral-900/30 border-b border-neutral-800 mx-2 my-2 rounded-xl">
                                <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">{t.connectPatient}</h3>
                                <form onSubmit={handleConnectPatient} className="flex gap-2">
                                    <input type="email" placeholder={t.enterPatientEmail} required value={connectEmail} onChange={e => setConnectEmail(e.target.value)} className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none min-w-0" />
                                    <button type="submit" className="bg-primary text-white px-3 rounded-lg text-sm font-bold">+</button>
                                </form>
                            </div>
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
                        </>
                    ) : (
                        <div className="p-4 space-y-2">
                            <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-4">Gestão Administrativa</div>
                            <button
                                onClick={() => setViewMode('clinic')}
                                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${viewMode === 'clinic' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span className="text-lg">🏥</span>
                                <span className="text-sm font-bold">Minha Clínica</span>
                            </button>
                            <button
                                className="w-full text-left p-3 rounded-xl flex items-center gap-3 text-gray-400 hover:bg-white/5 hover:text-white transition-all opacity-50 cursor-not-allowed"
                                title="Em breve"
                            >
                                <span className="text-lg">👥</span>
                                <span className="text-sm font-bold">Profissionais</span>
                            </button>
                            <button
                                className="w-full text-left p-3 rounded-xl flex items-center gap-3 text-gray-400 hover:bg-white/5 hover:text-white transition-all opacity-50 cursor-not-allowed"
                                title="Em breve"
                            >
                                <span className="text-lg">📊</span>
                                <span className="text-sm font-bold">Relatórios B2B</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="hidden md:block p-4 border-t border-neutral-800">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsNotificationPanelOpen(true)}
                            className="relative p-2 rounded-xl bg-surface/50 border border-white/5 hover:bg-surface transition-all group"
                        >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {notifications.filter(n => !n.readAt).length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 text-[9px] font-black items-center justify-center text-white">
                                        {notifications.filter(n => !n.readAt).length}
                                    </span>
                                </span>
                            )}
                        </button>
                        <Button variant="outline" className="h-10 text-xs gap-2 border-white/5" onClick={onLogout}>
                            Logout
                        </Button>
                    </div>

                    <NotificationPanel
                        userId={user.id}
                        isOpen={isNotificationPanelOpen}
                        onClose={() => setIsNotificationPanelOpen(false)}
                    />
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

                {!selectedPatientId && viewMode === 'dashboard' ? (
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
                    <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 print:overflow-visible h-full">
                        {/* Professional Report Header (Print Only) */}
                        <div className="report-header hidden print:block space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h1 className="report-logo">MoodFlow</h1>
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Relatório Clínico de Evolução</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Gerado por Dr(a). {user.name}</p>
                                </div>
                            </div>
                            <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 mt-8">
                                <h2 className="text-xl font-black mb-1">{patients.find(p => p.id === selectedPatientId)?.name}</h2>
                                <p className="text-xs text-gray-500">{patients.find(p => p.id === selectedPatientId)?.email}</p>
                            </div>
                        </div>

                        <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:p-0">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-neutral-800 pb-6 gap-4">
                                <div>
                                    <h1 className="text-xl md:text-2xl font-black text-white tracking-tight px-1 flex items-center gap-3">
                                        {portalView === 'clinical' ? 'Área Clínica' : 'Área Administrativa'}
                                    </h1>
                                    {viewMode === 'dashboard' && selectedPatientId && (
                                        <>
                                            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                                                {patients.find(p => p.id === selectedPatientId)?.name}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-2 print:hidden">
                                                <span className="bg-neutral-800 text-xs px-2 py-1 rounded text-gray-400">{patients.find(p => p.id === selectedPatientId)?.email}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {viewMode === 'dashboard' && selectedPatientId && (
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider">{t.visibleEntries}</div>
                                        <div className="text-2xl md:text-3xl font-light text-white">{patientEntries.length}</div>
                                    </div>
                                )}
                            </div>

                            {viewMode === 'clinic' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Clinic Creation */}
                                    <div className="md:col-span-1 space-y-6">
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800 shadow-xl space-y-4">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.newClinic}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed">Expandir sua operação permite gerir múltiplos profissionais e centralizar o faturamento corporate.</p>
                                            <input
                                                type="text"
                                                value={newClinicName}
                                                onChange={(e) => setNewClinicName(e.target.value)}
                                                placeholder="Nome da Clínica"
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                            <Button
                                                onClick={handleCreateClinic}
                                                disabled={isCreatingClinic || !newClinicName.trim()}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                                            >
                                                {isCreatingClinic ? 'Criando...' : t.createUnit}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Clinic List */}
                                    <div className="md:col-span-2 space-y-6">
                                        <h2 className="text-lg font-bold text-white px-2">{t.yourClinics}</h2>
                                        {clinics.length === 0 ? (
                                            <div className="bg-surface p-12 rounded-3xl border border-dashed border-neutral-800 flex flex-col items-center text-center">
                                                <span className="text-4xl mb-4">🏥</span>
                                                <p className="text-gray-500">Você ainda não faz parte de nenhuma clínica.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {clinics.map((membership, idx) => (
                                                    <div key={idx} className="bg-surface p-6 rounded-3xl border border-neutral-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-3">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${membership.role === 'admin' ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-gray-400'}`}>
                                                                {membership.role}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{membership.clinics.name}</h4>
                                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">ID: {membership.clinics.id.slice(0, 8)}...</p>
                                                        <div className="mt-6 flex gap-2">
                                                            <Button variant="ghost" className="h-8 text-[10px] uppercase font-black px-3">Configurar</Button>
                                                            <Button variant="ghost" className="h-8 text-[10px] uppercase font-black px-3">Profissionais</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Clinical Insights & Alerts */}
                                    {getClinicalTrends() && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${getClinicalTrends()?.trend === 'improving' ? 'bg-green-500/10 text-green-400' : getClinicalTrends()?.trend === 'declining' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        {getClinicalTrends()?.trend === 'improving' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
                                                        {getClinicalTrends()?.trend === 'declining' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />}
                                                        {getClinicalTrends()?.trend === 'stable' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />}
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase font-bold text-textMuted">Tendência (7d)</div>
                                                    <div className="font-bold text-white capitalize">
                                                        {getClinicalTrends()?.trend === 'improving' ? 'Melhora Gradual' : getClinicalTrends()?.trend === 'declining' ? 'Queda de Humor' : 'Estabilidade'}
                                                    </div>
                                                </div>
                                            </div>

                                            {getClinicalTrends()?.isUnstable && (
                                                <div className="bg-orange-950/20 border border-orange-500/30 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                                                    <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl">
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-bold text-orange-400">Alerta de Risco</div>
                                                        <div className="font-bold text-white">Instabilidade Emocional</div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center gap-4">
                                                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl font-black text-lg">
                                                    {getClinicalTrends()?.avg7?.toFixed(1)}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase font-bold text-textMuted">Média Atual (7d)</div>
                                                    <div className="text-xs text-gray-400">Antiga: {getClinicalTrends()?.avgPrev?.toFixed(1) || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <div className="xl:col-span-2 space-y-8">
                                            <div className="bg-surface p-4 md:p-6 rounded-3xl border border-neutral-800 h-[450px] md:h-[500px] shadow-2xl relative overflow-hidden flex flex-col">
                                                <div className="flex flex-col gap-4 mb-6">
                                                    <h3 className="text-sm font-bold text-textMuted uppercase tracking-wider">{t.moodProgression}</h3>
                                                    <div className="flex flex-wrap gap-3 items-center">
                                                        <div className="flex bg-neutral-900 rounded-lg p-1">
                                                            <button onClick={() => setChartViewMode('day')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartViewMode === 'day' ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{t.viewDay}</button>
                                                            <button onClick={() => setChartViewMode('week')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartViewMode === 'week' ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{t.days7}</button>
                                                            <button onClick={() => setChartViewMode('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartViewMode === 'month' ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{t.viewMonth}</button>
                                                        </div>

                                                        {/* Dynamic Time Selectors */}
                                                        {chartViewMode === 'day' && (
                                                            <div className="animate-in fade-in slide-in-from-left-2">
                                                                <input
                                                                    type="date"
                                                                    value={selectedDate}
                                                                    onChange={(e) => setSelectedDate(e.target.value)}
                                                                    className="bg-neutral-900 border border-neutral-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors uppercase tracking-wider"
                                                                />
                                                            </div>
                                                        )}

                                                        {chartViewMode === 'month' && (
                                                            <div className="animate-in fade-in slide-in-from-left-2">
                                                                <input
                                                                    type="month"
                                                                    value={selectedMonth}
                                                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                                                    className="bg-neutral-900 border border-neutral-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors uppercase tracking-wider"
                                                                />
                                                            </div>
                                                        )}
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

                                            {/* AI Clinical Insights Section */}
                                            <div className="bg-gradient-to-br from-neutral-900 to-indigo-950/20 p-6 md:p-8 rounded-3xl border border-indigo-500/20 shadow-2xl space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl">✨</div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.clinicalAiInsights}</h3>
                                                            <p className="text-[10px] text-indigo-300/60 uppercase font-black">Powered by Gemini 1.5</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={() => setIsExportModalOpen(true)}
                                                        className="h-10 px-4 bg-neutral-800 hover:bg-neutral-700 text-white/70 border border-white/5 gap-2"
                                                    >
                                                        <span>📄</span> Relatórios
                                                    </Button>
                                                    <Button
                                                        onClick={handleGenerateAISummary}
                                                        disabled={isGeneratingSummary || patientEntries.length === 0}
                                                        className={`h-10 px-6 gap-2 print:hidden ${isGeneratingSummary ? 'opacity-50' : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
                                                    >
                                                        {isGeneratingSummary ? (
                                                            <>
                                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                Analisando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                {t.generateClinicalSummary}
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>

                                                {!aiSummary && !isGeneratingSummary && (
                                                    <div className="py-10 border border-dashed border-indigo-500/10 rounded-2xl flex flex-col items-center justify-center text-center px-6 print:hidden">
                                                        <p className="text-gray-500 text-sm max-w-sm">Use a inteligência artificial para identificar padrões comportamentais, riscos e recomendações com base nos últimos 30 registros.</p>
                                                    </div>
                                                )}

                                                {aiSummary && (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">{t.executiveSummary}</label>
                                                                <p className="text-sm text-gray-300 leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5">{aiSummary.summaryText}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                                                                <div className={`w-3 h-3 rounded-full ${aiSummary.riskLevel === 'high' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : aiSummary.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500 uppercase font-bold block">{t.riskLevel}</span>
                                                                    <span className="text-sm font-bold text-white uppercase">{aiSummary.riskLevel === 'high' ? t.riskLevels.high : aiSummary.riskLevel === 'medium' ? t.riskLevels.medium : t.riskLevels.low}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">{t.identifiedPatterns}</label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {aiSummary.patterns.map((p: string, i: number) => (
                                                                        <span key={i} className="bg-indigo-500/10 text-indigo-200 text-[11px] px-3 py-1 rounded-full border border-indigo-500/10">{p}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">{t.clinicalRecommendations}</label>
                                                                <ul className="space-y-2">
                                                                    {aiSummary.recommendations.map((r: string, i: number) => (
                                                                        <li key={i} className="text-xs text-gray-400 flex gap-2">
                                                                            <span className="text-indigo-500">•</span> {r}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
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
                                                    {patientEntries.length === 0 ? <p className="text-neutral-600 italic">No unlocked entries.</p> : patientEntries.slice(0, 10).map(entry => {
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
                                                                                    <div className={`max-w-[85%] p-2 rounded-xl text-xs break-words overflow-hidden [overflow-wrap:anywhere] whitespace-pre-wrap ${note.authorRole === 'PATIENT' ? 'bg-neutral-800 text-gray-300' : 'bg-blue-900/30 text-blue-100 border border-blue-900/50'}`}>
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
                                                                                <Button className={`h-10 text-xs flex-1 sm:flex-none ${user.clinicalRole === 'psychologist' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'bg-[#10b981] hover:bg-[#059669]'}`} onClick={() => handleSaveEntryComment(entry.id)}>Send</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => setCommentingEntryId(entry.id)} className={`mt-3 text-xs font-bold hover:opacity-80 ${user.clinicalRole === 'psychologist' ? 'text-[#8b5cf6]' : 'text-[#10b981]'}`}>
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
                                </>
                            )}
                        </div>
                    </div>
                )
                }
            </main >

            {/* EXPORT MODAL */}
            {selectedPatientId && (
                <ExportReportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    entries={patientEntries}
                    notes={notes}
                    userRole={user.role || ''}
                    userName={user.name || 'Doutor'}
                    patientName={patients.find(p => p.id === selectedPatientId)?.name || 'Paciente'}
                />
            )}
        </div >
    );
};
