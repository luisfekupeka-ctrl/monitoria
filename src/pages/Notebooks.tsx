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
import { useAuth } from '../contexts/AuthContext';

export function Notebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'notebook' | 'mouse' | 'charger' | 'headphones'>('all');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const handleToggleMaintenance = async (notebook: Notebook) => {
    const newStatus = notebook.status === 'maintenance' ? 'available' : 'maintenance';
    
    if (notebook.status === 'loaned') {
      alert('Não é possível colocar em manutenção um equipamento que está em uso.');
      return;
    }

    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ status: newStatus })
        .eq('id', notebook.id);
      
      if (error) throw error;
      fetchNotebooks();
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const fetchNotebooks = async () => {
    const { data } = await supabase.from('notebooks').select('*');
    if (data) {
      const sortedData = [...data].sort((a, b) => {
        const codeA = (a.code || '').trim().toUpperCase();
        const codeB = (b.code || '').trim().toUpperCase();
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
      setNotebooks(sortedData.map(n => ({
        ...n,
        createdBy: n.created_by
      })));
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = notebooks.map(n => ({
        'Código': n.code,
        'Tipo': n.type,
        'Status': n.status === 'available' ? 'Livre' : n.status === 'loaned' ? 'Em uso' : 'Manutenção'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Equipamentos");
      
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `equipamentos_sesi_${date}.xlsx`);
    } catch (err) {
      alert('Erro ao exportar Excel.');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          alert('Planilha vazia! Verifique o arquivo.');
          return;
        }

        const mappedData = data.map((row: any) => {
          const code = row['Código'] || row['codigo'] || row['code'] || row['Code'] || row['CODIGO'] || row['CÓDIGO'] || '';
          let mappedType = row['Tipo'] || row['tipo'] || row['type'] || row['Type'] || row['TIPO'] || '';
          mappedType = mappedType.toString().toLowerCase().trim();
          
          const codeStr = code.toString().trim().toUpperCase();
          if (mappedType.includes('note') || mappedType.includes('lap') || codeStr.startsWith('NB')) mappedType = 'notebook';
          else if (mappedType.includes('mouse') || mappedType.includes('mou') || codeStr.startsWith('M')) mappedType = 'mouse';
          else if (mappedType.includes('carr') || mappedType.includes('charger') || mappedType.includes('fonte') || codeStr.startsWith('C')) mappedType = 'charger';
          else if (mappedType.includes('fone') || mappedType.includes('head') || mappedType.includes('headphone') || codeStr.startsWith('F')) mappedType = 'headphones';
          else mappedType = 'notebook';

          const lab = row['Laboratório'] || row['laboratorio'] || row['lab'] || row['Lab'] || row['LABORATÓRIO'] || '';

          return {
            id: Math.random().toString(36).substr(2, 9),
            code: code.toString().trim(),
            type: mappedType,
            status: 'available',
            laboratory: lab.toString().trim() || null
          };
        }).filter(n => n.code !== '');

        if (mappedData.length === 0) {
          alert('Nenhum código encontrado na planilha.');
          return;
        }

        const existingCodes = notebooks.map(n => n.code);
        const newItems = mappedData.filter(n => !existingCodes.includes(n.code));
        const skipped = mappedData.length - newItems.length;

        if (newItems.length === 0) {
          alert(`Todos os ${mappedData.length} equipamentos da planilha já estão cadastrados.`);
          return;
        }

        let inserted = 0;
        for (let i = 0; i < newItems.length; i += 50) {
          const batch = newItems.slice(i, i + 50);
          const { error } = await supabase.from('notebooks').insert(batch);
          if (error) {
            alert(`Erro ao importar lote ${Math.floor(i/50)+1}: ${error.message}`);
            break;
          }
          inserted += batch.length;
        }

        fetchNotebooks();
        
        let msg = `✅ Importação concluída!\n\n📥 ${inserted} equipamentos importados com sucesso.`;
        if (skipped > 0) msg += `\n⏭️ ${skipped} duplicados ignorados.`;
        alert(msg);
      } catch (err: any) {
        alert('Erro ao ler planilha: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAddRange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const prefix = (formData.get('prefix') as string || '').trim();
    const startRaw = (formData.get('start') as string || '').trim();
    const endRaw = (formData.get('end') as string || '').trim();
    
    const startNum = parseInt(startRaw, 10);
    const endNum = parseInt(endRaw, 10);
    
    if (isNaN(startNum) || isNaN(endNum)) {
      alert('Por favor, insira números válidos para o início e fim.');
      return;
    }

    const type = formData.get('type') as any;
    const padding = startRaw.length > startNum.toString().length ? startRaw.length : 0;

    const itemsToInsert = [];
    const existingCodes = notebooks.map(n => (n.code || '').toUpperCase().trim());

    for (let i = startNum; i <= endNum; i++) {
        const numStr = padding > 0 ? i.toString().padStart(padding, '0') : i.toString();
        const code = `${prefix}${numStr}`.toUpperCase().trim();
        
        if (!existingCodes.includes(code)) {
            let inferredType = type;
            const prefixUpper = prefix.toUpperCase();
            if (prefixUpper === 'NB') inferredType = 'notebook';
            else if (prefixUpper === 'M') inferredType = 'mouse';
            else if (prefixUpper === 'C') inferredType = 'charger';
            else if (prefixUpper === 'F') inferredType = 'headphones';

            itemsToInsert.push({
                id: Math.random().toString(36).substr(2, 9),
                code,
                type: inferredType,
                status: 'available',
                created_by: user?.name || 'Monitor',
                laboratory: formData.get('laboratory') as string || null
            });
        }
    }

    if (itemsToInsert.length === 0) {
        alert('Todos os equipamentos neste intervalo já estão cadastrados.');
        setIsRangeModalOpen(false);
        return;
    }
    
    try {
      let { error } = await supabase.from('notebooks').insert(itemsToInsert);
      
      if (error && error.message.includes('created_by')) {
        const fallbackItems = itemsToInsert.map(({ created_by, ...rest }) => rest);
        const { error: fallbackError } = await supabase.from('notebooks').insert(fallbackItems);
        if (fallbackError) throw fallbackError;
      } else if (error) {
        throw error;
      }
      
      setIsRangeModalOpen(false);
      fetchNotebooks();
      alert(`${itemsToInsert.length} novos equipamentos gerados com sucesso!`);
    } catch (err: any) {
      alert('Erro ao cadastrar intervalo: ' + err.message);
    }
  };

  const filteredNotebooks = notebooks
    .filter(n => {
      const code = n.code || '';
      const matchesSearch = code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || n.status === statusFilter;
      const matchesTab = activeTab === 'all' || n.type === activeTab;
      return matchesSearch && matchesStatus && matchesTab;
    })
    .sort((a, b) => {
      const codeA = (a.code || '').trim().toUpperCase();
      const codeB = (b.code || '').trim().toUpperCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200">Disponível</span>;
      case 'loaned': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">Em uso</span>;
      case 'maintenance': return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200">Manutenção</span>;
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
          <p className="text-slate-500 mt-1">Controle individual de notebooks e periféricos em tempo real.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <>
              <button 
                onClick={() => { setEditingNotebook(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-400 transition-all font-sans"
              >
                <Plus size={18} />
                Novo Cadastro
              </button>
              <button 
                onClick={() => setIsRangeModalOpen(true)}
                className="flex items-center gap-2 bg-sesi-blue/10 text-sesi-blue px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sesi-blue/20 transition-all"
              >
                <Hash size={18} />
                Gerar Vários
              </button>
            </>
          )}
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
          >
            <FileDown size={18} />
            Exportar
          </button>
          {isAdmin && (
            <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer">
              <FileUp size={18} />
              Importar
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setActiveTab('all')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer group",
            activeTab === 'all' 
              ? "bg-white border-sesi-blue shadow-md ring-2 ring-sesi-blue/10" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl text-white bg-slate-900">
              <Plus size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 group-hover:text-sesi-blue transition-colors">Total</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-500">Tudo</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{notebooks.length}</span>
              <span className="text-xs font-bold text-slate-400">ítens</span>
            </div>
          </div>
        </motion.div>

        {[
          { id: 'notebook', label: 'Notebooks', icon: Laptop, color: 'bg-blue-500' },
          { id: 'mouse', label: 'Mouses', icon: Mouse, color: 'bg-purple-500' },
          { id: 'charger', label: 'Fontes', icon: Zap, color: 'bg-amber-500' },
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
                <span className="text-xs font-bold text-slate-400 group-hover:text-sesi-blue transition-colors">Ver</span>
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

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'all' 
              ? "bg-white text-sesi-blue shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Todos
        </button>
        {[
          { id: 'notebook', label: 'Notebooks', icon: Laptop },
          { id: 'mouse', label: 'Mouses', icon: Mouse },
          { id: 'charger', label: 'Fontes', icon: Zap },
          { id: 'headphones', label: 'Fones', icon: Headphones },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por código..."
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

      <div className="space-y-6">
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Laboratório</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout" initial={false}>
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
                  <td className="px-6 py-4 text-sm text-slate-500 text-center">{notebook.laboratory || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(notebook.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {isAdmin && (
                        <>
                          <button 
                            onClick={() => handleToggleMaintenance(notebook)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              notebook.status === 'maintenance' ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            )}
                            title="Tocar Manutenção"
                          >
                            <Wrench size={16} />
                          </button>
                          <button 
                            onClick={() => { setEditingNotebook(notebook); setIsModalOpen(true); }}
                            className="p-2 text-slate-400 hover:text-sesi-blue hover:bg-slate-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm(`Excluir ${notebook.code}?`)) {
                                const { error } = await supabase.from('notebooks').delete().eq('id', notebook.id);
                                if (!error) fetchNotebooks();
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4 pb-32">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredNotebooks.map((notebook) => (
              <motion.div 
                key={notebook.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/10">
                        {notebook.type === 'notebook' && <Laptop size={20} />}
                        {notebook.type === 'mouse' && <Mouse size={20} />}
                        {notebook.type === 'charger' && <Zap size={20} />}
                        {notebook.type === 'headphones' && <Headphones size={20} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-slate-900 leading-tight truncate uppercase tracking-tight">{notebook.code}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{notebook.laboratory || 'LAB N/A'}</p>
                      </div>
                    </div>
                    {getStatusBadge(notebook.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Tipo</p>
                      <p className="text-[10px] font-black text-slate-700 truncate uppercase">{notebook.type}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Responsável</p>
                      <p className="text-[10px] font-black text-slate-700 truncate uppercase">{notebook.createdBy || 'Sistema'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    {isAdmin && (
                      <div className="grid grid-cols-3 gap-2 w-full">
                        <button 
                          onClick={() => handleToggleMaintenance(notebook)}
                          className={cn(
                            "flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm",
                            notebook.status === 'maintenance' ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-400"
                          )}
                        >
                          <Wrench size={16} />
                        </button>
                        <button 
                          onClick={() => { setEditingNotebook(notebook); setIsModalOpen(true); }}
                          className="flex items-center justify-center gap-2 py-4 bg-slate-50 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm(`Excluir ${notebook.code}?`)) {
                              const { error } = await supabase.from('notebooks').delete().eq('id', notebook.id);
                              if (!error) fetchNotebooks();
                            }
                          }}
                          className="flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingNotebook ? 'Editar Equipamento' : 'Novo Cadastro'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              try {
                if (editingNotebook) {
                  const { error } = await supabase.from('notebooks')
                    .update({ ...data, status: editingNotebook.status })
                    .eq('id', editingNotebook.id);
                  if (error) throw error;
                } else {
                  const newId = Math.random().toString(36).substr(2, 9);
                  let { error } = await supabase.from('notebooks').insert({
                    ...data,
                    id: newId,
                    status: 'available',
                    created_by: user?.name || 'Monitor'
                  });
                  
                  if (error && error.message.includes('created_by')) {
                    console.warn('Fallback: Coluna created_by ausente. Inserindo sem ela.');
                    const { error: fallbackError } = await supabase.from('notebooks').insert({
                      ...data,
                      id: newId,
                      status: 'available'
                    });
                    if (fallbackError) throw fallbackError;
                  } else if (error) {
                    throw error;
                  }
                }
                
                setIsModalOpen(false);
                fetchNotebooks();
              } catch (err: any) {
                alert('Erro ao salvar equipamento: ' + err.message);
              }
            }}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Código</label>
                <input name="code" defaultValue={editingNotebook?.code} required autoFocus placeholder="Ex: NB01" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
               <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo (Auto-detectado pelo prefixo)</label>
                <select name="type" 
                  defaultValue={editingNotebook?.type || (activeTab === 'all' ? 'notebook' : activeTab)} 
                  className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none"
                >
                  <option value="notebook">Notebook</option>
                  <option value="mouse">Mouse</option>
                  <option value="charger">Carregador</option>
                  <option value="headphones">Fone de Ouvido</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Laboratório (Opcional)</label>
                <input 
                  name="laboratory" 
                  list="lab-list"
                  defaultValue={editingNotebook?.laboratory} 
                  placeholder="Ex: Lab A, Lab B..." 
                  className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" 
                />
                <datalist id="lab-list">
                  {Array.from(new Set(notebooks.map(n => n.laboratory).filter(Boolean))).map(lab => (
                    <option key={lab} value={lab} />
                  ))}
                </datalist>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                {editingNotebook && (
                  <button 
                    type="button"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head><title>Etiqueta ${editingNotebook.code}</title></head>
                            <body style="display:flex;flex-direction:column;align-items:center;justify-center;font-family:sans-serif;padding:20px;">
                              <div style="border:2px solid black;padding:20px;text-align:center;">
                                <h2 style="margin:0 0 10px 0;font-size:24px;">SESI MONITORIA</h2>
                                <svg id="barcode"></svg>
                                <p style="font-weight:bold;margin:10px 0 0 0;font-size:18px;">${editingNotebook.type.toUpperCase()}</p>
                              </div>
                              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
                              <script>
                                JsBarcode("#barcode", "${editingNotebook.code}", {
                                  format: "CODE128",
                                  displayValue: true,
                                  width: 2,
                                  height: 60,
                                  margin: 10,
                                  fontSize: 16
                                });
                                setTimeout(() => window.print(), 500);
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                    className="flex-1 py-3 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200"
                  >
                    Etiqueta
                  </button>
                )}
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
                  <input name="start" type="text" placeholder="Ex: 01 ou 1" required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fim</label>
                  <input name="end" type="text" placeholder="Ex: 10" required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Laboratório</label>
                <input name="laboratory" placeholder="Ex: Lab A" className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
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
