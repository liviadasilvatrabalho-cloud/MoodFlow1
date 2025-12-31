
import React, { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { storageService } from '../services/storageService'
import { UserRole } from '../types'


export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<UserRole>(UserRole.PATIENT)
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
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

                <div className="mb-8 p-1 bg-black/40 rounded-xl border border-white/5 flex gap-1">
                    <button
                        onClick={() => setRole(UserRole.PATIENT)}
                        className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${role === UserRole.PATIENT
                            ? 'bg-[#1A1A1A] text-white border border-white/10 shadow-lg'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <span>PACIENTE</span>
                        <span className="text-[8px] opacity-40 font-mono tracking-tight">Acesso Clínico</span>
                    </button>
                    <button
                        onClick={() => setRole(UserRole.PROFESSIONAL)}
                        className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${role === UserRole.PROFESSIONAL
                            ? 'bg-[#1A1A1A] text-white border border-white/10 shadow-lg'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <span>PROFISSIONAL</span>
                        <span className="text-[8px] opacity-40 font-mono tracking-tight">Portal Saúde</span>
                    </button>
                </div>

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
                        {loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
                    </button>
                </form>


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
            </div>
        </div>
    )
}
