import React, { useState, useEffect, useRef } from 'react';
import { MOODS, TRANSLATIONS } from '../../constants';
import { storageService } from '../../services/storageService';
import { aiService } from '../../services/aiService';
import { MoodEntry, User, DoctorNote, Language, UserRole, ClinicalReport } from '../../types';
import { Button } from '../ui/Button';
import { AudioRecorder, AudioPlayer } from '../ui/AudioComponents';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface DoctorPortalProps {
    user: User;
    onLogout: () => void;
    isAdminPortal?: boolean;
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


export const DoctorPortal: React.FC<DoctorPortalProps> = ({ user, onLogout, isAdminPortal = false }) => {
    const [patients, setPatients] = useState<User[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientEntries, setPatientEntries] = useState<MoodEntry[]>([]);
    const [portalView, setPortalView] = useState<'clinical' | 'administrative'>(isAdminPortal ? 'administrative' : 'clinical');
    const [viewMode, setViewMode] = useState<'dashboard' | 'clinic' | 'professionals' | 'reports_b2b' | 'clinic_settings'>(isAdminPortal ? 'clinic' : 'dashboard');
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
    const [editingClinicName, setEditingClinicName] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [connectEmail, setConnectEmail] = useState('');
    const chartScrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isEditingAdmin, setIsEditingAdmin] = useState(false);
    const [adminEditData, setAdminEditData] = useState({ name: user.name, password: '' });

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
    const [clinicProfessionals, setClinicProfessionals] = useState<any[]>([]);
    const [isCreatingClinic, setIsCreatingClinic] = useState(false);
    const [b2bMetrics, setB2bMetrics] = useState<{
        totalPatients: number;
        totalSessions: number;
        averageRisk: 'BAIXO' | 'MÉDIO' | 'ALTO';
        engagementScore: number;
    }>({ totalPatients: 0, totalSessions: 0, averageRisk: 'BAIXO', engagementScore: 0 });

    const [aiSummary, setAiSummary] = useState<any | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    const [isSaving, setIsSaving] = useState(false);


    // --- CLINICAL REPORTS STATE (NEW) ---
    const [patientTab, setPatientTab] = useState<'dashboard' | 'reports'>('dashboard');
    const [clinicalReports, setClinicalReports] = useState<ClinicalReport[]>([]);
    const [isEditingReport, setIsEditingReport] = useState(false);
    const [editingReport, setEditingReport] = useState<{ id: string, title: string, reportType: 'avaliacao' | 'evolucao' | 'alta' | 'encaminhamento' | 'livre', content: string }>({
        id: '', title: '', reportType: 'evolucao', content: ''
    });

    // --- B2B STATE ---
    const [b2bFilterType, setB2bFilterType] = useState<'all' | 'month'>('month');
    const [b2bMonth, setB2bMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const lang: Language = user.language || 'pt';
    const t = TRANSLATIONS[lang];
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (viewMode === 'clinic' || viewMode === 'clinic_settings') {
            storageService.getClinics(user.id).then(setClinics);
        }
    }, [viewMode, user.id]);

    useEffect(() => {
        if (viewMode === 'professionals' && selectedClinicId) {
            storageService.getClinicProfessionals(selectedClinicId).then(setClinicProfessionals);
        }
    }, [viewMode, selectedClinicId]);

    // Calculate B2B Metrics
    useEffect(() => {
        if (viewMode === 'reports_b2b' && selectedClinicId && isAdminPortal) {
            const calculateMetrics = async () => {
                try {
                    // Use server-side aggregation for performance and security (Bypass RLS for agg)
                    let startDate: string | null = null;
                    let endDate: string | null = null;

                    if (b2bFilterType === 'month' && b2bMonth) {
                        const [year, month] = b2bMonth.split('-').map(Number);
                        const start = new Date(year, month - 1, 1);
                        const end = new Date(year, month, 0, 23, 59, 59, 999);

                        startDate = start.toISOString();
                        endDate = end.toISOString();
                    }

                    const data = await storageService.getClinicB2BMetrics(selectedClinicId, startDate, endDate);

                    setB2bMetrics({
                        totalPatients: data.totalPatients || 0,
                        totalSessions: data.totalSessions || 0,
                        averageRisk: data.averageRisk || 'BAIXO',
                        engagementScore: data.engagementScore || 0
                    });
                } catch (error) {
                    console.error('Failed to calculate B2B metrics:', error);
                }
            };
            calculateMetrics();
        }
    }, [viewMode, selectedClinicId, isAdminPortal, user.id, b2bFilterType, b2bMonth]);

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
            // State cleanup happens in onend
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = lang === 'pt' ? 'pt-BR' : 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let newTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        newTranscript += event.results[i][0].transcript + ' ';
                    }
                }

                if (newTranscript) {
                    if (commentingEntryId) {
                        setEntryComment(prev => (prev + ' ' + newTranscript).replace(/\s+/g, ' '));
                    } else {
                        setNewNote(prev => (prev + ' ' + newTranscript).replace(/\s+/g, ' '));
                    }
                }
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsRecording(false);
            };

            recognitionRef.current.start();
            setIsRecording(true);
        }
    };


    const loadPatients = async () => {
        try {
            if (isAdminPortal && selectedClinicId) {
                const data = await storageService.getClinicPatients(selectedClinicId);
                setPatients(data);
            } else {
                const data = await storageService.getPatientsForDoctor(user.id);
                setPatients(data);
            }
        } catch (error) {
            console.error("Failed to load patients:", error);
        }
    };

    useEffect(() => {
        loadPatients();
    }, [user.id, isAdminPortal, selectedClinicId]);

    const handleConnectPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await storageService.connectPatient(user.id, connectEmail);
        if (result.success) {
            loadPatients();
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
            authorRole: (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
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
            // Normalize clinical role to what DB expects (uppercase) - Default to PSICOLOGO as it's the primary role
            const specialty = (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? 'PSIQUIATRA' : 'PSICOLOGO';
            const thread = await storageService.getOrCreateThread(selectedPatientId, user.id, specialty);

            const newNote: DoctorNote = {
                id: crypto.randomUUID(),
                doctorId: user.id,
                doctorName: user.name,
                doctorRole: (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                patientId: selectedPatientId,
                entryId,
                threadId: thread.id,
                text: entryComment,
                isShared: true,
                authorRole: specialty === 'PSIQUIATRA' ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                read: false,
                createdAt: new Date().toISOString()
            };

            await storageService.saveDoctorNote(newNote);
            setEntryComment('');
            setCommentingEntryId(null);

            // Refresh notes for current patient (Subscription also handles this, but explicit refresh for immediate feedback)
            const patientNotes = await storageService.getPatientNotes(selectedPatientId);
            setNotes(patientNotes);
        } catch (err: any) {
            console.error("Fail to save threaded comment", err);
            alert("Falha ao enviar mensagem: " + (err.message || "Erro desconhecido"));
            setEntryComment(currentComment);
        }
    };

    // Also include handleSaveReport if it was missed
    const handleSaveReport = async () => {
        if (!selectedPatientId || !editingReport.title || !editingReport.content) return;
        setIsSaving(true);
        try {
            if (editingReport.id) {
                await storageService.updateClinicalReport(editingReport.id, {
                    title: editingReport.title,
                    reportType: editingReport.reportType,
                    content: editingReport.content
                });
            } else {
                await storageService.createClinicalReport({
                    patientId: selectedPatientId,
                    professionalId: user.id,
                    professionalRole: user.clinicalRole || 'PSICOLOGO',
                    title: editingReport.title,
                    reportType: editingReport.reportType,
                    content: editingReport.content
                });
            }
            // Refresh reports
            const reports = await storageService.getClinicalReports(selectedPatientId, user.id);
            setClinicalReports(reports);
            setIsEditingReport(false);
            setEditingReport({ id: '', title: '', reportType: 'evolucao', content: '' });
        } catch (error) {
            console.error("Failed to save report:", error);
            alert("Erro ao salvar relatório.");
        } finally {
            setIsSaving(false);
        }
    };


    const handleSendAudio = async (entryId: string, blob: Blob, duration: number) => {
        if (!selectedPatientId) return;

        try {
            // Upload audio to storage
            const audioPath = await storageService.uploadAudio(blob);

            // Create audio note
            const specialty = (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? 'PSIQUIATRA' : 'PSICOLOGO';
            const thread = await storageService.getOrCreateThread(selectedPatientId, user.id, specialty);

            const audioNote: DoctorNote = {
                id: crypto.randomUUID(),
                doctorId: user.id,
                doctorName: user.name,
                doctorRole: (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                patientId: selectedPatientId,
                entryId,
                threadId: thread.id,
                text: '',
                type: 'audio',
                audioUrl: audioPath,
                duration,
                isShared: true,
                authorRole: specialty === 'PSIQUIATRA' ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                read: false,
                createdAt: new Date().toISOString()
            };

            await storageService.saveDoctorNote(audioNote);
            setCommentingEntryId(null);

            // Refresh notes
            const patientNotes = await storageService.getPatientNotes(selectedPatientId);
            setNotes(patientNotes);
        } catch (err: any) {
            console.error("Failed to send audio", err);
            alert("Falha ao enviar áudio: " + (err.message || "Erro desconhecido"));
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

    const handleExportClinicalReportPDF = (report: ClinicalReport) => {
        const patient = patients.find(p => p.id === selectedPatientId);
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(124, 58, 237); // Brand Primary
        doc.text('MoodFlow Enterprise', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Relatório Clínico Individual', 14, 30);

        doc.setDrawColor(200);
        doc.line(14, 35, 196, 35);

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Paciente: ${patient?.name || 'N/A'}`, 14, 45);
        doc.text(`Data: ${new Date(report.createdAt).toLocaleDateString()} ${new Date(report.createdAt).toLocaleTimeString()}`, 14, 50);
        doc.text(`Profissional: Dr(a). ${user.name} (${user.clinicalRole === 'psychologist' ? 'Psicólogo(a)' : user.clinicalRole === 'psychiatrist' ? 'Psiquiatra' : 'Profissional'})`, 14, 55);
        doc.text(`Tipo: ${report.reportType.toUpperCase()}`, 14, 60);

        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(report.title, 14, 75);

        // Content
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);

        const splitText = doc.splitTextToSize(report.content, 180);
        doc.text(splitText, 14, 85);

        // Footer signature line
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(100);
        doc.line(14, pageHeight - 30, 80, pageHeight - 30);
        doc.setFontSize(8);
        doc.text(`Dr(a). ${user.name}`, 14, pageHeight - 25);

        doc.save(`relatorio_${report.reportType}_${patient?.name.replace(/\s+/g, '_') || 'paciente'}.pdf`);
    };

    const handlePrintClinicalReportPDF = (report: ClinicalReport) => {
        const patient = patients.find(p => p.id === selectedPatientId);
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(124, 58, 237); // Brand Primary
        doc.text('MoodFlow Enterprise', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Relatório Clínico Individual', 14, 30);

        doc.setDrawColor(200);
        doc.line(14, 35, 196, 35);

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Paciente: ${patient?.name || 'N/A'}`, 14, 45);
        doc.text(`Data: ${new Date(report.createdAt).toLocaleDateString()} ${new Date(report.createdAt).toLocaleTimeString()}`, 14, 50);
        doc.text(`Profissional: Dr(a). ${user.name} (${user.clinicalRole === 'psychologist' ? 'Psicólogo(a)' : user.clinicalRole === 'psychiatrist' ? 'Psiquiatra' : 'Profissional'})`, 14, 55);
        doc.text(`Tipo: ${report.reportType.toUpperCase()}`, 14, 60);

        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(report.title, 14, 75);

        // Content
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);

        const splitText = doc.splitTextToSize(report.content, 180);
        doc.text(splitText, 14, 85);

        // Footer signature line
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(100);
        doc.line(14, pageHeight - 30, 80, pageHeight - 30);
        doc.setFontSize(8);
        doc.text(`Dr(a). ${user.name}`, 14, pageHeight - 25);

        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
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

            // AUTO-RISK ALERT: If risk is detected as medium or high in the summary
            if (summary.riskLevel === 'high' || summary.riskLevel === 'medium') {
                await storageService.createRiskAlert(selectedPatientId, summary.riskLevel === 'high' ? 90 : 50, summary.riskLevel, summary.summaryText);
            }

            storageService.logAudit(user.id, 'GENERATE_AI_SUMMARY', selectedPatientId);
        } catch (error) {
            console.error("AI Summary generation failed:", error);
            alert("Falha ao gerar resumo de IA. Verifique sua conexão ou chave de API.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleUpdateClinic = async () => {
        if (!selectedClinicId || !editingClinicName.trim()) return;
        setIsCreatingClinic(true);
        try {
            await storageService.updateClinic(selectedClinicId, editingClinicName);
            const updated = await storageService.getClinics(user.id);
            setClinics(updated);
            setViewMode('clinic');
        } catch (error) {
            console.error("Failed to update clinic:", error);
            // alert("Erro ao atualizar nome da unidade. Verifique as permissões.");
        } finally {
            setIsCreatingClinic(false);
        }
    };



    const handleCreateClinic = async () => {
        if (!newClinicName.trim()) return;
        setIsCreatingClinic(true);
        try {
            await storageService.createClinic(newClinicName);
            setNewClinicName('');
            const updated = await storageService.getClinics(user.id);
            setClinics(updated);
            alert("Clínica criada com sucesso!");
        } catch (error: any) {
            console.error("Failed to create clinic:", error);
            console.error("Error details:", {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint
            });
            alert(`Erro ao criar clínica: ${error?.message || 'Verifique as permissões.'}\n\nCódigo: ${error?.code || 'N/A'}\n\nDetalhes: ${error?.details || error?.hint || 'Verifique o console (F12) para mais informações.'}`);
        } finally {
            setIsCreatingClinic(false);
        }
    };


    const handleLinkProfessional = async () => {
        console.log("handleLinkProfessional clicked", { selectedClinicId });
        if (!selectedClinicId) {
            alert("Erro: Nenhuma clínica selecionada. Tente recarregar a página.");
            return;
        }
        const email = prompt("Digite o e-mail do profissional para vincular:");
        if (!email) return;

        const rolePrompt = prompt("Tipo de profissional (1 para Psicólogo, 2 para Psiquiatra):", "1");
        if (!rolePrompt) return;
        const clinicalRole = rolePrompt === "2" ? 'PSIQUIATRA' : 'PSICOLOGO';

        try {
            await storageService.addProfessionalToClinic(selectedClinicId, email, clinicalRole);
            alert("Convite enviado com sucesso! O profissional será vinculado automaticamente ao criar sua conta.");
            // Refresh list
            storageService.getClinicProfessionals(selectedClinicId).then(setClinicProfessionals);
        } catch (error: any) {
            console.error("Failed to link professional:", error);
            alert(error.message || "Erro ao vincular profissional.");
        }
    };

    const handleDeleteClinic = async (clinicId: string, clinicName: string) => {
        if (!confirm(`Tem certeza que deseja EXCLUIR a clínica "${clinicName}"?\n\nEsta ação não pode ser desfeita e removerá todos os vínculos.`)) return;

        try {
            await storageService.deleteClinic(clinicId);
            setClinics(prev => prev.filter(c => c.clinics.id !== clinicId));
            alert("Clínica excluída com sucesso!");
        } catch (error: any) {
            console.error("Failed to delete clinic:", error);
            alert("Erro ao excluir clínica: " + (error?.message || "Verifique as permissões"));
        }
    };

    const handleRemoveProfessional = async (doctorId: string) => {
        if (!selectedClinicId || !confirm("Tem certeza que deseja remover este profissional desta unidade?")) return;

        try {
            await storageService.removeProfessionalFromClinic(selectedClinicId, doctorId);
            setClinicProfessionals(prev => prev.filter(p => p.id !== doctorId));
        } catch (error: any) {
            console.error("Failed to remove professional:", error);
            alert("Erro ao remover profissional.");
        }
    };



    const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedClinicId) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            // Split by new lines and commas to find emails
            const emails = text.split(/[\n,]/).map(s => s.trim()).filter(s => s.includes('@'));

            if (emails.length === 0) {
                alert("Nenhum email válido encontrado no arquivo.");
                return;
            }

            let successCount = 0;
            let failureCount = 0;
            const errors: string[] = [];

            for (const email of emails) {
                try {
                    await storageService.addProfessionalToClinic(selectedClinicId, email, 'PSICOLOGO');
                    successCount++;
                } catch (error: any) {
                    failureCount++;
                    errors.push(`${email}: ${error.message}`);
                }
            }

            alert(`Importação concluída!\nSucessos: ${successCount}\nFalhas: ${failureCount}\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '...' : ''}`);

            // Refresh list
            storageService.getClinicProfessionals(selectedClinicId).then(setClinicProfessionals);

            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // Unified filtering logic for both Chart and List
    const getEntriesForSelectedPeriod = () => {
        const sorted = [...patientEntries].sort((a, b) => b.timestamp - a.timestamp); // Descending for list (newest first)

        if (chartViewMode === 'day') {
            return sorted.filter(e => {
                const d = new Date(e.timestamp); // Local browser time derived from timestamp
                // Construct YYYY-MM-DD in local time explicitely
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;

                return localDateStr === selectedDate;
            });
        } else if (chartViewMode === 'month') {
            return sorted.filter(e => {
                const d = new Date(e.timestamp);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const localMonthStr = `${year}-${month}`;

                return localMonthStr === selectedMonth;
            });
        } else {
            // Week View (Default)
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            // Include today + last 6 days = 7 days total range
            const sevenDaysAgo = startOfToday - (6 * 24 * 60 * 60 * 1000);
            return sorted.filter(e => e.timestamp >= sevenDaysAgo);
        }
    };

    const periodEntries = getEntriesForSelectedPeriod();

    // Chart needs Ascending order + Moods only
    const getChartEntries = () => {
        const reversed = [...periodEntries].reverse(); // Ascending for chart
        return reversed.filter(e => {
            const isMood = e.entryMode === 'mood' || (!e.entryMode && e.mood !== null);
            return isMood && e.mood !== null && e.mood !== undefined;
        });
    };

    const filteredChartData = getChartEntries().map(e => {
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
                <div className="p-6 pt-12 md:pt-6 border-b border-neutral-800">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="font-black text-xl md:text-2xl text-primary mb-1">MoodFlow <span className="text-xs text-white bg-primary px-2 py-0.5 rounded ml-1">PRO</span></h1>
                        <button onClick={onLogout} className="md:hidden p-2 text-textMuted">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>

                    {/* Navigation Areas Switcher - Visible only to Professionals with ADMIN_CLINICA role (Hybrid Mode) */}
                    {/* BUT if isAdminPortal is true (Hard mode), we force administrative view and hide toggle */}
                    {user.role === UserRole.ADMIN_CLINICA && !isAdminPortal && (
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

                    {isAdminPortal && (
                        <div className="mb-6 p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl flex flex-col items-center gap-2">
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Portal de Gestão</span>
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
                            <div>
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
                                onClick={() => {
                                    if (!selectedClinicId && clinics.length > 0) {
                                        setSelectedClinicId(clinics[0].clinics.id);
                                    } else if (!selectedClinicId) {
                                        alert("Selecione uma clínica primeiro na aba 'Minha Clínica'.");
                                        return;
                                    }
                                    setViewMode('professionals');
                                }}
                                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${viewMode === 'professionals' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span className="text-lg">👥</span>
                                <span className="text-sm font-bold">Profissionais</span>
                            </button>
                            <button
                                onClick={() => setViewMode('reports_b2b')}
                                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${viewMode === 'reports_b2b' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span className="text-lg">📊</span>
                                <span className="text-sm font-bold">Relatórios B2B</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="hidden md:block p-4 border-t border-neutral-800">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="h-10 text-xs gap-2 border-white/5" onClick={onLogout}>
                            Logout
                        </Button>
                    </div>

                </div>
            </aside>

            <main className="flex-1 h-full overflow-y-auto bg-black relative w-full">
                <div className="md:hidden p-4 border-b border-neutral-800 flex items-center gap-3 sticky top-0 bg-black/90 backdrop-blur z-10 w-full overflow-hidden">
                    <button onClick={() => setSelectedPatientId(null)} className="text-white flex items-center gap-2 text-sm font-bold flex-shrink-0 hover:text-primary transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </button>
                    {selectedPatientId && <span className="text-xs text-gray-500 truncate flex-1 block border-l border-neutral-800 pl-3 py-1"> {patients.find(p => p.id === selectedPatientId)?.name}</span>}
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
                                        <div className="text-2xl md:text-3xl font-light text-white">{periodEntries.length}</div>
                                    </div>
                                )}
                            </div>

                            {/* CLINICAL REPORTS TAB SWITCHER (NEW ENTERPRISE FEATURE) */}
                            {viewMode === 'dashboard' && selectedPatientId && (user.role === UserRole.PSICOLOGO || user.role === UserRole.PSIQUIATRA) && (
                                <div className="flex border-b border-neutral-800 mb-6 overflow-x-auto no-scrollbar">
                                    <button
                                        onClick={() => setPatientTab('dashboard')}
                                        className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${patientTab !== 'reports' ? 'border-primary text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={() => setPatientTab('reports')}
                                        className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${patientTab === 'reports' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-white'}`}
                                    >
                                        Relatórios Clínicos
                                    </button>
                                </div>
                            )}

                            {viewMode === 'clinic' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Clinic Creation */}
                                    <div className="md:col-span-1 space-y-6">
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800 shadow-xl space-y-4">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.newClinic || 'Nova Unidade / Clínica'}</h3>
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
                                                {isCreatingClinic ? 'Criando...' : (t.createUnit || 'Criar Unidade')}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Clinic List */}
                                    <div className="md:col-span-2 space-y-6">
                                        <h2 className="text-lg font-bold text-white px-2">{t.yourClinics || 'Suas Unidades'}</h2>
                                        {clinics.length === 0 ? (
                                            <div className="bg-surface p-12 rounded-3xl border border-dashed border-neutral-800 flex flex-col items-center text-center">
                                                <span className="text-4xl mb-4">🏥</span>
                                                <p className="text-gray-500">Você ainda não faz parte de nenhuma clínica.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {clinics.map((membership, idx) => (
                                                    <div key={idx} className="bg-surface p-6 rounded-3xl border border-neutral-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-3 flex gap-2">
                                                            {membership.role === 'admin' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteClinic(membership.clinics.id, membership.clinics.name);
                                                                    }}
                                                                    className="p-1 hover:bg-red-500/20 rounded-lg text-neutral-600 hover:text-red-500 transition-colors"
                                                                    title="Excluir Clínica"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${membership.role === 'admin' ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-gray-400'}`}>
                                                                {membership.role}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{membership.clinics.name}</h4>
                                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">ID: {membership.clinics.id.slice(0, 8)}...</p>
                                                        <div className="mt-6 flex gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                className="h-8 text-[10px] uppercase font-black px-3"
                                                                onClick={() => {
                                                                    setSelectedClinicId(membership.clinics.id);
                                                                    setViewMode('clinic_settings');
                                                                }}
                                                            >Configurar</Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-8 text-[10px] uppercase font-black px-3"
                                                                onClick={() => {
                                                                    setSelectedClinicId(membership.clinics.id);
                                                                    setViewMode('professionals');
                                                                }}
                                                            >Profissionais</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : viewMode === 'professionals' ? (
                                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                    {/* SECTION: ADMINISTRATION */}
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                    Administração
                                                </h3>
                                                <p className="text-xs text-textMuted mt-1">Gestão de administradores da unidade.</p>
                                            </div>
                                            <Button
                                                onClick={() => alert("Para adicionar outro administrador, entre em contato com o suporte ou crie uma nova conta com perfil de Administrador.")}
                                                className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-white/5"
                                            >
                                                + Adicionar Admin
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {/* Current User Card */}
                                            <div className="bg-surface p-6 rounded-3xl border border-neutral-800 hover:border-indigo-500/50 transition-all group relative overflow-hidden shadow-lg shadow-indigo-500/5">
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-xl border border-indigo-500/20">👤</div>
                                                    <div>
                                                        <h4 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{user.name} (Você)</h4>
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500 uppercase font-black">Papel</span>
                                                        <span className="text-indigo-400 font-bold uppercase">ADMINISTRADOR</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500 uppercase font-black">Status</span>
                                                        <span className="text-green-500 font-bold uppercase">ATIVO</span>
                                                    </div>
                                                </div>
                                                <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        className="flex-1 h-8 text-[10px] uppercase font-black hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-50"
                                                        onClick={() => setIsEditingAdmin(true)}
                                                    >
                                                        Editar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION: CLINICAL STAFF */}
                                    <div>
                                        <div className="flex justify-between items-center mb-6 border-t border-neutral-800 pt-8">
                                            <div>
                                                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Corpo Clínico <span className="text-gray-500 ml-1">- {clinics.find(c => c.clinics.id === selectedClinicId)?.clinics.name}</span>
                                                </h3>
                                                <p className="text-xs text-textMuted mt-1">Psicólogos e Psiquiatras com acesso aos pacientes.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <input
                                                    type="file"
                                                    accept=".csv,.txt"
                                                    ref={fileInputRef}
                                                    onChange={handleBatchUpload}
                                                    className="hidden"
                                                />
                                                <Button
                                                    className="bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-indigo-500/30"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    📥 Importar CSV
                                                </Button>
                                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-xl" onClick={handleLinkProfessional}>
                                                    + Vincular Profissional
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {/* Listed Professionals */}
                                            {clinicProfessionals.length === 0 ? (
                                                <div className="col-span-full py-12 text-center border border-dashed border-neutral-800 rounded-3xl">
                                                    <span className="text-4xl block mb-4">👨‍⚕️</span>
                                                    <p className="text-gray-500 font-medium">Nenhum profissional vinculado.</p>
                                                    <p className="text-xs text-gray-600 mt-2">Clique em "Vincular Profissional" para adicionar.</p>
                                                </div>
                                            ) : (
                                                clinicProfessionals.map((prof) => (
                                                    <div key={prof.id} className="bg-surface p-6 rounded-3xl border border-neutral-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                                                        <div className="flex items-center gap-4 mb-6">
                                                            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center text-xl">👨‍⚕️</div>
                                                            <div>
                                                                <h4 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{prof.name}</h4>
                                                                <p className="text-[10px] text-gray-500 uppercase tracking-tighter">{prof.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-gray-500 uppercase font-black">Papel</span>
                                                                <span className="text-indigo-400 font-bold uppercase">{prof.specialty || prof.role || 'Profissional'}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-gray-500 uppercase font-black">Status</span>
                                                                <span className={`${prof.membershipStatus === 'active' ? 'text-green-500' : 'text-yellow-500'} font-bold uppercase`}>{prof.membershipStatus === 'active' ? 'ATIVO' : 'PENDENTE'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                                                            <Button variant="ghost" className="flex-1 h-8 text-[10px] uppercase font-black" onClick={() => alert('Edição de permissões em breve.')}>Editar</Button>
                                                            <Button variant="ghost" className="flex-1 h-8 text-[10px] uppercase font-black text-red-400 hover:text-red-500" onClick={() => handleRemoveProfessional(prof.id)}>Remover</Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}

                                            <button onClick={handleLinkProfessional} className="group bg-surface/30 p-6 rounded-3xl border border-dashed border-neutral-800 flex flex-col items-center text-center justify-center min-h-[200px] cursor-pointer hover:bg-surface/50 hover:border-indigo-500/50 transition-all">
                                                <div className="w-12 h-12 rounded-full bg-neutral-800 group-hover:bg-indigo-500/20 flex items-center justify-center transition-colors mb-4">
                                                    <span className="text-xl group-hover:text-indigo-400 transition-colors">➕</span>
                                                </div>
                                                <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">Convidar Profissional</p>
                                                <p className="text-[10px] text-gray-500 mt-2">Adicionar novo membro à equipe</p>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : viewMode === 'reports_b2b' ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Relatórios Corporativos B2B</h3>
                                            <p className="text-xs text-textMuted mt-1">Visão analítica de saúde emocional por unidade e empresa.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1 bg-surfaceHighlight p-1.5 rounded-2xl border border-white/5 shadow-inner">
                                                <Button
                                                    variant={b2bFilterType === 'all' ? 'default' : 'ghost'}
                                                    className={`h-9 text-[10px] uppercase font-black px-4 rounded-xl transition-all ${b2bFilterType === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                    onClick={() => setB2bFilterType('all')}
                                                >
                                                    Desde o Início
                                                </Button>

                                                <div className="h-5 w-[1px] bg-white/10 mx-2"></div>

                                                <div className={`flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all ${b2bFilterType === 'month' ? 'bg-white/5 ring-1 ring-indigo-500/50' : 'opacity-60 hover:opacity-100'}`}>
                                                    <span className="text-sm">📅</span>
                                                    <input
                                                        type="month"
                                                        value={b2bMonth}
                                                        onChange={(e) => {
                                                            setB2bMonth(e.target.value);
                                                            setB2bFilterType('month');
                                                        }}
                                                        className="bg-transparent border-none text-white text-[11px] font-bold uppercase focus:ring-0 cursor-pointer w-[120px] p-0"
                                                    />
                                                </div>

                                            </div>
                                            <Button
                                                className="bg-neutral-800 hover:bg-neutral-700 text-white h-10 text-[10px] uppercase font-black px-6 border border-white/5"
                                                onClick={() => window.print()}
                                            >
                                                Exportar PDF
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total de Pacientes</p>
                                            <p className="text-2xl font-black text-white">{b2bMetrics.totalPatients}</p>
                                            <p className="text-[9px] text-gray-500 mt-2">Clínica ativa</p>
                                        </div>
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Sessões Realizadas</p>
                                            <p className="text-2xl font-black text-white">{b2bMetrics.totalSessions}</p>
                                            <p className="text-[9px] text-blue-500 mt-2">Total de registros</p>
                                        </div>
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Risco Médio Unitário</p>
                                            <p className={`text-2xl font-black ${b2bMetrics.averageRisk === 'BAIXO' ? 'text-green-400' : b2bMetrics.averageRisk === 'MÉDIO' ? 'text-yellow-400' : 'text-red-400'}`}>{b2bMetrics.averageRisk}</p>
                                            <p className={`text-[9px] mt-2 ${b2bMetrics.averageRisk === 'BAIXO' ? 'text-green-500' : b2bMetrics.averageRisk === 'MÉDIO' ? 'text-yellow-500' : 'text-red-500'}`}>{b2bMetrics.averageRisk === 'BAIXO' ? 'Estável' : b2bMetrics.averageRisk === 'MÉDIO' ? 'Atenção' : 'Crítico'}</p>
                                        </div>
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800">
                                            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Engagement Score</p>
                                            <p className="text-2xl font-black text-indigo-400">{b2bMetrics.engagementScore}%</p>
                                            <p className="text-[9px] text-indigo-500 mt-2">{b2bMetrics.engagementScore >= 70 ? 'Excelente' : b2bMetrics.engagementScore >= 40 ? 'Bom' : 'Baixo'}</p>
                                        </div>
                                    </div>

                                    <div className="bg-surface p-8 rounded-3xl border border-neutral-800 min-h-[300px] flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center text-2xl mb-4">📉</div>
                                        <h4 className="text-white font-bold mb-2">Aguardando dados estruturados</h4>
                                        <p className="text-xs text-gray-500 max-w-md">Os gráficos de evolução corporativa estarão disponíveis assim que houver volume de dados suficiente em suas unidades.</p>
                                    </div>
                                </div>
                            ) : viewMode === 'clinic_settings' ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Configurações da Unidade</h3>
                                            <p className="text-xs text-textMuted mt-1">Ajuste as informações fundamentais da sua clínica.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="text-white text-xs font-bold uppercase border-white/10"
                                            onClick={() => setViewMode('clinic')}
                                        >
                                            Voltar
                                        </Button>
                                    </div>

                                    <div className="bg-surface p-8 rounded-3xl border border-neutral-800 max-w-2xl">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Nome da Unidade</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                                    value={editingClinicName}
                                                    onChange={e => setEditingClinicName(e.target.value)}
                                                    placeholder="Digite o nome da unidade..."
                                                />
                                                <p className="text-[10px] text-gray-500 italic mt-1">Nome atual: {clinics.find(c => c.clinics.id === selectedClinicId)?.clinics.name}</p>
                                            </div>

                                            <div className="pt-6 border-t border-white/5">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">Informações do Plano</h4>
                                                    <span className="text-[10px] text-gray-600 border border-gray-800 rounded px-2 py-0.5">(Gerenciado pelo Sistema)</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5">
                                                        <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Status do Plano</p>
                                                        <p className="text-sm text-green-400 font-bold">PROFISSIONAL</p>
                                                    </div>
                                                    <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5">
                                                        <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Renovação</p>
                                                        <p className="text-sm text-white font-bold">12/02/2026</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-6">
                                                <Button
                                                    onClick={handleUpdateClinic}
                                                    disabled={isCreatingClinic || !editingClinicName.trim()}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                                >
                                                    {isCreatingClinic ? 'Salvando...' : 'Salvar Nome da Unidade'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : patientTab === 'reports' && selectedPatientId ? (
                                /* --- CLINICAL REPORTS VIEW (ISOLATED) --- */
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Histórico de Relatórios</h3>
                                        <Button
                                            onClick={() => {
                                                setEditingReport({ id: '', title: '', reportType: 'evolucao', content: '' });
                                                setIsEditingReport(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20"
                                        >
                                            + Novo Relatório
                                        </Button>
                                    </div>

                                    {/* ADMIN EDIT MODAL */}
                                    {isEditingAdmin && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                                            <div className="bg-surface p-6 rounded-3xl border border-neutral-800 shadow-2xl w-full max-w-md space-y-4 animate-in fade-in zoom-in-95">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-white font-black text-lg">Editar Administrador</h4>
                                                    <button onClick={() => setIsEditingAdmin(false)} className="text-gray-500 hover:text-white">✕</button>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Nome</label>
                                                        <input
                                                            type="text"
                                                            value={adminEditData.name}
                                                            onChange={e => setAdminEditData(prev => ({ ...prev, name: e.target.value }))}
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Nova Senha (Opcional)</label>
                                                        <input
                                                            type="password"
                                                            value={adminEditData.password}
                                                            onChange={e => setAdminEditData(prev => ({ ...prev, password: e.target.value }))}
                                                            placeholder="Deixe em branco para manter"
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="pt-4 flex gap-3">
                                                    <Button variant="ghost" className="flex-1" onClick={() => setIsEditingAdmin(false)}>Cancelar</Button>
                                                    <Button
                                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                        onClick={async () => {
                                                            try {
                                                                if (!adminEditData.name.trim()) return alert("Nome é obrigatório");
                                                                await storageService.updateAdminProfile(user.id, adminEditData.name, adminEditData.password);
                                                                setIsEditingAdmin(false);
                                                                alert("Dados atualizados com sucesso!");
                                                                // Reload or update verification would be ideal
                                                            } catch (e: any) {
                                                                alert("Erro ao atualizar: " + e.message);
                                                            }
                                                        }}
                                                    >
                                                        Salvar Alterações
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isEditingReport ? (
                                        <div className="bg-surface p-6 rounded-3xl border border-neutral-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-white font-black text-lg">{editingReport.id ? 'Editar Relatório' : 'Novo Relatório'}</h4>
                                                <button onClick={() => setIsEditingReport(false)} className="text-gray-500 hover:text-white">✕</button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Título</label>
                                                    <input
                                                        type="text"
                                                        value={editingReport.title}
                                                        onChange={e => setEditingReport(prev => ({ ...prev, title: e.target.value }))}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        placeholder="Ex: Evolução Semanal"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Tipo</label>
                                                    <select
                                                        value={editingReport.reportType}
                                                        onChange={e => setEditingReport(prev => ({ ...prev, reportType: e.target.value as any }))}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                    >
                                                        <option value="avaliacao">Avaliação Inicial</option>
                                                        <option value="evolucao">Evolução</option>
                                                        <option value="encaminhamento">Encaminhamento</option>
                                                        <option value="alta">Alta</option>
                                                        <option value="livre">Texto Livre</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Conteúdo Clínico</label>
                                                <textarea
                                                    value={editingReport.content}
                                                    onChange={e => setEditingReport(prev => ({ ...prev, content: e.target.value }))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all h-64 resize-none leading-relaxed"
                                                    placeholder="Descreva a sessão, observações e condutas..."
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                                <Button variant="ghost" onClick={() => setIsEditingReport(false)} disabled={isSaving}>Cancelar</Button>
                                                <Button
                                                    onClick={handleSaveReport}
                                                    disabled={!editingReport.title || !editingReport.content || isSaving}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                >
                                                    {isSaving ? 'Salvando...' : 'Salvar Relatório'}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {clinicalReports.length === 0 ? (
                                                <div className="text-center py-12 border border-dashed border-neutral-800 rounded-3xl">
                                                    <span className="text-4xl block mb-4">📂</span>
                                                    <p className="text-gray-500 font-medium">Nenhum relatório clínico encontrado.</p>
                                                </div>
                                            ) : (
                                                clinicalReports.map(report => (
                                                    <div key={report.id} className="bg-surface p-6 rounded-2xl border border-neutral-800 hover:border-indigo-500/30 transition-all group">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${report.reportType === 'alta' ? 'bg-green-500/20 text-green-400' : report.reportType === 'avaliacao' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-gray-400'}`}>
                                                                        {report.reportType.toUpperCase()}
                                                                    </span>
                                                                    <span className="text-xs text-neutral-500">{new Date(report.createdAt).toLocaleDateString()} às {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                                <h4 className="text-white font-bold text-lg">{report.title}</h4>
                                                            </div>
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingReport({
                                                                            id: report.id,
                                                                            title: report.title,
                                                                            reportType: report.reportType,
                                                                            content: report.content
                                                                        });
                                                                        setIsEditingReport(true);
                                                                    }}
                                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => handlePrintClinicalReportPDF(report)}
                                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                                    title="Imprimir"
                                                                >
                                                                    🖨️
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await storageService.softDeleteClinicalReport(report.id, user.id);
                                                                            setClinicalReports(prev => prev.filter(r => r.id !== report.id));
                                                                        } catch (e) {
                                                                            alert('Erro ao excluir relatório.');
                                                                        }
                                                                    }}
                                                                    className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                                    title="Excluir"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed break-words">{report.content}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
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
                                                            width: typeof window !== 'undefined' && window.innerWidth < 768 ? `${Math.max(100, filteredChartData.length * 100)}px` : '100%',
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
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl">✨</div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.clinicalAiInsights}</h3>
                                                            <p className="text-[10px] text-indigo-300/60 uppercase font-black">Powered by Gemini 1.5</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                                        <Button
                                                            onClick={() => setIsExportModalOpen(true)}
                                                            className="h-10 px-2 md:px-4 text-xs font-bold flex-1 md:flex-none bg-neutral-800 hover:bg-neutral-700 text-white/70 border border-white/5 gap-2"
                                                        >
                                                            <span>📄</span> Relatórios
                                                        </Button>
                                                        <Button
                                                            onClick={handleGenerateAISummary}
                                                            disabled={isGeneratingSummary || patientEntries.length === 0}
                                                            className={`h-10 px-2 md:px-6 text-xs font-bold whitespace-nowrap gap-2 flex-1 md:flex-none print:hidden ${isGeneratingSummary ? 'opacity-50' : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
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
                                                    {periodEntries.length === 0 ? <p className="text-neutral-600 italic">No entries for this period.</p> : periodEntries.map(entry => {
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
                                                                                <div key={note.id} className={`flex flex-col ${(note.authorRole === 'PACIENTE' || note.authorRole === 'PATIENT') ? 'items-start' : 'items-end'}`}>
                                                                                    <div className={`relative group max-w-[85%] p-2 rounded-xl text-xs break-words [overflow-wrap:anywhere] whitespace-pre-wrap ${(note.authorRole === 'PACIENTE' || note.authorRole === 'PATIENT') ? 'bg-neutral-800 text-gray-300' : 'bg-blue-900/30 text-blue-100 border border-blue-900/50'}`}>
                                                                                        <span className="font-bold block text-[10px] opacity-50 mb-1">{(note.authorRole === 'PACIENTE' || note.authorRole === 'PATIENT') ? (patients.find(p => p.id === selectedPatientId)?.name || 'Paciente') : 'Dr. ' + user.name}</span>
                                                                                        {note.type === 'audio' && note.audioUrl ? (
                                                                                            <AudioPlayer url={note.audioUrl} duration={note.duration} />
                                                                                        ) : (
                                                                                            note.text
                                                                                        )}

                                                                                        {/* Delete Button for Professional's Own Messages */}
                                                                                        {!(note.authorRole === 'PACIENTE' || note.authorRole === 'PATIENT') && note.doctorId === user.id && (
                                                                                            <button
                                                                                                onClick={async (e) => {
                                                                                                    e.preventDefault();
                                                                                                    e.stopPropagation();

                                                                                                    // 1. Optimistic Update (Immediate Feedback)
                                                                                                    const previousNotes = [...notes];
                                                                                                    setNotes(prev => prev.filter(n => n.id !== note.id));

                                                                                                    try {
                                                                                                        // 2. Perform actual delete
                                                                                                        await storageService.deleteDoctorNote(note.id);
                                                                                                    } catch (err) {
                                                                                                        console.error(err);
                                                                                                        // 3. Rollback locally if failed
                                                                                                        setNotes(previousNotes);
                                                                                                        alert('Erro ao excluir mensagem.');
                                                                                                    }
                                                                                                }}
                                                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110 z-10 cursor-pointer"
                                                                                                title="Excluir mensagem"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {commentingEntryId === entry.id ? (
                                                                        <div className="mt-4">
                                                                            <textarea className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-sm text-white focus:outline-none min-h-[80px]" placeholder="Write a comment..." value={entryComment} onChange={e => setEntryComment(e.target.value)} autoFocus />
                                                                            <div className="flex items-center justify-between gap-2 mt-3">
                                                                                <AudioRecorder onSend={(blob, duration) => handleSendAudio(entry.id, blob, duration)} />
                                                                                <div className="flex items-center gap-2 flex-1 justify-end">
                                                                                    <Button variant="ghost" className="h-10 text-xs px-4 flex-1 bg-white/5 hover:bg-white/10" onClick={() => setCommentingEntryId(null)}>Cancel</Button>
                                                                                    <Button className={`h-10 text-xs px-6 flex-1 ${user.clinicalRole === 'psychologist' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' : 'bg-[#10b981] hover:bg-[#059669]'}`} onClick={() => handleSaveEntryComment(entry.id)}>Send</Button>
                                                                                </div>
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
                                                    <textarea className="w-full bg-transparent text-sm text-white focus:outline-none resize-none h-24 placeholder-gray-600" placeholder="Confidential observation..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                                                    <div className="flex justify-end items-center border-t border-white/5 pt-3">
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
            {
                selectedPatientId && (
                    <ExportReportModal
                        isOpen={isExportModalOpen}
                        onClose={() => setIsExportModalOpen(false)}
                        entries={patientEntries}
                        notes={notes}
                        userRole={user.role || ''}
                        userName={user.name || 'Doutor'}
                        patientName={patients.find(p => p.id === selectedPatientId)?.name || 'Paciente'}
                    />
                )
            }


        </div >
    );
};
