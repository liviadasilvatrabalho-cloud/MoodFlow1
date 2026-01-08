import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../../services/storageService';

// AudioRecorder Component
export const AudioRecorder = ({ onSend }: { onSend: (blob: Blob, duration: number) => void }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const startTimeRef = useRef<number>(0);
    const chunksRef = useRef<Blob[]>([]);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isRecording) {
            interval = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 100);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            console.log('[AudioRecorder] Stopping recording...');
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } else {
            // Start recording
            console.log('[AudioRecorder] Starting recording...');
            try {
                console.log('[AudioRecorder] Requesting microphone access...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('[AudioRecorder] Microphone access granted');

                streamRef.current = stream;
                chunksRef.current = [];

                // iOS/Safari compatibility: prioritize supported mime types
                const mimeTypes = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/mp4',
                    'audio/ogg',
                    'audio/aac'
                ];
                const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
                console.log('[AudioRecorder] Selected MIME type:', mimeType || 'default');

                const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        console.log('[AudioRecorder] Chunk received:', e.data.size, 'bytes');
                        chunksRef.current.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    console.log('[AudioRecorder] Recording stopped, chunks:', chunksRef.current.length);
                    const finalDuration = Math.ceil((Date.now() - startTimeRef.current) / 1000);
                    const type = mimeType || recorder.mimeType || 'audio/webm';
                    const blob = new Blob(chunksRef.current, { type });

                    if (chunksRef.current.length > 0) {
                        console.log('[AudioRecorder] Sending audio blob:', blob.size, 'bytes, duration:', finalDuration, 's');
                        onSend(blob, finalDuration);
                    } else {
                        console.warn('[AudioRecorder] No audio data recorded');
                    }

                    // Clean up stream
                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                    }

                    setIsRecording(false);
                };

                startTimeRef.current = Date.now();
                recorder.start();
                console.log('[AudioRecorder] Recording started');
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
            } catch (err) {
                console.error('[AudioRecorder] Error:', err);
                alert("Permissão de microfone negada ou erro ao iniciar.");
            }
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-xl transition-all duration-200 ${isRecording ? 'bg-red-500 scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'}`}
                title={isRecording ? "Clique para parar e enviar" : "Clique para gravar"}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
            {isRecording && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap animate-pulse shadow-lg z-50">
                    Gravando {duration}s
                </div>
            )}
        </div>
    );
};

// AudioPlayer Component
export const AudioPlayer = ({ url, duration }: { url: string, duration?: number }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        if (!url) {
            setError(true);
            setLoading(false);
            return;
        }

        setLoading(true);
        storageService.getAudioUrl(url).then(u => {
            if (active) {
                if (u) setSignedUrl(u);
                else setError(true);
                setLoading(false);
            }
        }).catch(err => {
            console.error(err);
            if (active) {
                setError(true);
                setLoading(false);
            }
        });

        return () => { active = false; };
    }, [url]);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => {
                console.error("Playback error:", err);
                setError(true);
            });
        }
    };

    const formatTime = (sec: number) => {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (error) return <div className="text-red-500 text-[10px] bg-red-500/10 px-2 py-1 rounded">Erro ao carregar áudio</div>;
    if (loading) return <div className="text-white/40 text-[10px] animate-pulse">...</div>;

    return (
        <div className="flex items-center gap-3 bg-black/40 rounded-2xl p-3 mt-2 w-full border border-white/5 group">
            <audio
                ref={audioRef}
                src={signedUrl || undefined}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setProgress(0); }}
                onTimeUpdate={() => {
                    if (audioRef.current) {
                        const cur = audioRef.current.currentTime;
                        const dur = audioRef.current.duration;
                        if (dur) setProgress((cur / dur) * 100);
                    }
                }}
                onError={() => setError(true)}
                preload="auto"
            />
            <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-[#8b5cf6] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                disabled={error || loading}
            >
                {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
            </button>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                <div className="h-full bg-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-all duration-100" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 font-mono tracking-tighter">
                {duration ? formatTime(duration) : (audioRef.current?.duration ? formatTime(audioRef.current.duration) : '--:--')}
            </span>
        </div>
    );
};
