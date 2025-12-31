
import React, { useState } from 'react';
import { MOODS, ACTIVITIES, SYMPTOMS, TRANSLATIONS } from '../../constants';
import { Button } from '../ui/Button';
import { VoiceRecorder } from './VoiceRecorder';
import { geminiService } from '../../services/geminiService';
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

        const analysis = await geminiService.analyzeEntry(transcribedText);

        if (analysis) {
            setText(analysis.transcription || transcribedText);

            if (analysis.moodScore) setMood(analysis.moodScore);
            if (analysis.energyLevel) setEnergy(analysis.energyLevel);

            if (analysis.detectedTags && Array.isArray(analysis.detectedTags)) {
                setSelectedTags(prev => Array.from(new Set([...prev, ...analysis.detectedTags])));
            }

            if (analysis.mode === 'diary') {
                setMode('diary');
            } else if (analysis.mode === 'mood') {
                setMode('mood');
            }

            if (analysis.intentToSave) {
                const detectedMoodVal = analysis.moodScore || 3;
                let finalMood: number | null = detectedMoodVal;
                let finalLabel = MOODS.find(m => m.value === detectedMoodVal)?.label || 'Okay';

                const entryDate = new Date(date);
                const now = new Date();
                const isCurrentMinute = Math.abs(now.getTime() - entryDate.getTime()) < 60000;
                const finalTimestamp = isCurrentMinute ? now.getTime() : entryDate.getTime();

                const newEntry: MoodEntry = {
                    id: crypto.randomUUID(),
                    userId,
                    date: entryDate.toISOString(),
                    timestamp: finalTimestamp,
                    mood: null, // Voice AI entries are diary by default now
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

        let finalMood: number | null = mood;
        let finalLabel = MOODS.find(m => m.value === mood)?.label || 'Okay';

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

    return (
        <div className="bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl w-full max-w-xl mx-auto animate-in zoom-in-95 duration-200 h-[92vh] md:h-auto md:max-h-[95vh] flex flex-col">

            {/* Tab Switcher */}
            <div className="px-4 pt-4 pb-2 shrink-0 border-b border-white/5">
                <div className="flex p-1 bg-black/40 backdrop-blur-md rounded-2xl relative z-10 w-full overflow-hidden">
                    {(['mood', 'diary', 'voice'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`flex-1 py-2 text-[11px] md:text-sm font-bold rounded-xl transition-all duration-300 ${mode === m
                                ? 'bg-gradient-to-br from-primary to-primaryDark text-white shadow-lg'
                                : 'text-textMuted hover:text-white'
                                }`}
                        >
                            {m === 'mood' && t.tabMood}
                            {m === 'diary' && t.tabDiary}
                            {m === 'voice' && t.tabVoice}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 w-full space-y-6">
                {mode === 'voice' ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-4">
                        <h3 className="text-white font-bold mb-2 text-lg text-center">{t.listening}</h3>
                        <p className="text-textMuted text-xs md:text-sm text-center mb-6 px-4">
                            {t.voicePrompt}
                        </p>
                        <VoiceRecorder onTranscription={handleVoiceTranscription} isProcessing={isAnalyzing} />
                    </div>
                ) : (
                    <form id="entry-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Mood Selection - Only show in mood mode */}
                        {mode !== 'diary' && (
                            <div className="space-y-3">
                                <label className="text-[10px] md:text-xs text-textMuted uppercase tracking-widest font-bold ml-1">{t.howAreYou}</label>
                                <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full">
                                    {MOODS.map((m) => {
                                        const isSelected = mood === m.value;
                                        return (
                                            <button
                                                key={m.value}
                                                type="button"
                                                onClick={() => setMood(m.value)}
                                                className={`flex flex-col items-center justify-center py-2.5 md:py-3 rounded-2xl transition-all duration-300 border ${isSelected
                                                    ? `${m.bg} ${m.border} scale-105 shadow-xl`
                                                    : 'bg-white/5 border-transparent opacity-60'
                                                    }`}
                                            >
                                                <span className="text-xl md:text-3xl drop-shadow-md mb-0.5">{m.emoji}</span>
                                                {isSelected && (
                                                    <span className={`text-[7px] md:text-[9px] font-black uppercase tracking-tighter ${m.color}`}>
                                                        {m.label}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Energy Slider - Only show in mood mode */}
                        {mode !== 'diary' && (
                            <div className="space-y-3 bg-black/30 p-4 rounded-3xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] text-textMuted uppercase tracking-widest font-bold">{t.energy}</label>
                                    <span className={`text-xl font-black tabular-nums ${energy > 7 ? 'text-green-400' : energy > 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {energy}<span className="text-xs text-gray-500 font-normal ml-1">/10</span>
                                    </span>
                                </div>
                                <input
                                    type="range" min="1" max="10" value={energy}
                                    onChange={(e) => setEnergy(Number(e.target.value))}
                                    className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                                />
                            </div>
                        )}

                        {/* Tags - Only show in mood mode */}
                        {mode !== 'diary' && (
                            <div className="space-y-3">
                                <label className="text-[10px] text-textMuted uppercase tracking-widest font-bold ml-1">{t.tags}</label>
                                <div className="flex flex-wrap gap-2">
                                    {[...ACTIVITIES, ...SYMPTOMS].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(tag)}
                                            className={`px-4 py-2.5 rounded-xl text-[11px] md:text-sm font-bold transition-all border ${selectedTags.includes(tag)
                                                ? 'bg-white text-black border-white shadow-md'
                                                : 'bg-neutral-800/50 border-white/5 text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes Area - Always visible */}
                        <div className="space-y-3 pt-2">
                            <label className="text-[10px] text-textMuted uppercase tracking-widest font-bold ml-1">
                                {mode === 'diary' ? 'Querido Diário...' : t.notesTitle}
                            </label>
                            <textarea
                                className={`w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-gray-200 placeholder-gray-700 focus:outline-none focus:border-primary transition-all resize-none ${mode === 'diary' ? 'h-48 md:h-64' : 'h-24'}`}
                                placeholder={mode === 'diary' ? t.placeholderDiary : t.placeholderMood}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                    </form>
                )}
            </div>

            {/* Footer Fixed */}
            <div className="px-4 py-4 md:px-6 md:py-6 border-t border-white/5 bg-neutral-900/50 shrink-0">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <input
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-transparent text-textMuted text-[10px] font-bold focus:outline-none"
                    />

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {userRole === UserRole.PATIENT && connectedDoctors.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center mr-auto">
                                <span className="text-[10px] text-textMuted uppercase font-bold mr-1">Compartilhar com:</span>
                                {connectedDoctors.map(doc => (
                                    <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => setSelectedDoctors(prev =>
                                            prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                                        )}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${selectedDoctors.includes(doc.id)
                                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                            : 'bg-neutral-800 border-white/5 text-gray-500'
                                            }`}
                                    >
                                        {doc.name}
                                    </button>
                                ))}
                                {selectedDoctors.length === 0 && (
                                    <span className="text-[9px] text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md uppercase font-black">Privado</span>
                                )}
                            </div>
                        )}
                        {/* Remove legacy isLocked button - handled by doctor selection above */}
                        {userRole === UserRole.PROFESSIONAL && (
                            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl">
                                <span className="text-[10px] font-black uppercase text-indigo-400">Modo Profissional</span>
                            </div>
                        )}

                        <Button variant="ghost" onClick={onCancel} className="h-10 text-[11px] md:text-sm">{t.cancel}</Button>
                        <Button
                            form="entry-form"
                            type="submit"
                            className="bg-primary hover:bg-primaryDark text-white h-10 px-6 text-[11px] md:text-sm shadow-xl flex-1 md:flex-none"
                            onClick={mode === 'voice' ? undefined : (e) => {
                                // Prevent default if not using form submission (button is outside form in voice mode)
                                if (mode === 'voice') {
                                    e.preventDefault();
                                    // Logic would be handled by VoiceRecorder, but we need to trigger save if text exists
                                }
                            }}
                        >
                            {t.save}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
