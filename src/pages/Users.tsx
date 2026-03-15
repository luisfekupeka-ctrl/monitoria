import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  X,
  User,
  BookOpen,
  MapPin,
  GraduationCap,
  Briefcase,
  Phone,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Beneficiary, BeneficiaryType, Loan } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Users() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);

  useEffect(() => {
    fetchBeneficiaries();
    fetchActiveLoans();
  }, []);

  const fetchBeneficiaries = async () => {
    const { data } = await supabase.from('professors').select('*');
    if (data) setBeneficiaries(data);
  };

  const fetchActiveLoans = async () => {
    const { data } = await supabase.from('loans').select('*').eq('status', 'active');
    if (data) setActiveLoans(data || []);
  };

  const filteredBeneficiaries = beneficiaries
    .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const getTypeIcon = (type: BeneficiaryType) => {
    switch (type) {
      case 'professor': return <GraduationCap size={24} />;
      case 'collaborator': return <Briefcase size={24} />;
      case 'student': return <User size={24} />;
      case 'location': return <MapPin size={24} />;
      default: return <User size={24} />;
    }
  };

  const getTypeLabel = (type: BeneficiaryType) => {
    switch (type) {
      case 'professor': return 'Usuário';
      case 'collaborator': return 'Colaborador';
      case 'student': return 'Aluno';
      case 'location': return 'Local';
      default: return type;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Usuários e Locais</h2>
          <p className="text-slate-500 mt-1">Cadastro de quem ou onde os materiais são direcionados.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingBeneficiary(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-400 transition-all font-sans"
          >
            <Plus size={18} />
            Novo Cadastro
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredBeneficiaries.map((beneficiary, index) => {
            const userLoans = activeLoans.filter(l => l.beneficiaryId === beneficiary.id);
            const totalItems = userLoans.reduce((acc, loan) => acc + loan.items.length, 0);
            const itemLabel = totalItems === 1 ? 'equipamento' : 'equipamentos';
            const itemsList = userLoans.flatMap(l => l.items).join(', ');
            
            const message = totalItems > 0 
              ? `Olá ${beneficiary.name.split(' ')[0]}, notamos que você está com ${totalItems} ${itemLabel} da Monitoria (${itemsList}). Este é um aviso padrão para devolução até as 17:45 hoje. Obrigado!`
              : `Olá ${beneficiary.name.split(' ')[0]}, lembramos que os equipamentos emprestados pela Monitoria precisam ser devolvidos até às 17:45 hoje. Obrigado!`;
        
            const whatsappUrl = `https://wa.me/${beneficiary.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

            return (
            <motion.div 
              key={beneficiary.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
            <div className="flex items-start justify-between mb-4">
              <div className="size-12 rounded-2xl bg-sesi-blue/10 flex items-center justify-center text-sesi-blue">
                {getTypeIcon(beneficiary.type)}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => { setEditingBeneficiary(beneficiary); setIsModalOpen(true); }}
                    className="p-2 text-slate-400 hover:text-sesi-blue transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm('Deseja excluir este cadastro?')) {
                        try {
                          const { error } = await supabase.from('professors').delete().eq('id', beneficiary.id);
                          if (error) {
                            if (error.code === '23503') {
                              alert('Não é possível excluir este cadastro pois existem empréstimos vinculados a ele.');
                            } else {
                              alert('Erro ao excluir: ' + error.message);
                            }
                            return;
                          }
                          fetchBeneficiaries();
                        } catch (err) {
                          alert('Erro inesperado ao excluir.');
                        }
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-sesi-blue bg-sesi-blue/5 px-2 py-0.5 rounded-md uppercase tracking-wider">
                {getTypeLabel(beneficiary.type)}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-lg">{beneficiary.name}</h3>
            {beneficiary.department && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <BookOpen size={14} />
                <span>{beneficiary.department}</span>
              </div>
            )}
            {beneficiary.phone && (
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Phone size={14} />
                  <span>{beneficiary.phone}</span>
                </div>
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1.5"
                >
                  <MessageCircle size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Aviso</span>
                </a>
              </div>
            )}
          </motion.div>
        )})}
        </AnimatePresence>
        {filteredBeneficiaries.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm italic">
            Nenhum registro encontrado.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingBeneficiary ? 'Editar Cadastro' : 'Novo Cadastro'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());

              if (editingBeneficiary) {
                const { error } = await supabase.from('professors')
                  .update(data)
                  .eq('id', editingBeneficiary.id);
                if (error) {
                  alert('Erro ao editar: ' + error.message);
                  return;
                }
              } else {
                const { error } = await supabase.from('professors').insert({
                  ...data,
                  id: Math.random().toString(36).substr(2, 9),
                  code: 'USR' + Date.now().toString().slice(-6)
                });
                if (error) {
                  alert('Erro ao cadastrar: ' + error.message);
                  return;
                }
              }
              
              setIsModalOpen(false);
              fetchBeneficiaries();
            }}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo</label>
                <select name="type" defaultValue={editingBeneficiary?.type || 'professor'} className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none">
                  <option value="professor">Usuário</option>
                  <option value="collaborator">Colaborador</option>
                  <option value="student">Aluno</option>
                  <option value="location">Local (Sala, etc)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nome / Identificação</label>
                <input name="name" defaultValue={editingBeneficiary?.name} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Departamento / Disciplina (Opcional)</label>
                <input name="department" defaultValue={editingBeneficiary?.department} className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Telefone / WhatsApp (Opcional)</label>
                <input name="phone" defaultValue={editingBeneficiary?.phone} placeholder="Ex: 11988887777" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-sesi-yellow text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
