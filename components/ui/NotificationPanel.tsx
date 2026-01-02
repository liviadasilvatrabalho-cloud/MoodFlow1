import React, { useEffect, useState } from 'react';
import { Notification } from '../../types';
import { storageService } from '../../services/storageService';
import { Button } from './Button';

interface NotificationPanelProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId, isOpen, onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (isOpen) {
            const unsubscribe = storageService.subscribeNotifications(userId, (data) => {
                setNotifications(data);
            });
            return () => unsubscribe();
        }
    }, [isOpen, userId]);

    const handleMarkAsRead = async (id: string) => {
        await storageService.markNotificationAsRead(id);
    };

    const handleMarkAllRead = async () => {
        await storageService.markAllNotificationsAsRead(userId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md h-full bg-[#0A0A0A] border-l border-white/5 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Notificações</h2>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Recentes</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-indigo-400 hover:text-white font-black uppercase tracking-widest transition-colors mr-4"
                        >
                            Marcar lido
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                            <div className="text-4xl mb-4">🔔</div>
                            <p className="text-sm text-gray-400 font-medium">Nenhuma notificação por aqui.</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => handleMarkAsRead(n.id)}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${n.readAt ? 'bg-surface/30 border-white/5' : 'bg-surface border-indigo-500/30 shadow-lg'}`}
                            >
                                {!n.readAt && <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}

                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 ${n.type === 'comment_created' ? 'bg-indigo-500/10 text-indigo-400' :
                                            n.type === 'risk_alert' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                        {n.type === 'comment_created' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                                        {n.type === 'risk_alert' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                                        {(n.type === 'entry_shared' || n.type === 'message_created') && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-[13px] font-black tracking-tight ${n.readAt ? 'text-gray-400' : 'text-white'}`}>{n.title}</h4>
                                        <p className="text-[12px] text-gray-500 mt-1 leading-relaxed font-medium line-clamp-2">{n.message}</p>
                                        <span className="text-[9px] text-gray-600 font-mono mt-2 block uppercase tracking-widest">
                                            {new Date(n.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-black/20">
                    <Button variant="outline" className="w-full h-12 text-xs border-white/10 hover:bg-white/5" onClick={onClose}>
                        Fechar Painel
                    </Button>
                </div>
            </div>
        </div>
    );
};
