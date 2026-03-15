import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { data, error: sbError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (sbError || !data) {
        setError('Usuário ou senha inválidos');
      } else {
        // Super Admin check - can be an email or a specific username
        // We'll treat 'admin' or users with a specific email as super admins
        const isSuperAdmin = data.username === 'admin' || data.role === 'admin';
        
        // If not super admin, must be approved
        if (!isSuperAdmin && data.approved === false) {
          setError('Sua conta aguarda aprovação do administrador.');
          setIsSubmitting(false);
          return;
        }

        const { password, ...userWithoutPassword } = data;
        login({
          ...userWithoutPassword,
          role: isSuperAdmin ? 'admin' : data.role
        });
        navigate('/');
      }
    } catch (err) {
      setError('Erro de conexão com o Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 bg-sesi-blue rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-sesi-blue/20">
            <Monitor size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoria SESI</h1>
          <p className="text-slate-500 text-sm">Acesse o sistema de gestão</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Usuário</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-slate-100 rounded-2xl focus:ring-2 focus:ring-sesi-blue/20 focus:border-sesi-blue transition-all outline-none"
                placeholder="Seu usuário"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Senha</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-slate-100 rounded-2xl focus:ring-2 focus:ring-sesi-blue/20 focus:border-sesi-blue transition-all outline-none"
                placeholder="Sua senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-sesi-yellow text-slate-900 font-bold rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            className="text-xs font-bold text-slate-400 hover:text-sesi-blue transition-colors flex items-center gap-1.5"
          >
            Limpar Cache do Navegador
          </button>
          <p className="text-xs text-slate-400">
            © 2026 SESI Internacional - Monitoria
          </p>
        </div>
      </div>
    </div>
  );
}
