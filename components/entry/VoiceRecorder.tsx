import React, { useState, useEffect, useRef } from 'react';

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscription, isProcessing }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const shouldBeListeningRef = useRef(false);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onresult = (event: any) => {
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    }
                }
                if (final) {
                    onTranscription(final);
                }
            };

            recognition.onend = () => {
                if (shouldBeListeningRef.current) {
                    try { recognition.start(); } catch (e) {
                        setTimeout(() => { if (shouldBeListeningRef.current) recognition.start(); }, 100);
                    }
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [onTranscription]);

    const toggleListening = () => {
        if (!recognitionRef.current || isProcessing) return;

        if (isListening) {
            shouldBeListeningRef.current = false;
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            shouldBeListeningRef.current = true;
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={toggleListening}
                disabled={isProcessing}
                className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isListening
                        ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse'
                        : 'bg-[#1A1A1A] hover:bg-[#222] border border-white/10'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                type="button"
            >
                {isListening ? (
                    <div className="w-8 h-8 bg-white rounded-sm" />
                ) : (
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
            </button>
        </div>
    );
};
