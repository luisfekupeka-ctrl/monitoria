import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  User as UserIcon,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function AdminManagement() {
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', name: '', email: '', password: '', role: 'operator' as User['role'] });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (data) {
      setSystemUsers(data);
    }
    setIsLoading(false);
  };

  const handleToggleApproval = async (targetUser: User) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ approved: !targetUser.approved })
        .eq('id', targetUser.id);

      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('users')
        .insert([{
          id: Math.random().toString(36).substr(2, 9),
          username: newUser.username,
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          approved: true // Admins add pre-approved users
        }]);

      if (error) throw error;
      
      setIsAddModalOpen(false);
      setNewUser({ username: '', name: '', email: '', password: '', role: 'operator' });
      fetchUsers();
      alert('Colaborador cadastrado com sucesso!');
    } catch (err: any) {
      alert('Erro ao adicionar usuário: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const filteredUsers = systemUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-sesi-blue" size={32} />
            Gestão de Acesso
          </h1>
          <p className="text-slate-500 font-medium mt-1">Aprovação e gerenciamento de colaboradores do sistema.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-400 transition-all font-sans"
        >
          <UserIcon size={18} />
          Novo Colaborador
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar colaborador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((user, index) => {
            const isSuperAdmin = user.username === 'admin';
            
            return (
              <motion.div 
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "bg-white p-5 rounded-[2rem] border transition-all group relative overflow-hidden flex flex-col justify-between",
                  user.approved ? "border-slate-200" : "border-amber-200 bg-amber-50/20"
                )}
              >
                {!user.approved && !isSuperAdmin && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                    Pendente
                  </div>
                )}
                
                {isSuperAdmin && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-sesi-blue text-white text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                    Super Admin
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "size-12 rounded-2xl flex items-center justify-center shadow-md",
                    user.role === 'admin' ? "bg-sesi-blue text-white" : "bg-slate-50 text-slate-400 border border-slate-100"
                  )}>
                    {user.role === 'admin' ? <ShieldCheck size={24} /> : <UserIcon size={24} />}
                  </div>
                  
                  {!isSuperAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleApproval(user)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5",
                          user.approved 
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100" 
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        )}
                      >
                        {user.approved ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                        {user.approved ? 'DESATIVAR' : 'APROVAR'}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Deseja excluir permanentemente o acesso de ${user.name}?`)) {
                            try {
                              const { error } = await supabase.from('users').delete().eq('id', user.id);
                              if (error) throw error;
                              fetchUsers();
                            } catch (err: any) {
                              alert('Erro ao excluir usuário: ' + err.message);
                            }
                          }
                        }}
                        className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{user.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-slate-400 truncate">@{user.username}</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded-md uppercase tracking-wider shrink-0">
                        {user.role === 'admin' ? 'ADMIN' : 'COLAB'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex flex-col gap-1.5">
                    {user.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
                        <Mail size={12} className="text-slate-300 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredUsers.length === 0 && !isLoading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <Users size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhum colaborador encontrado</p>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-900">Novo Colaborador</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="size-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-all">
                <XCircle size={24} />
              </button>
            </div>
            <form className="p-8 space-y-4" onSubmit={handleAddUser}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full h-14 px-6 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none font-bold text-slate-700" 
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
                  <input 
                    required 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full h-14 px-6 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none font-bold text-slate-700" 
                    placeholder="joao.silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                  <input 
                    type="password"
                    required 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full h-14 px-6 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none font-bold text-slate-700" 
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <input 
                  type="email"
                  required 
                  value={newUser.email || ''}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full h-14 px-6 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none font-bold text-slate-700" 
                  placeholder="joao@monitoria.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Permissão</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as User['role']})}
                  className="w-full h-14 px-6 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-sesi-blue/10 transition-all outline-none font-bold text-slate-700 appearance-none"
                >
                  <option value="operator">Operador (Colaborador)</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-14 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">
                  CANCELAR
                </button>
                <button type="submit" className="flex-1 h-14 bg-sesi-yellow text-slate-900 font-black rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20">
                  CADASTRAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
