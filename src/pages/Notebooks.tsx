import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileUp, 
  FileDown, 
  Laptop, 
  Search, 
  Edit2, 
  Trash2,
  X,
  Hash,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Handshake,
  Mouse,
  Zap,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Notebook } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Notebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'notebook' | 'mouse' | 'charger' | 'headphones'>('notebook');

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const fetchNotebooks = async () => {
    const { data } = await supabase.from('notebooks').select('*');
    if (data) setNotebooks(data);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(notebooks);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notebooks");
    XLSX.writeFile(wb, "notebooks_sesi.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const mappedData = data.map((n: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        code: n.code,
        type: n.type,
        status: 'available'
      }));
      
      await supabase.from('notebooks').insert(mappedData);
      fetchNotebooks();
    };
    reader.readAsBinaryString(file);
  };

  const handleAddRange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const prefix = formData.get('prefix') as string;
    const start = Number(formData.get('start'));
    const end = Number(formData.get('end'));
    const type = formData.get('type') as any;

    const newItems = [];
    for (let i = start; i <= end; i++) {
      newItems.push({
        code: `${prefix}${i.toString().padStart(2, '0')}`,
        type,
        status: 'available'
      });
    }

    const mappedItems = newItems.map(item => ({
      ...item,
      id: Math.random().toString(36).substr(2, 9)
    }));

    await supabase.from('notebooks').insert(mappedItems);
    
    setIsRangeModalOpen(false);
    fetchNotebooks();
  };

  const filteredNotebooks = notebooks.filter(n => {
    const code = n.code || '';
    const matchesSearch = code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || n.status === statusFilter;
    const matchesTab = n.type === activeTab;
    return matchesSearch && matchesStatus && matchesTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600"><CheckCircle2 size={12} /> Disponível</span>;
      case 'loaned': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600"><Handshake size={12} /> Em uso</span>;
      case 'maintenance': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600"><Wrench size={12} /> Manutenção</span>;
      default: return null;
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Equipamentos</h2>
          <p className="text-slate-500 mt-1">Controle individual de notebooks, mouses, carregadores e fones.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-400 transition-all"
          >
            <Plus size={18} />
            Novo Cadastro
          </button>
          <button 
            onClick={() => setIsRangeModalOpen(true)}
            className="flex items-center gap-2 bg-sesi-blue/10 text-sesi-blue px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sesi-blue/20 transition-all"
          >
            <Hash size={18} />
            Cadastrar Intervalo
          </button>
          <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer">
            <FileUp size={18} />
            Importar Excel
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { id: 'notebook', label: 'Notebooks', icon: Laptop, color: 'bg-blue-500' },
          { id: 'mouse', label: 'Mouses', icon: Mouse, color: 'bg-purple-500' },
          { id: 'charger', label: 'Carregadores', icon: Zap, color: 'bg-amber-500' },
          { id: 'headphones', label: 'Fones', icon: Headphones, color: 'bg-rose-500' },
        ].map((item, index) => {
          const count = notebooks.filter(n => n.type === item.id).length;
          const available = notebooks.filter(n => n.type === item.id && n.status === 'available').length;
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer group",
                activeTab === item.id 
                  ? "bg-white border-sesi-blue shadow-md ring-2 ring-sesi-blue/10" 
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2 rounded-xl text-white", item.color)}>
                  <item.icon size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover:text-sesi-blue transition-colors">Ver todos</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-500">{item.label}</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{count}</span>
                  <span className="text-xs font-bold text-emerald-600">{available} livres</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'notebook', label: 'Notebooks', icon: Laptop },
          { id: 'mouse', label: 'Mouses', icon: Mouse },
          { id: 'charger', label: 'Carregadores', icon: Zap },
          { id: 'headphones', label: 'Fones', icon: Headphones },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-sesi-blue shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por código (ex: NB01)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm text-slate-600 font-medium"
        >
          <option value="">Todos os Status</option>
          <option value="available">Disponível</option>
          <option value="loaned">Em uso</option>
          <option value="maintenance">Manutenção</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence mode="popLayout">
              {filteredNotebooks.map((notebook) => (
                <motion.tr 
                  key={notebook.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-sm text-slate-900">{notebook.code}</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 capitalize">{notebook.type}</td>
                <td className="px-6 py-4">
                  {getStatusBadge(notebook.status)}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-sesi-blue transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredNotebooks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Single Add */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Novo Cadastro</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              await supabase.from('notebooks').insert({
                ...data,
                id: Math.random().toString(36).substr(2, 9),
                status: 'available'
              });
              
              setIsModalOpen(false);
              fetchNotebooks();
            }}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Código</label>
                <input name="code" required placeholder="Ex: NB01" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo</label>
                <select name="type" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none">
                  <option value="notebook">Notebook</option>
                  <option value="mouse">Mouse</option>
                  <option value="charger">Carregador</option>
                  <option value="headphones">Fone de Ouvido</option>
                </select>
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

      {/* Modal for Range Add */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Cadastrar Intervalo</h3>
              <button onClick={() => setIsRangeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleAddRange}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Prefixo (ex: NB)</label>
                <input name="prefix" defaultValue="NB" required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Início</label>
                  <input name="start" type="number" required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fim</label>
                  <input name="end" type="number" required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo</label>
                <select name="type" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none">
                  <option value="notebook">Notebook</option>
                  <option value="mouse">Mouse</option>
                  <option value="charger">Carregador</option>
                  <option value="headphones">Fone de Ouvido</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsRangeModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-sesi-yellow text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20">
                  Gerar Equipamentos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
