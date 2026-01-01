import React, { useState, useEffect } from 'react';
import { MOODS, ACTIVITIES, SYMPTOMS, TRANSLATIONS } from '../../constants';
import { Button } from '../ui/Button';
import { VoiceRecorder } from './VoiceRecorder';
import { aiService } from '../../services/aiService';
import { storageService } from '../../services/storageService';
import { MoodEntry, UserRole, Language } from '../../types';

interface EntryFormProps {
    userId: string;
    userRole: UserRole;
    onSave: (entry: MoodEntry) => void;
    onCancel: () => void;
    initialMode?: 'mood' | 'voice' | 'diary';
    lang: Language;
    connectedDoctors?: { id: string, name: string, role?: string }[];
}

const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
};

export const EntryForm: React.FC<EntryFormProps> = ({ userId, userRole, onSave, onCancel, initialMode = 'mood', lang, connectedDoctors = [] }) => {
    const [mode, setMode] = useState<'mood' | 'voice' | 'diary'>(initialMode);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Translations
    const t = TRANSLATIONS[lang];

    // Form State
    const [mood, setMood] = useState<number | null>(3);
    const [energy, setEnergy] = useState<number>(5);
    const [text, setText] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [date, setDate] = useState(getLocalISOString());
    // New state for granular permissions
    // Default to sharing with all doctors if not locked.
    const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>(connectedDoctors.map(d => d.id));

    // Voice Handler
    const handleVoiceTranscription = async (transcribedText: string) => {
        setIsAnalyzing(true);
        const analysis = await aiService.analyzeEntry(transcribedText);

        if (analysis) {
            setText(analysis.transcription || transcribedText);
            if (analysis.moodScore) setMood(analysis.moodScore);
            if (analysis.energyLevel) setEnergy(analysis.energyLevel);
            if (analysis.detectedTags && Array.isArray(analysis.detectedTags)) {
                setSelectedTags(prev => Array.from(new Set([...prev, ...analysis.detectedTags])));
            }
            if (analysis.mode === 'diary') setMode('diary');
            else if (analysis.mode === 'mood') setMode('mood');
        } else {
            setText(transcribedText);
            setMode('diary');
        }
        setIsAnalyzing(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Voice/Diary Mode: simple payload
        // Mood Mode check
        if ((mode === 'mood' && mood === null)) {
            alert(t.selectMood);
            return;
        }

        const entryDate = new Date(date);
        const finalTimestamp = new Date(getLocalISOString()).getTime();

        // Use selectedDoctorIds directly for permissions
        const permissionsToSave = selectedDoctorIds;

        const newEntry: MoodEntry = {
            id: crypto.randomUUID(),
            userId,
            date: entryDate.toISOString(),
            timestamp: finalTimestamp,
            mood: mode === 'mood' ? mood : null,
            moodLabel: mode === 'mood' ? (MOODS.find(m => m.value === mood)?.label || 'Okay') : t.diary,
            energy: mode === 'mood' ? energy : undefined,
            text,
            tags: mode === 'mood' ? selectedTags : [],
            isLocked: permissionsToSave.length === 0, // If no doctors selected, it's private/locked
            permissions: permissionsToSave,
            entryMode: mode
        };

        setIsAnalyzing(true);

        // Simulating AI analysis for now or calling real service if available
        setTimeout(async () => {
            if (newEntry.text.length > 5) {
                try {
                    // const analysis = await aiService.analyzeEntry(newEntry.text);
                    // newEntry.aiAnalysis = analysis;
                } catch (err) { console.warn("AI fail", err); }
            }
            onSave(newEntry);
            setIsAnalyzing(false);
        }, mode === 'voice' ? 1500 : 500);
    };

    const handleToggleDoctor = (docId: string) => {
        setSelectedDoctorIds(prev =>
            prev.includes(docId)
                ? prev.filter(id => id !== docId)
                : [...prev, docId]
        );
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const formatDateForDisplay = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-[#121212] sm:border sm:border-white/5 sm:rounded-[40px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.9)] w-full max-w-xl mx-auto flex flex-col h-full max-h-screen sm:max-h-[95vh] animate-in zoom-in-95 duration-500 font-sans">

            {/* Dark Mode Tab Switcher */}
            <div className="px-6 py-4 shrink-0 bg-black/20 border-b border-white/5">
                <div className="flex p-1.5 bg-[#0A0A0A] rounded-[24px] border border-white/5 relative z-10 w-full transition-all">
                    {(['mood', 'diary', 'voice'] as const).map((m) => {
                        const isSelected = mode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`flex-1 py-3.5 text-[14px] font-black rounded-[18px] transition-all duration-300 flex items-center justify-center gap-2 tracking-tight ${isSelected
                                    ? 'bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white shadow-[0_8px_24px_rgba(109,40,217,0.4)] scale-[1.02]'
                                    : 'text-[#6B7280] hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {m === 'mood' && <span>📊 Humor</span>}
                                {m === 'diary' && <span>📖 Diário</span>}
                                {m === 'voice' && <span>🎙️ Voz IA</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-8 sm:space-y-10 scroll-smooth bg-[#121212]">
                {mode === 'voice' ? (
                    <div className="flex flex-col items-center justify-center min-h-[450px] text-center space-y-10 py-6 animate-in fade-in duration-500">
                        <div className="space-y-4">
                            <h3 className="text-white font-black text-3xl tracking-tighter">Estou ouvindo...</h3>
                            <p className="text-gray-500 text-[15px] max-w-[340px] mx-auto leading-relaxed font-medium">
                                Conte sobre seu dia ou como se sente. A IA detectará seu humor e escreverá no diário.
                            </p>
                        </div>

                        <div className="w-full bg-[#0A0A0A] rounded-[32px] border border-white/5 p-10 h-56 flex items-center justify-center shadow-inner relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                            <p className={`text-base text-center transition-all px-4 leading-relaxed font-medium ${text ? 'text-gray-200' : 'text-gray-600 italic opacity-80'}`}>
                                {isAnalyzing ? 'Processando insights da IA...' : (text || 'O texto aparecerá aqui enquanto você fala...')}
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-8">
                            <div className="transform scale-[1.4] transition-all active:scale-95">
                                <VoiceRecorder onTranscription={handleVoiceTranscription} isProcessing={isAnalyzing} />
                            </div>
                            <span className="text-[12px] font-black text-gray-500 uppercase tracking-[0.25em] ml-1 opacity-80">Toque para gravar</span>
                        </div>
                    </div>
                ) : (
                    <form id="entry-form" onSubmit={handleSubmit} className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">

                        {mode === 'mood' && (
                            <>
                                {/* Mood Selection Grid */}
                                <div className="space-y-6">
                                    <label className="text-[10px] sm:text-[12px] text-gray-400 uppercase tracking-[0.2em] font-black ml-1 opacity-90">COMO VOCÊ ESTÁ SE SENTINDO?</label>
                                    <div className="grid grid-cols-5 gap-2 sm:gap-4">
                                        {MOODS.map((m) => {
                                            const isSelected = mood === m.value;
                                            return (
                                                <button
                                                    key={m.value}
                                                    type="button"
                                                    onClick={() => setMood(m.value)}
                                                    className={`aspect-square flex flex-col items-center justify-center rounded-[28px] transition-all duration-400 border-[2px] ${isSelected
                                                        ? 'bg-[#1A1A1A] border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] scale-105 z-10'
                                                        : 'bg-white/5 border-transparent opacity-30 hover:opacity-100 hover:scale-[1.02]'
                                                        }`}
                                                >
                                                    <span className={`text-3xl sm:text-4xl md:text-5xl mb-2 select-none transform transition-all ${isSelected ? 'scale-110 drop-shadow-lg' : ''}`}>{m.emoji}</span>
                                                    {isSelected && <span className="text-[9px] sm:text-[11px] font-black uppercase text-white tracking-tighter animate-in fade-in zoom-in-50">{m.label}</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Energy Slider */}
                                <div className="space-y-6 bg-[#0A0A0A] p-10 rounded-[40px] border border-white/5 shadow-inner relative overflow-hidden group">
                                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                    <div className="flex justify-between items-center relative z-10">
                                        <label className="text-[10px] sm:text-[12px] text-gray-400 uppercase tracking-[0.2em] font-black opacity-90">NÍVEL DE ENERGIA</label>
                                        <span className="text-[#FBBF24] font-black text-2xl sm:text-3xl tracking-tighter drop-shadow-lg">{energy}<span className="text-gray-700 text-sm sm:text-base font-bold ml-1">/10</span></span>
                                    </div>
                                    <div className="relative pt-6 pb-4 cursor-pointer">
                                        <div className="h-3 w-full bg-gradient-to-r from-[#EF4444] via-[#FBBF24] to-[#10B981] rounded-full shadow-inner opacity-90" />
                                        <input
                                            type="range" min="1" max="10" value={energy}
                                            onChange={(e) => setEnergy(Number(e.target.value))}
                                            className="absolute top-1/2 -translate-y-1/2 w-full h-12 bg-transparent appearance-none cursor-pointer accent-transparent z-20"
                                        />
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-[#8b5cf6] border-[4px] border-white rounded-full shadow-[0_0_20px_-2px_rgba(139,92,246,0.6)] pointer-events-none transition-all duration-100 z-10"
                                            style={{ left: `calc(${(energy - 1) / 9 * 100}% - 16px)` }}
                                        />
                                    </div>
                                </div>

                                {/* Tags Pillbox */}
                                <div className="space-y-6">
                                    <label className="text-[12px] text-gray-400 uppercase tracking-[0.2em] font-black ml-1 opacity-90">TAGS</label>
                                    <div className="flex flex-wrap gap-3">
                                        {[...ACTIVITIES, ...SYMPTOMS].map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleTag(tag)}
                                                className={`px-6 py-3 rounded-2xl text-[13px] font-black transition-all border-2 duration-300 ${selectedTags.includes(tag)
                                                    ? 'bg-white text-black border-white shadow-[0_8px_20px_rgba(255,255,255,0.2)]'
                                                    : 'bg-[#1A1A1A] border-white/5 text-[#9CA3AF] hover:text-white hover:border-white/20'
                                                    }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Notes Section */}
                        <div className="space-y-6">
                            <label className="text-[12px] text-gray-400 uppercase tracking-[0.2em] font-black ml-1 flex items-center gap-2 opacity-90">
                                {mode === 'diary' ? '📖 DIÁRIO' : (
                                    <>
                                        <span>📝</span> NOTAS
                                    </>
                                )}
                            </label>
                            <textarea
                                className={`w-full bg-[#0A0A0A] border-[2px] border-white/5 rounded-[32px] p-8 text-[#F3F4F6] placeholder-gray-700 focus:outline-none focus:border-white/10 focus:ring-4 focus:ring-white/[0.02] transition-all resize-none shadow-inner leading-relaxed font-medium text-base ${mode === 'diary' ? 'h-[400px]' : 'h-[160px]'
                                    }`}
                                placeholder={mode === 'diary' ? 'Como foi o seu dia? Escreva livremente sobre seus sentimentos e eventos...' : 'Algo a acrescentar?'}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>

                        {/* Permission Sharing (Granular) */}
                        {/* Permission Sharing (Simplified) */}
                        {connectedDoctors.length > 0 && (
                            <div className="space-y-6 pt-4 animate-in fade-in duration-500">
                                <label className="text-[12px] text-gray-400 uppercase tracking-[0.2em] font-black ml-1 opacity-90">QUEM PODE VER ESTE REGISTRO?</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Option 1: Only Me */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDoctorIds([])}
                                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 ${selectedDoctorIds.length === 0 ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-[#0A0A0A] border-white/5 text-gray-500 hover:border-white/10'}`}
                                    >
                                        <div className="font-black text-sm uppercase tracking-wider mb-1">🔒 Somente Eu</div>
                                        <div className="text-[11px] opacity-70 font-medium">Nenhum profissional terá acesso</div>
                                    </button>

                                    {/* Option 2: Psychologist (if exists) */}
                                    {connectedDoctors.some(d => d.role === 'PSYCHOLOGIST') && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDoctorIds(connectedDoctors.filter(d => d.role === 'PSYCHOLOGIST').map(d => d.id))}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 ${selectedDoctorIds.length > 0 && selectedDoctorIds.every(id => connectedDoctors.find(d => d.id === id)?.role === 'PSYCHOLOGIST')
                                                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-xl scale-[1.02]'
                                                    : 'bg-[#0A0A0A] border-white/5 text-gray-500 hover:border-indigo-500/30'}`}
                                        >
                                            <div className="font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-2">🧠 Meu Psicólogo</div>
                                            <div className="text-[11px] opacity-70 font-medium">Compartilhar e permitir comentários</div>
                                        </button>
                                    )}

                                    {/* Option 3: Psychiatrist (if exists) */}
                                    {connectedDoctors.some(d => d.role === 'PSYCHIATRIST') && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDoctorIds(connectedDoctors.filter(d => d.role === 'PSYCHIATRIST').map(d => d.id))}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 ${selectedDoctorIds.length > 0 && selectedDoctorIds.every(id => connectedDoctors.find(d => d.id === id)?.role === 'PSYCHIATRIST')
                                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-xl scale-[1.02]'
                                                    : 'bg-[#0A0A0A] border-white/5 text-gray-500 hover:border-emerald-500/30'}`}
                                        >
                                            <div className="font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-2">💊 Meu Psiquiatra</div>
                                            <div className="text-[11px] opacity-70 font-medium">Compartilhar e permitir comentários</div>
                                        </button>
                                    )}

                                    {/* Option 4: Both (if both exist) */}
                                    {connectedDoctors.some(d => d.role === 'PSYCHIATRIST') && connectedDoctors.some(d => d.role === 'PSYCHOLOGIST') && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDoctorIds(connectedDoctors.map(d => d.id))}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 ${selectedDoctorIds.length === connectedDoctors.length ? 'bg-purple-600 text-white border-purple-600 shadow-xl scale-[1.02]' : 'bg-[#0A0A0A] border-white/5 text-gray-500 hover:border-purple-600/30'}`}
                                        >
                                            <div className="font-black text-sm uppercase tracking-wider mb-1">👥 Ambos</div>
                                            <div className="text-[11px] opacity-70 font-medium">Visível para toda a equipe</div>
                                        </button>
                                    )}
                                </div>
                            </div>
                    </form>
                )}
            </div>

            {/* Premium Sticky Footer - Enhanced Responsiveness */}
            <div className="p-6 sm:p-8 border-t border-white/5 bg-[#0A0A0A] shrink-0 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
                <div className="flex flex-col gap-6">

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Meta Controls */}
                        <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-2 sm:gap-3 bg-white/5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-white/10 shadow-sm relative group shrink-0">
                                <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-gray-400 font-black text-[12px] sm:text-[13px] tracking-tight whitespace-nowrap">{formatDateForDisplay(date)}</span>
                                <button type="button" className="text-gray-500 hover:text-white transition-colors">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsLocked(!isLocked)}
                                className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-2xl border-2 transition-all duration-500 font-black tracking-widest text-[10px] sm:text-[11px] shadow-sm transform active:scale-95 shrink-0 ${!isLocked
                                    ? 'bg-[#065F46]/20 border-[#059669]/30 text-[#10B981]'
                                    : 'bg-[#7F1D1D]/20 border-[#DC2626]/30 text-[#EF4444]'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isLocked ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                    )}
                                </svg>
                                {isLocked ? 'PRIVADO' : 'VISÍVEL'}
                            </button>
                        </div>

                        {/* Action Buttons - Desktop */}
                        <div className="hidden sm:flex items-center gap-4">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="py-4 px-6 text-[14px] font-black text-gray-400 hover:text-white transition-all transform hover:translate-x-[-2px]"
                            >
                                Cancelar
                            </button>
                            <button
                                form="entry-form"
                                type="submit"
                                className="py-4 px-10 bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white text-[14px] font-black rounded-[22px] shadow-[0_12px_44px_rgba(109,40,217,0.4)] hover:shadow-[0_16px_56px_rgba(109,40,217,0.5)] hover:scale-[1.03] active:scale-[0.97] transition-all transform tracking-tight"
                            >
                                Salvar Registro
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons - Mobile Only */}
                    <div className="flex sm:hidden items-center gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-4 text-[13px] font-black text-gray-400 bg-white/5 rounded-2xl border border-white/5 active:bg-white/10"
                        >
                            Cancelar
                        </button>
                        <button
                            form="entry-form"
                            type="submit"
                            className="flex-[1.5] py-4 bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white text-[13px] font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all"
                        >
                            Salvar Registro
                        </button>
                    </div>

                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @media (max-width: 640px) {
                    .bg-[#121212] { border-radius: 0; max-height: 100dvh; height: 100dvh; }
                    .rounded-[40px] { border-radius: 0; }
                }
            `}} />
        </div>
    );
};
