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
}

const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
};

export const EntryForm: React.FC<EntryFormProps> = ({ userId, userRole, onSave, onCancel, initialMode = 'mood', lang }) => {
    const [mode, setMode] = useState<'mood' | 'voice' | 'diary'>(initialMode);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Translations
    const t = TRANSLATIONS[lang] || TRANSLATIONS['pt'];

    // Form State
    const [mood, setMood] = useState<number>(3);
    const [energy, setEnergy] = useState<number>(5);
    const [text, setText] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [date, setDate] = useState(getLocalISOString());
    const [connectedDoctors, setConnectedDoctors] = useState<{ id: string, name: string }[]>([]);
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);

    // Fetch Doctors
    useEffect(() => {
        if (userId && userRole === UserRole.PATIENT) {
            storageService.getConnectedDoctors(userId).then(setConnectedDoctors);
        }
    }, [userId, userRole]);

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

            if (analysis.intentToSave) {
                const entryDate = new Date(date);
                const now = new Date();
                const isCurrentMinute = Math.abs(now.getTime() - entryDate.getTime()) < 60000;
                const finalTimestamp = isCurrentMinute ? now.getTime() : entryDate.getTime();

                const newEntry: MoodEntry = {
                    id: crypto.randomUUID(),
                    userId,
                    date: entryDate.toISOString(),
                    timestamp: finalTimestamp,
                    mood: null,
                    moodLabel: 'Diário',
                    energy: null,
                    text: analysis.transcription,
                    tags: analysis.detectedTags || [],
                    isLocked: selectedDoctors.length === 0,
                    permissions: selectedDoctors,
                    entryMode: 'voice',
                    aiAnalysis: {
                        sentiment: "Voice AI",
                        summary: analysis.summary || "Voice Entry",
                        triggers: []
                    }
                };
                onSave(newEntry);
                return;
            }
        } else {
            setText(transcribedText);
            setMode('diary');
        }
        setIsAnalyzing(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const entryDate = new Date(date);
        const now = new Date();
        const isCurrentMinute = Math.abs(now.getTime() - entryDate.getTime()) < 60000;
        const finalTimestamp = isCurrentMinute ? now.getTime() : entryDate.getTime();

        const newEntry: MoodEntry = {
            id: crypto.randomUUID(),
            userId,
            date: entryDate.toISOString(),
            timestamp: finalTimestamp,
            mood: mode === 'mood' ? mood : null,
            moodLabel: mode === 'mood' ? (MOODS.find(m => m.value === mood)?.label || 'Okay') : t.diary,
            energy: mode === 'mood' ? energy : null,
            text,
            tags: mode === 'mood' ? selectedTags : [],
            isLocked: selectedDoctors.length === 0,
            permissions: selectedDoctors,
            entryMode: mode
        };
        onSave(newEntry);
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const formatDateForDisplay = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-[#0D0D0D] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] w-full max-w-xl mx-auto flex flex-col h-full max-h-[92vh] animate-in zoom-in-95 duration-300">

            {/* Header Tabs */}
            <div className="px-6 pt-6 pb-2 shrink-0">
                <div className="flex p-1 bg-black/60 rounded-3xl border border-white/5 relative z-10 w-full">
                    {(['mood', 'diary', 'voice'] as const).map((m) => {
                        const isSelected = mode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`flex-1 py-3 text-[13px] font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 ${isSelected
                                        ? 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white shadow-lg'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
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

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 scroll-smooth">
                {mode === 'voice' ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 py-4">
                        <div className="space-y-3">
                            <h3 className="text-white font-bold text-2xl tracking-tight">Estou ouvindo...</h3>
                            <p className="text-gray-500 text-sm max-w-[320px] mx-auto leading-relaxed">
                                Conte sobre seu dia ou como se sente. A IA detectará seu humor e escreverá no diário.
                            </p>
                        </div>

                        <div className="w-full bg-black/40 rounded-[32px] border border-white/5 p-8 h-48 flex items-center justify-center shadow-inner group">
                            <p className={`text-sm text-center transition-all ${text ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                                {isAnalyzing ? 'Analisando sua voz...' : (text || 'O texto aparecerá aqui enquanto você fala...')}
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-6">
                            <div className="transform scale-[1.5]">
                                <VoiceRecorder onTranscription={handleVoiceTranscription} isProcessing={isAnalyzing} />
                            </div>
                            <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">Toque para gravar</span>
                        </div>
                    </div>
                ) : (
                    <form id="entry-form" onSubmit={handleSubmit} className="space-y-10">

                        {mode === 'mood' && (
                            <>
                                {/* Mood Selection Grid */}
                                <div className="space-y-4">
                                    <label className="text-[11px] text-gray-500 uppercase tracking-[0.15em] font-black ml-1">COMO VOCÊ ESTÁ SE SENTINDO?</label>
                                    <div className="grid grid-cols-5 gap-3">
                                        {MOODS.map((m) => {
                                            const isSelected = mood === m.value;
                                            return (
                                                <button
                                                    key={m.value}
                                                    type="button"
                                                    onClick={() => setMood(m.value)}
                                                    className={`aspect-square flex flex-col items-center justify-center rounded-[24px] transition-all duration-300 border ${isSelected
                                                            ? 'bg-[#1A1A1A] border-white/20 shadow-xl scale-105'
                                                            : 'bg-white/5 border-transparent opacity-40 hover:opacity-100'
                                                        }`}
                                                >
                                                    <span className="text-3xl md:text-4xl mb-2 select-none">{m.emoji}</span>
                                                    {isSelected && <span className="text-[10px] font-black uppercase text-white tracking-tight">{m.label}</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Energy Slider */}
                                <div className="space-y-5 bg-black/40 p-8 rounded-[32px] border border-white/5 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] text-gray-500 uppercase tracking-[0.15em] font-black">NÍVEL DE ENERGIA</label>
                                        <span className="text-[#FFD700] font-black text-2xl">{energy}<span className="text-gray-600 text-sm font-bold ml-1">/10</span></span>
                                    </div>
                                    <div className="relative pt-4 pb-2">
                                        <div className="h-2.5 w-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-full" />
                                        <input
                                            type="range" min="1" max="10" value={energy}
                                            onChange={(e) => setEnergy(Number(e.target.value))}
                                            className="absolute top-1/2 -translate-y-1/2 w-full h-10 bg-transparent appearance-none cursor-pointer accent-transparent z-10"
                                        />
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-[#8b5cf6] border-[3px] border-white rounded-full shadow-[0_0_15px_-2px_#8b5cf6] pointer-events-none transition-all duration-75"
                                            style={{ left: `calc(${(energy - 1) / 9 * 100}% - 12px)` }}
                                        />
                                    </div>
                                </div>

                                {/* Tags Pillbox */}
                                <div className="space-y-4">
                                    <label className="text-[11px] text-gray-500 uppercase tracking-[0.15em] font-black ml-1">TAGS</label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {[...ACTIVITIES, ...SYMPTOMS].map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleTag(tag)}
                                                className={`px-5 py-2.5 rounded-full text-[12px] font-bold transition-all border ${selectedTags.includes(tag)
                                                        ? 'bg-white text-black border-white shadow-xl'
                                                        : 'bg-[#1A1A1A] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
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
                        <div className="space-y-4">
                            <label className="text-[11px] text-gray-500 uppercase tracking-[0.15em] font-black ml-1 flex items-center gap-2">
                                {mode === 'diary' ? '📖 DIÁRIO' : '📝 NOTAS'}
                            </label>
                            <textarea
                                className={`w-full bg-black/40 border border-white/5 rounded-[28px] p-6 text-gray-100 placeholder-gray-700 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all resize-none shadow-inner leading-relaxed ${mode === 'diary' ? 'h-72' : 'h-36'
                                    }`}
                                placeholder={mode === 'diary' ? 'Como foi o seu dia? Escreva livremente...' : 'Algo a acrescentar?'}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                    </form>
                )}
            </div>

            {/* Premium Footer */}
            <div className="p-6 border-t border-white/5 bg-black/40 shrink-0">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                    {/* Meta Controls */}
                    <div className="flex items-center gap-4 text-gray-400 font-bold text-[12px]">
                        <div className="flex items-center gap-2.5 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/5">
                            <span className="opacity-60">{formatDateForDisplay(date)}</span>
                            <button type="button" className="text-gray-400 hover:text-white ml-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsLocked(!isLocked)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all font-black tracking-widest text-[10px] ${!isLocked
                                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                                }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isLocked ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                )}
                            </svg>
                            {isLocked ? 'PRIVADO' : 'VISÍVEL'}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 md:flex-none py-4 px-6 text-sm font-bold text-gray-500 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            form="entry-form"
                            type="submit"
                            className="flex-1 md:flex-none py-4 px-10 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white text-sm font-black rounded-[20px] shadow-[0_8px_30px_rgb(124,58,237,0.3)] hover:shadow-[0_12px_40px_rgb(124,58,237,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Salvar Registro
                        </button>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
                
                input[type='range']::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: transparent;
                    cursor: pointer;
                }
                
                @media (max-width: 640px) {
                    .bg-[#0D0D0D] { border-radius: 0; max-height: 100vh; height: fill-available; }
                }
            `}} />
        </div>
    );
};
