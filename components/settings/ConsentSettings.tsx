import React, { useState, useEffect } from 'react';
import { User, Language, UserRole } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { storageService } from '../../services/storageService';
import { Button } from '../ui/Button';

interface ConsentSettingsProps {
    user: User;
}

export const ConsentSettings: React.FC<ConsentSettingsProps> = ({ user }) => {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const lang: Language = user.language || 'pt';
    const t = TRANSLATIONS[lang];

    useEffect(() => {
        loadConnections();
    }, [user.id]);

    const loadConnections = async () => {
        try {
            const data = await storageService.getPatientConnections(user.id);
            setConnections(data);
        } catch (error) {
            console.error("Failed to load connections:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async (doctorId: string) => {
        if (!confirm(t.confirmDisconnect || "Tem certeza que deseja revogar o acesso deste profissional?")) return;

        try {
            await storageService.disconnectDoctor(user.id, doctorId);
            setConnections(prev => prev.filter(c => c.doctor_id !== doctorId));
            alert(t.disconnectSuccess || "Acesso revogado com sucesso.");
        } catch (error) {
            console.error("Failed to disconnect:", error);
            alert("Erro ao revogar acesso.");
        }
    };

    if (loading) return <div className="p-8 text-center text-textMuted italic">Carregando...</div>;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <header>
                <h2 className="text-xl font-bold text-white mb-2">{t.consentManagement || "Gestão de Consentimento"}</h2>
                <p className="text-sm text-textMuted leading-relaxed">
                    Aqui você controla quem pode visualizar seus registros de humor e notas de voz. Você pode revogar o acesso de qualquer profissional a qualquer momento.
                </p>
            </header>

            <div className="bg-surface rounded-2xl border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-textMuted uppercase tracking-wider">Meus Profissionais de Saúde</h3>
                </div>

                {connections.length === 0 ? (
                    <div className="p-12 text-center">
                        <span className="text-3xl mb-4 block">🛡️</span>
                        <p className="text-textMuted text-sm">Você não está conectado a nenhum profissional no momento.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-neutral-800">
                        {connections.map((conn) => (
                            <div key={conn.doctor_id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner ${conn.doctor_role === UserRole.PSICOLOGO ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {conn.doctor_role === UserRole.PSICOLOGO ? '🧠' : '💊'}
                                    </div>
                                    <div>
                                        <div className="font-black text-white text-base tracking-tight">{conn.doctor_name || 'Profissional'}</div>
                                        <div className={`text-[10px] uppercase font-black tracking-widest mt-1 ${conn.doctor_role === UserRole.PSICOLOGO ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                            {conn.doctor_role === UserRole.PSICOLOGO ? 'Seu Psicólogo' : conn.doctor_role === UserRole.PSIQUIATRA ? 'Seu Psiquiatra' : 'Profissional de Saúde'}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => handleDisconnect(conn.doctor_id)}
                                    className="h-9 px-4 text-[10px] uppercase font-black border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all hover:scale-105"
                                >
                                    Revogar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-4">
                <div className="text-xl">ℹ️</div>
                <div className="text-sm text-blue-200/80 leading-relaxed">
                    <strong>Portabilidade de Dados:</strong> Você tem o direito de baixar todos os seus dados. Use a opção de exportação nas configurações principais para obter um arquivo JSON com todo o seu histórico.
                </div>
            </div>
        </div>
    );
};
