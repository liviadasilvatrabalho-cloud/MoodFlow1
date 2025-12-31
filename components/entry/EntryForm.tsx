import React, { useState } from 'react';
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
    const t = TRANSLATIONS[lang];

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
    React.useEffect(() => {
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
        <div className="bg-[#111] backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl w-full max-w-xl mx-auto flex flex-col h-[90vh] md:h-auto animate-in zoom-in-95 duration-300">

            {/* Nav Header */}
            <div className="px-6 pt-6 pb-2 shrink-0">
                <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 relative z-10 w-full">
                    {(['mood', 'diary', 'voice'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`flex-1 py-2.5 text-[12px] font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${mode === m
                                    ? 'bg-gradient-to-br from-[#7733ff] to-[#5522cc] text-white shadow-[0_5px_15px_-5px_rgba(119,51,255,0.4)]'
                                    : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            {m === 'mood' && <span>📊 Humor</span>}
                            {m === 'diary' && <span>📖 Diário</span>}
                            {m === 'voice' && <span>🎙️ Voz IA</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {mode === 'voice' ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-white font-bold text-xl tracking-tight">Estou ouvindo...</h3>
                            <p className="text-gray-400 text-sm max-w-[280px]">
                                Conte sobre seu dia ou como se sente. A IA detectará seu humor e escreverá no diário.
                            </p>
                        </div>

                        <div className="w-full bg-black/30 rounded-2xl border border-white/5 p-6 h-48 flex items-center justify-center relative group">
                            <p className="text-gray-600 italic text-sm text-center">
                                {isAnalyzing ? 'Processando áudio...' : (text || 'O texto aparecerá aqui enquanto você fala...')}
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <VoiceRecorder onTranscription={handleVoiceTranscription} isProcessing={isAnalyzing} />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Toque para gravar</span>
                        </div>
                    </div>
                ) : (
                    <form id="entry-form" onSubmit={handleSubmit} className="space-y-8">

                        {mode === 'mood' && (
                            <>
                                {/* Mood Grid */}
                                <div className="space-y-4">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-[0.1em] font-black ml-1">COMO VOCÊ ESTÁ SE SENTINDO?</label>
                                    <div className="grid grid-cols-5 gap-3">
                                        {MOODS.map((m) => {
                                            const isSelected = mood === m.value;
                                            return (
                                                <button
                                                    key={m.value}
                                                    type="button"
                                                    onClick={() => setMood(m.value)}
                                                    className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all duration-300 border-2 ${isSelected
                                                            ? 'bg-white/5 border-white/20 ring-2 ring-primary ring-offset-4 ring-offset-[#111]'
                                                            : 'bg-white/5 border-transparent opacity-40 hover:opacity-100'
                                                        }`}
                                                >
                                                    <span className="text-2xl md:text-3xl mb-1">{m.emoji}</span>
                                                    {isSelected && <span className="text-[9px] font-black uppercase text-white tracking-tighter">{m.label}</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Energy Slider */}
                                <div className="space-y-4 bg-black/20 p-6 rounded-[24px] border border-white/5 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-[0.1em] font-black">NÍVEL DE ENERGIA</label>
                                        <span className="text-yellow-400 font-black text-xl">{energy}<span className="text-gray-600 text-xs font-bold"> /10</span></span>
                                    </div>
                                    <div className="relative h-2 w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
                                        <input
                                            type="range" min="1" max="10" value={energy}
                                            onChange={(e) => setEnergy(Number(e.target.value))}
                                            className="absolute inset-0 w-full h-2 bg-transparent appearance-none cursor-pointer accent-primary"
                                        />
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full pointer-events-none"
                                            style={{ left: `${(energy - 1) * 10}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Tags */}
                                <div className="space-y-4">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-[0.1em] font-black ml-1">TAGS</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[...ACTIVITIES, ...SYMPTOMS].map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleTag(tag)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${selectedTags.includes(tag)
                                                        ? 'bg-white/10 border-white/20 text-white shadow-lg'
                                                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                                                    }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Notes Area */}
                        <div className="space-y-4">
                            <label className="text-[10px] text-gray-400 uppercase tracking-[0.1em] font-black ml-1 flex items-center gap-2">
                                📝 {mode === 'diary' ? 'DIÁRIO' : 'NOTAS'}
                            </label>
                            <textarea
                                className={`w-full bg-black/20 border border-white/5 rounded-2xl p-6 text-gray-200 placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none shadow-inner ${mode === 'diary' ? 'h-64' : 'h-32'
                                    }`}
                                placeholder={mode === 'diary' ? 'Escreva sobre seu dia...' : 'Algo a acrescentar?'}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                    </form>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-black/20 shrink-0">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-gray-500 font-bold text-[11px]">
                        <span className="flex items-center gap-2">
                            {formatDateForDisplay(date)}
                            <button type="button" onClick={() => { }} className="text-gray-400 hover:text-white">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                        </span>

                        <button
                            type="button"
                            onClick={() => setIsLocked(!isLocked)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isLocked
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : 'bg-green-500/10 border-green-500/20 text-green-400'
                                }`}
                        >
                            {isLocked ? (
                                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> PRIVADO</>
                            ) : (
                                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> VISÍVEL</>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 md:flex-none py-3 px-6 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            form="entry-form"
                            type="submit"
                            className="flex-1 md:flex-none py-3 px-8 bg-gradient-to-br from-[#7733ff] to-[#5522cc] text-white text-sm font-bold rounded-2xl shadow-[0_5px_20px_-5px_rgba(119,51,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
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
                    width: 0;
                    height: 0;
                }
            `}} />
        </div>
    );
};
