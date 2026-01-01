
import React, { useState } from 'react';
import { MoodEntry, DoctorNote, UserRole } from '../../types';
import { exportService } from '../../services/exportService';

interface ExportReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    entries: MoodEntry[];
    notes: DoctorNote[];
    userRole: string; // 'PATIENT', 'PSYCHOLOGIST', 'PSYCHIATRIST'
    userName: string;
    patientName: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
    isOpen, onClose, entries, notes, userRole, userName, patientName
}) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

    const [professionalFilter, setProfessionalFilter] = useState<'PSYCHOLOGIST' | 'PSYCHIATRIST' | 'BOTH'>('BOTH');
    const [contentFilter, setContentFilter] = useState<'ENTRIES' | 'NOTES' | 'BOTH'>('BOTH');

    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const handleExport = async (format: 'PDF' | 'CSV' | 'EXCEL' | 'PRINT') => {
        setIsExporting(true);
        try {
            exportService.generateReport(entries, notes, {
                startDate,
                endDate,
                professionalFilter,
                contentFilter,
                userRole,
                patientName
            }, format);
            if (format !== 'PRINT') onClose();
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar relatório.");
        } finally {
            setIsExporting(false);
        }
    };

    const isDoctor = userRole === UserRole.PSYCHOLOGIST || userRole === UserRole.PSYCHIATRIST;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-neutral-900/50 p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>📊</span> Relatórios Enterprise
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">Configure o extrato de dados do paciente</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    {/* 1. Date Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Período de Análise</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-[10px] text-gray-600 mb-1">Início</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                            </div>
                            <div>
                                <span className="block text-[10px] text-gray-600 mb-1">Fim</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* 2. Professional Filter (Only editable if NOT a restricted doctor) */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Filtro Profissional</label>
                            {isDoctor && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Restrito ao seu cargo</span>}
                        </div>

                        <div className="flex gap-2 p-1 bg-[#0A0A0A] rounded-xl border border-white/5">
                            <button
                                onClick={() => setProfessionalFilter('PSYCHOLOGIST')}
                                disabled={isDoctor && userRole !== 'PSYCHOLOGIST'}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${professionalFilter === 'PSYCHOLOGIST' ? 'bg-[#8b5cf6] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                            >
                                Psicologia
                            </button>
                            <button
                                onClick={() => setProfessionalFilter('PSYCHIATRIST')}
                                disabled={isDoctor && userRole !== 'PSYCHIATRIST'}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${professionalFilter === 'PSYCHIATRIST' ? 'bg-[#10b981] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                            >
                                Psiquiatria
                            </button>
                            <button
                                onClick={() => setProfessionalFilter('BOTH')}
                                disabled={isDoctor}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${professionalFilter === 'BOTH' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                            >
                                Ambos
                            </button>
                        </div>
                    </div>

                    {/* 3. Content Filter */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Conteúdo</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${contentFilter !== 'NOTES' ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 group-hover:border-white/40'}`}>
                                    {contentFilter !== 'NOTES' && <span className="text-white text-xs">✓</span>}
                                </div>
                                <input type="radio" name="content" className="hidden" checked={contentFilter !== 'NOTES'} onChange={() => setContentFilter(prev => prev === 'NOTES' ? 'BOTH' : 'ENTRIES')} />
                                <span className="text-sm text-gray-300">Registros do Paciente</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${contentFilter !== 'ENTRIES' ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 group-hover:border-white/40'}`}>
                                    {contentFilter !== 'ENTRIES' && <span className="text-white text-xs">✓</span>}
                                </div>
                                <input type="radio" name="content" className="hidden" checked={contentFilter !== 'ENTRIES'} onChange={() => setContentFilter(prev => prev === 'ENTRIES' ? 'BOTH' : 'NOTES')} />
                                <span className="text-sm text-gray-300">Anotações Clínicas</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-[#1A1A1A] p-6 border-t border-white/5 flex flex-col gap-3">
                    <button onClick={() => handleExport('PRINT')} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                        <span>🖨️</span> Imprimir Relatório Oficial
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleExport('PDF')} className="bg-[#222] text-white border border-white/10 font-medium py-3 rounded-xl hover:bg-[#333] transition-colors flex items-center justify-center gap-2 text-sm">
                            <span>📄</span> Baixar PDF
                        </button>
                        <button onClick={() => handleExport('EXCEL')} className="bg-[#222] text-white border border-white/10 font-medium py-3 rounded-xl hover:bg-[#333] transition-colors flex items-center justify-center gap-2 text-sm">
                            <span>📊</span> Baixar Excel
                        </button>
                    </div>
                    {/* CSV fallback small link */}
                    <button onClick={() => handleExport('CSV')} className="text-[10px] text-gray-600 hover:text-gray-400 mt-2">
                        Download CSV (Dados Brutos)
                    </button>
                </div>
            </div>
        </div>
    );
};
