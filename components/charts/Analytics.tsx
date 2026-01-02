
import React, { useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MoodEntry, Language } from '../../types';
import { MOODS, TRANSLATIONS } from '../../constants';
import { aiService } from '../../services/aiService';
import { Button } from '../ui/Button';

interface AnalyticsProps {
    entries: MoodEntry[];
    lang: Language;
}

// Custom Dot uses the payload directly passed from chartData
const CustomizedDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
        <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24" className="overflow-visible drop-shadow-lg z-50 group">
            <text x="50%" y="50%" dy=".3em" textAnchor="middle" fontSize="20" className="cursor-pointer transition-transform hover:scale-125">
                {payload.emoji || '•'}
            </text>
        </svg>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        return (
            <div className="bg-neutral-950/95 border border-neutral-800 p-4 rounded-xl shadow-2xl max-w-[240px] backdrop-blur-xl z-50">
                <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-2">
                    {/* Display the EXACT emoji passed in the data payload */}
                    <span className="text-3xl drop-shadow-md">{data.emoji}</span>
                    <div>
                        <p className="text-white font-bold text-lg leading-none">{data.moodLabel}</p>
                        <div className="flex gap-2 text-[10px] text-gray-400 font-mono mt-1">
                            <span>{data.fullDate}</span>
                            <span>•</span>
                            <span>{data.time}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-gray-400 font-bold uppercase">Energy</span>
                        <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(data.energy / 10) * 100}%` }}></div>
                            </div>
                            <span className="text-blue-400 font-bold">{data.energy}</span>
                        </div>
                    </div>

                    {data.fullText && (
                        <div className="text-xs text-gray-300 italic leading-relaxed bg-black/20 p-2 rounded border border-white/5 max-h-20 overflow-y-auto custom-scrollbar">
                            "{data.fullText.length > 60 ? data.fullText.substring(0, 60) + '...' : data.fullText}"
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export const Analytics: React.FC<AnalyticsProps> = ({ entries, lang }) => {
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const chartScrollRef = useRef<HTMLDivElement>(null);

    // Local Date State (YYYY-MM-DD)
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    });

    // Local Month State (YYYY-MM)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        return new Date().toISOString().slice(0, 7);
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [insight, setInsight] = useState<any>(null);

    const t = TRANSLATIONS[lang];

    // FILTER OUT ENTRIES WITHOUT MOOD FOR CHARTS
    const validMoodEntries = entries.filter(e => {
        const isMood = e.entryMode === 'mood' || (!e.entryMode && e.mood !== null);
        return isMood && e.mood !== null && e.mood !== undefined;
    });

    if (validMoodEntries.length === 0) {
        return (
            <div className="bg-surface border border-neutral-800 rounded-2xl p-8 md:p-10 text-center">
                <p className="text-textMuted">{t.noData}</p>
            </div>
        );
    }

    // Sort entries by time ascending
    const sortedEntries = [...validMoodEntries].sort((a, b) => a.timestamp - b.timestamp);

    // Filter Data based on Selection
    let filteredData: MoodEntry[] = [];

    if (viewMode === 'day') {
        filteredData = sortedEntries.filter(e => {
            const d = new Date(e.timestamp);
            const offset = d.getTimezoneOffset() * 60000;
            const localISODate = new Date(d.getTime() - offset).toISOString().slice(0, 10);
            return localISODate === selectedDate;
        });
    } else if (viewMode === 'week') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
        filteredData = sortedEntries.filter(e => e.timestamp >= sevenDaysAgo);
    } else if (viewMode === 'month') {
        filteredData = sortedEntries.filter(e => {
            const d = new Date(e.timestamp);
            const offset = d.getTimezoneOffset() * 60000;
            const localISOMonth = new Date(d.getTime() - offset).toISOString().slice(0, 7);
            return localISOMonth === selectedMonth;
        });
    }

    // Format for Recharts - PRE-CALCULATE EMOJI AND TEXT
    const chartData = filteredData.map(e => {
        const d = new Date(e.timestamp);
        const moodVal = Number(e.mood); // Strict number conversion
        const moodObj = MOODS.find(m => m.value === moodVal);

        return {
            id: e.id,
            timestamp: e.timestamp, // Use Timestamp as unique key for XAxis to prevent dupes
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullDate: d.toLocaleDateString(),
            mood: moodVal,
            energy: e.energy || 5,
            // Pass explicit display data to avoid lookup errors in Tooltip/Dot
            emoji: moodObj?.emoji || '❓',
            moodLabel: moodObj?.label || e.moodLabel,
            fullText: e.text || ''
        };
    });

    const formatXAxis = (tickItem: number) => {
        const d = new Date(tickItem);
        if (viewMode === 'day') {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };

    const handleRunAnalysis = async () => {
        if (filteredData.length === 0) return;
        setIsAnalyzing(true);
        try {
            const period = viewMode === 'day' ? 'weekly' : viewMode === 'week' ? 'weekly' : 'monthly';
            const result = await aiService.generateAdvancedInsight(filteredData, period as any);
            setInsight(result);
        } catch (error) {
            console.error("AI Analysis failed:", error);
            alert("Erro ao realizar análise de evolução.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">

                {/* View Mode Switcher */}
                <div className="w-full md:w-auto flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto no-scrollbar">
                    <div className="flex w-full md:w-auto">
                        <button onClick={() => setViewMode('day')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'day' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}>{t.viewDay}</button>
                        <button onClick={() => setViewMode('week')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'week' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}>{t.days7}</button>
                        <button onClick={() => setViewMode('month')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${viewMode === 'month' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}>{t.viewMonth}</button>
                    </div>
                </div>

                {/* Date Picker Controls */}
                <div className="flex items-center gap-2">
                    {viewMode === 'day' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-[#7c3aed] transition-colors shadow-sm"
                        />
                    )}
                    {viewMode === 'month' && (
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-[#7c3aed] transition-colors shadow-sm"
                        />
                    )}
                </div>

            </div>

            {/* Main Mood Chart */}
            <div className="bg-surface p-2 md:p-6 rounded-3xl border border-neutral-800 shadow-2xl relative overflow-hidden">
                <h3 className="text-sm md:text-lg font-semibold mb-6 text-white flex items-center gap-2 px-2 md:px-0">
                    {t.moodFlow}
                    <span className="text-[10px] md:text-xs font-normal text-textMuted bg-neutral-900 px-2 py-1 rounded">
                        {filteredData.length} entries
                    </span>
                </h3>

                {/* ADDED min-w-0 to prevent flex/grid collapse causing width(-1) error */}
                {/* ADDED min-w-0 and horizontal scroll for mobile */}
                <div className="h-[250px] md:h-[350px] w-full overflow-x-auto overflow-y-hidden no-scrollbar cursor-grab active:cursor-grabbing select-none"
                    ref={chartScrollRef}>
                    <div style={{
                        width: typeof window !== 'undefined' && window.innerWidth < 768 ? `${Math.max(100, chartData.length * 60)}px` : '100%',
                        height: '100%'
                    }}>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
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
                                        tickMargin={10}
                                        interval={0}
                                        padding={{ left: 30, right: 30 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                    />
                                    <YAxis domain={[0, 6]} hide />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '5 5' }} trigger="hover" />
                                    <Area
                                        type="monotone"
                                        dataKey="mood"
                                        stroke="#7c3aed"
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                        fillOpacity={1}
                                        fill="url(#colorMood)"
                                        dot={<CustomizedDot />}
                                        activeDot={{ r: 8, strokeWidth: 0, fill: '#fff' }}
                                        isAnimationActive={true}
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-textMuted bg-neutral-900/30 rounded-2xl border border-dashed border-neutral-800 animate-pulse">
                                <span className="text-4xl mb-2">📊</span>
                                <p className="font-medium">{viewMode === 'day' ? 'Nenhum registro hoje' : 'Sem dados para este período'}</p>
                                <p className="text-xs opacity-50 mt-1">Seus registros aparecerão aqui em tempo real</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Energy Chart */}
            <div className="bg-surface p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-xl relative overflow-hidden">
                <h3 className="text-sm md:text-lg font-semibold mb-4 text-white">{t.energyLevels}</h3>
                {/* ADDED min-w-0 */}
                <div className="h-[150px] w-full min-w-0">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis
                                    dataKey="timestamp"
                                    type="category"
                                    hide
                                    padding={{ left: 20, right: 20 }}
                                />
                                <YAxis domain={[0, 12]} hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#333', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#60a5fa' }}
                                    labelStyle={{ color: '#a3a3a3' }}
                                    labelFormatter={(val) => new Date(val).toLocaleTimeString()}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="energy"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="url(#colorEnergy)"
                                    isAnimationActive={true}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-textMuted text-xs">No energy data for this period</div>
                    )}
                </div>
            </div>

            {/* AI Evolution Dashboard */}
            <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-950/20 p-6 md:p-10 rounded-[40px] border border-white/5 shadow-2xl space-y-8 animate-in slide-in-from-bottom-4 duration-1000">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-inner">✨</div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight">{t.aiEvolution}</h3>
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Powered by Clinical AI</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleRunAnalysis}
                        disabled={isAnalyzing || filteredData.length === 0}
                        className={`h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest gap-3 transition-all ${isAnalyzing ? 'opacity-50' : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_8px_30px_rgb(79,70,229,0.3)] hover:scale-[1.02]'}`}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Analisando Padrões...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                {t.requestAnalysis}
                            </>
                        )}
                    </Button>
                </div>

                {!insight && !isAnalyzing && (
                    <div className="py-20 border-2 border-dashed border-indigo-500/10 rounded-[32px] flex flex-col items-center justify-center text-center px-10 group hover:border-indigo-500/20 transition-all">
                        <div className="w-20 h-20 bg-indigo-500/5 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">🧠</div>
                        <h4 className="text-white font-bold mb-2">Pronto para a Evolução?</h4>
                        <p className="text-gray-500 text-sm max-w-sm font-medium leading-relaxed">Nossa IA clínica analisa seus registros para identificar padrões ocultos e seu score de estabilidade emocional.</p>
                    </div>
                )}

                {insight && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in zoom-in-95 duration-700">
                        {/* LEFT: Gauge & Badges */}
                        <div className="xl:col-span-4 space-y-8">
                            <div className="bg-black/40 p-10 rounded-[32px] border border-white/5 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[.3em] mb-6 relative z-10">{t.riskScore}</label>
                                <div className="relative w-40 h-40 flex items-center justify-center z-10">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent"
                                            strokeDasharray={440}
                                            strokeDashoffset={440 - (440 * insight.riskScore) / 100}
                                            strokeLinecap="round"
                                            className={`${insight.riskScore > 70 ? 'text-red-500' : insight.riskScore > 40 ? 'text-yellow-500' : 'text-green-500'} transition-all duration-1000 shadow-lg`}
                                        />
                                    </svg>
                                    <div className="absolute text-4xl font-black text-white">{insight.riskScore}</div>
                                </div>
                                <div className={`mt-6 inline-flex px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${insight.riskLevel === 'Elevated' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : insight.riskLevel === 'Moderate' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20' : 'bg-green-500/20 text-green-400 border border-green-500/20'}`}>
                                    {insight.riskLevel === 'Elevated' ? 'Atenção Necessária' : insight.riskLevel === 'Moderate' ? 'Oscilação Detectada' : 'Alta Estabilidade'}
                                </div>
                            </div>

                            <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[.2em]">{t.identifiedPatterns}</label>
                                <div className="flex flex-wrap gap-2">
                                    {insight.patterns.map((p: string, i: number) => (
                                        <span key={i} className="bg-indigo-500/10 text-indigo-300 text-[11px] font-bold px-4 py-2 rounded-xl border border-indigo-500/20">{p}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Descriptive Content */}
                        <div className="xl:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-black/30 p-8 rounded-[32px] border border-white/5">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[.2em] mb-4 block">{t.evolutionSummary}</label>
                                    <p className="text-sm text-gray-300 leading-relaxed font-medium">{insight.summary}</p>
                                </div>
                                <div className="bg-black/30 p-8 rounded-[32px] border border-white/5">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[.2em] mb-4 block">{t.periodAnalysis}</label>
                                    <p className="text-sm text-gray-300 leading-relaxed font-medium">{insight.periodSituation}</p>
                                </div>
                            </div>

                            <div className="bg-indigo-500/5 p-8 rounded-[32px] border border-indigo-500/10">
                                <div className="flex gap-4 items-start">
                                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👁️</div>
                                    <div className="space-y-4">
                                        <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.pointsOfAttention}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {insight.pointsOfAttention.map((point: string, i: number) => (
                                                <div key={i} className="flex gap-3 text-xs text-gray-400 font-medium">
                                                    <span className="text-indigo-500">▹</span> {point}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-black/20 p-8 rounded-[32px] border border-white/5 italic">
                                <p className="text-xs text-gray-500 leading-relaxed"><strong>Observação Clínica:</strong> Esta análise é preditiva e educacional. Não substitui o diagnóstico médico profissional. Em caso de crise, contate seu terapeuta imediatamente.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
