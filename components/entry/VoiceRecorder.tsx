
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscription, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState(''); // Text currently being spoken
  
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false); // Track user intent to handle auto-stops

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR'; // Default to Portuguese

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setTranscript(prev => prev + (prev ? ' ' : '') + final);
          setInterimTranscript('');
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' happens when silence is detected. We ignore it because onend will handle the restart
        // if the user still intends to be recording.
        if (event.error === 'no-speech') {
            return;
        }
        if (event.error === 'aborted') {
            return;
        }
        
        console.error("Speech recognition error", event.error);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
           setIsListening(false);
           shouldBeListeningRef.current = false;
        }
      };
      
      recognition.onend = () => {
          // If we are supposed to be listening (user didn't pause/stop), restart it.
          // This handles cases where the browser stops listening after silence.
          if (shouldBeListeningRef.current) {
              try {
                  recognition.start();
              } catch (e) {
                  // If it fails to restart (e.g. rapid fire), wait a bit
                  setTimeout(() => {
                      if (shouldBeListeningRef.current) {
                          try { recognition.start(); } catch(err) {}
                      }
                  }, 100);
              }
          } else {
              setIsListening(false);
          }
      }

      recognitionRef.current = recognition;
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
        try {
            shouldBeListeningRef.current = true;
            recognitionRef.current.start();
            setIsListening(true);
            setIsPaused(false);
        } catch (e) {
            console.log("Already started or error", e);
        }
    }
  };

  const pauseListening = () => {
    if (recognitionRef.current) {
        shouldBeListeningRef.current = false; // Tell onend NOT to restart
        recognitionRef.current.stop();
        setIsListening(false);
        setIsPaused(true);
        
        // Move any interim text to final transcript when pausing
        if (interimTranscript) {
            setTranscript(prev => prev + ' ' + interimTranscript);
            setInterimTranscript('');
        }
    }
  };

  const resumeListening = () => {
      startListening();
  };

  const stopAndSend = () => {
    if (recognitionRef.current) {
        shouldBeListeningRef.current = false;
        recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsPaused(false);
    
    // Combine final bits
    const fullText = transcript + (interimTranscript ? ' ' + interimTranscript : '');
    onTranscription(fullText);
  };

  const clear = () => {
      if (recognitionRef.current) {
          shouldBeListeningRef.current = false;
          recognitionRef.current.stop();
      }
      setIsListening(false);
      setIsPaused(false);
      setTranscript('');
      setInterimTranscript('');
  };

  // Helper to show current full text
  const currentDisplay = transcript + (interimTranscript ? ' ' + interimTranscript : '');

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-surfaceHighlight/50 rounded-2xl border border-neutral-700 w-full">
      
      {/* Transcript Preview Area - Realtime */}
      <div className="mb-6 w-full p-4 bg-black/40 rounded-xl min-h-[120px] max-h-[200px] overflow-y-auto border border-neutral-800 flex flex-col">
          {currentDisplay ? (
              <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
                  {transcript}
                  <span className="text-gray-400 italic">{interimTranscript}</span>
              </p>
          ) : (
              <p className="text-gray-600 italic text-center my-auto">O texto aparecerá aqui enquanto você fala...</p>
          )}
      </div>

      <div className="flex items-center gap-6 mb-4">
          {/* Main Control Button */}
          {!isListening ? (
             <button
                onClick={isPaused ? resumeListening : startListening}
                className={`h-16 w-16 rounded-full flex items-center justify-center transition-all border-2 shadow-lg hover:scale-105 ${isPaused ? 'bg-yellow-600 border-yellow-400' : 'bg-neutral-800 border-white/10 hover:bg-neutral-700'}`}
                title={isPaused ? "Retomar" : "Gravar"}
                type="button"
            >
                {isPaused ? (
                    // Resume Icon (Play)
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : (
                    // Mic Icon
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                )}
            </button>
          ) : (
            <button
                onClick={pauseListening}
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)] border-2 border-red-400"
                title="Pausar"
                type="button"
            >
                {/* Pause Icon */}
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          )}
      </div>
      
      <p className="text-textMuted text-xs font-bold uppercase tracking-wider mb-6">
          {isListening ? "Ouvindo... (Toque para pausar)" : (isPaused ? "Pausado (Toque para continuar)" : "Toque para gravar")}
      </p>

      {/* Action Buttons */}
      {(transcript || interimTranscript) && (
          <div className="w-full flex gap-3 animate-in slide-in-from-bottom-2">
              <Button 
                  variant="ghost" 
                  onClick={clear}
                  disabled={isProcessing}
                  type="button"
                  className="flex-1 border border-neutral-700 hover:bg-red-900/20 hover:text-red-400"
              >
                  Apagar
              </Button>
              <Button 
                  onClick={stopAndSend} 
                  isLoading={isProcessing}
                  type="button"
                  className="flex-[2] bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
              >
                  {isPaused || isListening ? "Parar e Salvar" : "Analisar Texto"}
              </Button>
          </div>
      )}
    </div>
  );
};
