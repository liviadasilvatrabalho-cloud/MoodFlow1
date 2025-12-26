
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
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isSignUp) {
                await storageService.signupEmail(email, password, fullName);
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
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">MoodFlow AI</h1>
                    <p className="text-gray-400 text-sm">
                        {isSignUp ? 'Crie sua conta e comece sua jornada' : 'Bem-vindo de volta'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome Completo</label>
                            <input
                                type="text"
                                placeholder="Seu nome"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-3 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email</label>
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Senha</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1A] border border-neutral-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm border ${message.type === 'error' ? 'bg-red-900/20 text-red-200 border-red-900/30' : 'bg-green-900/20 text-green-200 border-green-900/30'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            isSignUp ? 'Criar Conta' : 'Entrar'
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setMessage(null)
                        }}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {isSignUp ? 'Já tem uma conta? ' : 'Não tem conta? '}
                        <span className="text-indigo-400 hover:text-indigo-300 font-bold">
                            {isSignUp ? 'Entre aqui' : 'Cadastre-se'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}
