import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (isRegistering) {
        const { error: sbError } = await supabase
          .from('users')
          .insert([{
            id: Math.random().toString(36).substr(2, 9),
            username: username.trim(),
            name: name.trim(),
            email: email.trim(),
            password: password,
            role: 'operator',
            approved: false
          }]);

        if (sbError) {
          if (sbError.code === '23505') {
            setError('Este usuário ou e-mail já está em uso.');
          } else {
            setError('Erro ao criar conta: ' + sbError.message);
          }
        } else {
          setSuccess('Cadastro realizado com sucesso! Aguarde a aprovação do administrador para acessar o sistema.');
          setIsRegistering(false);
          setPassword('');
          setUsername('');
          setName('');
          setEmail('');
        }
      } else {
        const { data, error: sbError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (sbError || !data) {
          setError('Usuário ou senha inválidos');
        } else {
          const isSuperAdmin = data.username === 'admin' || data.role === 'admin';
          
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

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setIsRegistering(false); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isRegistering ? 'bg-white text-sesi-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setIsRegistering(true); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isRegistering ? 'bg-white text-sesi-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-sm font-medium border border-emerald-100">
              {success}
            </div>
          )}

          {isRegistering && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Nome Completo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-slate-100 rounded-2xl focus:ring-2 focus:ring-sesi-blue/20 focus:border-sesi-blue transition-all outline-none"
                    placeholder="João Silva"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">E-mail</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-slate-100 rounded-2xl focus:ring-2 focus:ring-sesi-blue/20 focus:border-sesi-blue transition-all outline-none"
                    placeholder="joao@exemplo.com"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
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
                placeholder={isRegistering ? "joao.silva" : "Seu usuário"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
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
                placeholder={isRegistering ? "Crie uma senha" : "Sua senha"}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-6 bg-sesi-yellow text-slate-900 font-bold rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Aguarde...' : isRegistering ? 'Solicitar Cadastro' : 'Entrar no Sistema'}
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
