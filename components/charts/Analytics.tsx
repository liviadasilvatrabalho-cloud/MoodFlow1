
import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MoodEntry, Language } from '../../types';
import { MOODS, TRANSLATIONS } from '../../constants';

interface AnalyticsProps {
    entries: MoodEntry[];
    lang: Language;
}

// Custom Dot uses the payload directly passed from chartData
const CustomizedDot = (props: any) => {
    const { cx, cy, payload } = props;
    // Use the emoji directly from the processed data, no lookup needed. GUARANTEES MATCH.
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

                {/* Date Pickers */}
                <div className="flex gap-4 w-full md:w-auto justify-center">
                    {viewMode === 'day' && (
                        <div className="relative group w-full md:w-auto">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full md:w-auto bg-neutral-900 text-white text-sm font-bold px-4 py-2 rounded-xl border border-neutral-700 focus:border-primary focus:outline-none shadow-lg"
                            />
                        </div>
                    )}
                    {viewMode === 'month' && (
                        <div className="relative group w-full md:w-auto">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full md:w-auto bg-neutral-900 text-white text-sm font-bold px-4 py-2 rounded-xl border border-neutral-700 focus:border-primary focus:outline-none shadow-lg"
                            />
                        </div>
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
                <div className="h-[250px] md:h-[350px] w-full min-w-0">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
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
                                    tickMargin={15}
                                    interval={viewMode === 'month' ? Math.floor(chartData.length / 5) : 0}
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
        </div>
    );
};
