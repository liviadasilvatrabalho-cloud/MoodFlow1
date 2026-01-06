import React, { useState, useEffect, useRef } from 'react';

export interface TourStep {
    target: string; // data-tour selector value
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourOverlayProps {
    steps: TourStep[];
    isOpen: boolean;
    onComplete: () => void;
    onSkip: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ steps, isOpen, onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    useEffect(() => {
        if (isOpen && steps[currentStep]) {
            setIsCalculating(true);
            // Small delay to allow UI to settle if opening/navigating
            const timer = setTimeout(() => {
                const targetSelector = `[data-tour="${steps[currentStep].target}"]`;
                const element = document.querySelector(targetSelector);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTargetRect(element.getBoundingClientRect());
                } else {
                    // Fallback if target not found? Just center or skip
                    setTargetRect(null);
                }
                setIsCalculating(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, currentStep, steps]);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (isOpen && steps[currentStep]) {
                const targetSelector = `[data-tour="${steps[currentStep].target}"]`;
                const element = document.querySelector(targetSelector);
                if (element) setTargetRect(element.getBoundingClientRect());
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen, currentStep, steps]);


    if (!isOpen) return null;

    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;

    const handleNext = () => {
        if (isLast) {
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop with "Cutout" via clip-path or huge borders? 
                Simpler: a semi-transparent overlay everywhere, but we highlight the target with a border box on top 
            */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500" />

            {/* Highlighter Box */}
            {targetRect && (
                <div
                    className="absolute border-2 border-[#8b5cf6] shadow-[0_0_30px_rgba(139,92,246,0.5)] rounded-xl transition-all duration-500 ease-out z-[102] pointer-events-none"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                    }}
                />
            )}

            {/* Content Card */}
            <div
                className="absolute z-[103] transition-all duration-500 ease-out max-w-[90vw] md:max-w-md w-full"
                style={{
                    top: targetRect
                        ? (targetRect.bottom + 20 > window.innerHeight - 200 ? targetRect.top - 200 : targetRect.bottom + 20)
                        : '50%',
                    left: targetRect
                        ? Math.max(20, Math.min(window.innerWidth - 340, targetRect.left)) // Clamp to screen
                        : '50%',
                    transform: targetRect ? 'none' : 'translate(-50%, -50%)',
                    // Fallback to center if no target
                }}
            >
                <div className="bg-[#1A1A1A] border border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]" />

                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-[#8b5cf6]/10 text-[#8b5cf6] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#8b5cf6]/20">
                            Passo {currentStep + 1} de {steps.length}
                        </div>
                        <button onClick={onSkip} className="text-gray-500 hover:text-white text-xs font-bold transition-colors">
                            Pular Tour
                        </button>
                    </div>

                    <h3 className="text-xl font-black text-white mb-2 tracking-tight">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
                        {step.content}
                    </p>

                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className={`text-xs font-bold uppercase tracking-widest transition-colors ${currentStep === 0 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                        >
                            Anterior
                        </button>
                        <button
                            onClick={handleNext}
                            className="bg-white text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            {isLast ? 'Concluir' : 'Próximo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
