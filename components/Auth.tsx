
import React, { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { storageService } from '../services/storageService'
import { UserRole } from '../types'


interface AuthProps {
    isAdminMode?: boolean;
}

export default function Auth({ isAdminMode = false }: AuthProps) {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<UserRole>(isAdminMode ? UserRole.ADMIN_CLINICA : UserRole.PACIENTE)
    const [selectedCategory, setSelectedCategory] = useState<'PACIENTE' | 'PROFISSIONAL' | 'ADMIN_CLINICA'>(isAdminMode ? 'ADMIN_CLINICA' : 'PACIENTE')
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()

        // Prevent generic professional registration
        if (isSignUp && selectedCategory === 'PROFISSIONAL' && role !== UserRole.PSICOLOGO && role !== UserRole.PSIQUIATRA) {
            setMessage({ type: 'error', text: 'Por favor, selecione sua especialidade (Psicólogo ou Psiquiatra).' });
            return;
        }

        setLoading(true)
        setMessage(null)

        try {
            if (isSignUp) {
                await storageService.signupEmail(email, password, fullName, role);
                setMessage({ type: 'success', text: 'Conta criada! Verifique seu email ou faça login.' })
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
            <div className="w-full max-w-md bg-[#111] border border-white/5 rounded-2xl shadow-2xl overflow-hidden p-8 animate-in fade-in duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-[#7c3aed]/20">
                        M
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">MoodFlow</h1>
                    <p className="text-gray-500 text-xs tracking-wide uppercase font-black">AI & Professional Portal</p>
                </div>

                {!isAdminMode ? (
                    <div className="mb-4 p-1 bg-black/40 rounded-xl border border-white/5 flex gap-1">
                        <button
                            onClick={() => {
                                setRole(UserRole.PACIENTE);
                                setSelectedCategory('PACIENTE');
                                localStorage.setItem('moodflow_selected_role', UserRole.PACIENTE);
                            }}
                            className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${selectedCategory === 'PACIENTE'
                                ? 'bg-[#1A1A1A] text-white border border-white/10 shadow-lg'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <span>PACIENTE</span>
                            <span className="text-[7px] opacity-40 font-mono tracking-tight">Acesso Clínico</span>
                        </button>
                        <button
                            onClick={() => {
                                setSelectedCategory('PROFISSIONAL');
                            }}
                            className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${selectedCategory === 'PROFISSIONAL'
                                ? 'bg-[#1A1A1A] text-white border border-white/10 shadow-lg'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <span>SAÚDE</span>
                            <span className="text-[7px] opacity-40 font-mono tracking-tight">Profissional</span>
                        </button>
                    </div>
                ) : (
                    <div className="mb-8 p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl flex flex-col items-center gap-2">
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Portal Administrativo</span>
                        <p className="text-[10px] text-gray-500 text-center">Acesso restrito a gestores de unidade e administradores autorizados.</p>
                    </div>
                )}

                {selectedCategory === 'PROFISSIONAL' && (
                    <div className="mb-8 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                        <button
                            type="button"
                            onClick={() => {
                                setRole(UserRole.PSICOLOGO);
                                localStorage.setItem('moodflow_selected_role', UserRole.PSICOLOGO);
                            }}
                            className={`p-3 rounded-lg border text-xs font-bold transition-all ${role === UserRole.PSICOLOGO
                                ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                                : 'bg-[#151515] border-transparent text-gray-500 hover:bg-[#202020]'
                                }`}
                        >
                            Psicólogo(a)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRole(UserRole.PSIQUIATRA);
                                localStorage.setItem('moodflow_selected_role', UserRole.PSIQUIATRA);
                            }}
                            className={`p-3 rounded-lg border text-xs font-bold transition-all ${role === UserRole.PSIQUIATRA
                                ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                                : 'bg-[#151515] border-transparent text-gray-500 hover:bg-[#202020]'
                                }`}
                        >
                            Psiquiatra
                        </button>
                    </div>
                )}

                {selectedCategory === 'PROFISSIONAL' && role === UserRole.PACIENTE && (
                    <div className="mb-6 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="text-[10px] text-yellow-200 font-bold uppercase">Selecione sua especialidade acima</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Nome Completo</label>
                            <input
                                type="text"
                                placeholder="Seu nome"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-3.5 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Email</label>
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Senha</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-xs border animate-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-900/20 text-red-200 border-red-900/30' : 'bg-green-900/20 text-green-200 border-green-900/30'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-4 flex items-center justify-center bg-white text-black hover:bg-gray-200 font-black rounded-xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest mt-2"
                    >
                        {loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : isAdminMode ? 'Acessar Gestão' : 'Entrar')}
                    </button>
                </form>


                {!isAdminMode && (
                    <div className="mt-8 text-center border-t border-white/5 pt-6">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp)
                                setMessage(null)
                            }}
                            className="text-[11px] text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-tighter"
                        >
                            {isSignUp ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
                            <span className="text-white ml-2 underline underline-offset-4">
                                {isSignUp ? 'Entre aqui' : 'Cadastre-se grátis'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
