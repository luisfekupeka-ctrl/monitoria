import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  X, 
  CheckCircle2, 
  Trash2,
  Scan,
  Laptop,
  User,
  AlertCircle,
  ArrowDownCircle,
  History,
  Check,
  ChevronRight,
  ChevronDown,
  Headphones,
  Zap,
  Mouse
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Beneficiary, Notebook, Loan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Loans() {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<Notebook['type']>('notebook');
  const [showGrid, setShowGrid] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [pRes, nRes, lRes] = await Promise.all([
      supabase.from('professors').select('*'),
      supabase.from('notebooks').select('*'),
      supabase.from('loans').select('*, loan_items(notebook_code)')
    ]);

    if (pRes.data) setBeneficiaries(pRes.data);
    if (nRes.data) setNotebooks(nRes.data);
    if (lRes.data) {
      const mappedLoans = (lRes.data || []).map(l => ({
        ...l,
        beneficiaryId: l.beneficiary_id,
        beneficiaryName: l.beneficiary_name || 'N/A',
        loanDate: l.loan_date,
        returnDate: l.return_date,
        operatorId: l.operator_id,
        operatorName: l.operator_name || 'Monitor',
        items: Array.isArray(l.loan_items) ? l.loan_items.map((item: any) => item.notebook_code) : []
      }));
      setActiveLoans(mappedLoans.filter((l: Loan) => l.status === 'active'));
    }
  };

  const filteredLoans = (activeLoans || []).filter(loan => {
    const beneficiaryName = loan.beneficiaryName || '';
    const items = loan.items || [];
    return beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           items.some(item => (item || '').toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const handleAddItem = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    // Handle range like NB01-NB10
    if (cleanCode.includes('-')) {
      const parts = cleanCode.split('-');
      if (parts.length === 2) {
        const prefix = parts[0].replace(/[0-9]/g, '');
        const start = parseInt(parts[0].replace(/[^0-9]/g, ''));
        const end = parseInt(parts[1].replace(/[^0-9]/g, ''));
        
        const rangeItems = [];
        for (let i = start; i <= end; i++) {
          rangeItems.push(`${prefix}${i.toString().padStart(2, '0')}`);
        }
        
        const validItems = rangeItems.filter(c => {
          const nb = notebooks.find(n => n.code === c);
          return nb && nb.status === 'available' && !selectedItems.includes(c);
        });
        
        setSelectedItems(prev => Array.from(new Set([...prev, ...validItems])));
        setScannedCode('');
        return;
      }
    }

    // Handle single item
    const nb = notebooks.find(n => n.code === cleanCode);
    if (!nb) {
      setError(`Equipamento ${cleanCode} não encontrado.`);
      return;
    }

    if (nb.status === 'loaned') {
      // If it's already loaned, maybe the user wants to return it?
      const loan = activeLoans.find(l => l.items.includes(cleanCode));
      if (loan) {
        if (confirm(`O notebook ${cleanCode} está com ${loan.beneficiaryName}. Deseja realizar a devolução agora?`)) {
          handleReturnByCode(cleanCode);
          return;
        }
      }
    }

    if (nb.status !== 'available') {
      setError(`Equipamento ${cleanCode} não está disponível.`);
      return;
    }

    if (selectedItems.includes(cleanCode)) {
      setError(`Equipamento ${cleanCode} já está na lista.`);
      return;
    }

    setSelectedItems(prev => [...prev, cleanCode]);
    setScannedCode('');
    setError('');
  };

  const toggleGridItem = (code: string) => {
    if (rangeStart) {
      // Range selection mode
      const allCodes = notebooks.map(n => n.code);
      const startIndex = allCodes.indexOf(rangeStart);
      const endIndex = allCodes.indexOf(code);
      
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      
      const rangeCodes = allCodes.slice(start, end + 1);
      const availableRangeCodes = rangeCodes.filter(c => {
        const nb = notebooks.find(n => n.code === c);
        return nb && nb.status === 'available';
      });

      setSelectedItems(prev => Array.from(new Set([...prev, ...availableRangeCodes])));
      setRangeStart(null);
      setSuccess(`Intervalo selecionado: ${rangeStart} até ${code}`);
      return;
    }

    if (selectedItems.includes(code)) {
      setSelectedItems(prev => prev.filter(c => c !== code));
    } else {
      setSelectedItems(prev => [...prev, code]);
    }
  };

  const handleDoubleClick = (code: string) => {
    setRangeStart(code);
    if (!selectedItems.includes(code)) {
      setSelectedItems(prev => [...prev, code]);
    }
  };

  const handleReturnByCode = async (code: string) => {
    const loan = activeLoans.find(l => l.items.includes(code));
    if (!loan) return;

    try {
      const nb = notebooks.find(n => n.code === code);
      await supabase.from('notebooks')
        .update({ status: 'available' })
        .eq('id', nb?.id);

      const newItems = loan.items.filter(item => item !== code);
      if (newItems.length === 0) {
        await supabase.from('loans')
          .update({ 
            status: 'returned', 
            return_date: new Date().toISOString()
          })
          .eq('id', loan.id);
      } else {
        await supabase.from('loan_items')
          .delete()
          .eq('loan_id', loan.id)
          .eq('notebook_code', code);
      }

      setSuccess(`Equipamento ${code} devolvido com sucesso!`);
      fetchData();
    } catch (err) {
      setError('Erro ao processar devolução.');
    }
  };

  const handleReturnAll = async (loan: Loan) => {
    if (!confirm(`Confirmar devolução de todos os ${loan.items.length} itens de ${loan.beneficiaryName}?`)) return;
    
    try {
      await Promise.all(loan.items.map(code => {
        const nb = notebooks.find(n => n.code === code);
        return supabase.from('notebooks')
          .update({ status: 'available' })
          .eq('id', nb?.id);
      }));

      await supabase.from('loans')
        .update({ 
          status: 'returned', 
          return_date: new Date().toISOString() 
        })
        .eq('id', loan.id);

      setSuccess(`Todos os itens de ${loan.beneficiaryName} foram devolvidos.`);
      fetchData();
    } catch (err) {
      setError('Erro ao processar devolução total.');
    }
  };

  const handleConfirmLoan = async () => {
    if (!selectedBeneficiaryId) {
      setError('Selecione uma pessoa ou local.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Adicione pelo menos um item.');
      return;
    }

    const beneficiary = beneficiaries.find(b => b.id === selectedBeneficiaryId);
    
    const loan: Partial<Loan> = {
      beneficiaryId: selectedBeneficiaryId,
      beneficiaryName: beneficiary?.name,
      items: selectedItems,
      loanDate: new Date().toISOString(),
      operatorId: user?.id,
      operatorName: user?.name,
      status: 'active'
    };

    const loanId = Date.now().toString();
    const sbLoan = {
      id: loanId,
      beneficiary_id: selectedBeneficiaryId,
      beneficiary_name: beneficiary?.name || 'N/A',
      operator_id: user?.id,
      operator_name: user?.name,
      status: 'active',
      loan_date: new Date().toISOString()
    };

    try {
      const { error: loanError } = await supabase.from('loans').insert(sbLoan);

      if (!loanError) {
        // Insert loan items
        const sbItems = selectedItems.map(code => ({
          loan_id: loanId,
          notebook_code: code
        }));
        await supabase.from('loan_items').insert(sbItems);

        // Update notebooks status
        await Promise.all(selectedItems.map(code => {
          const nb = notebooks.find(n => n.code === code);
          return supabase.from('notebooks')
            .update({ status: 'loaned' })
            .eq('id', nb?.id);
        }));

        setSuccess('Empréstimo realizado com sucesso!');
        setSelectedItems([]);
        setSelectedBeneficiaryId('');
        setIsLoanModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setError('Erro ao salvar empréstimo.');
    }
  };

  const availableItems = notebooks.filter(n => n.status === 'available');
  const filteredAvailableItems = availableItems.filter(n => n.type === activeType);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Monitoria SESI</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão de Empréstimos e Devoluções de Ativos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsLoanModalOpen(true)}
            className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-sesi-yellow/20 hover:bg-amber-400 hover:-translate-y-0.5 transition-all active:translate-y-0"
          >
            <Plus size={20} />
            NOVO EMPRÉSTIMO
          </button>
        </div>
      </div>

      {/* Quick Stats & Search/Return */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por pessoa, local ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-sm font-medium focus:ring-4 focus:ring-sesi-blue/10 shadow-sm transition-all outline-none"
          />
        </div>
        
        <div className="lg:col-span-4 relative">
          <Scan className="absolute left-5 top-1/2 -translate-y-1/2 text-sesi-blue" size={20} />
          <input 
            type="text"
            placeholder="Devolução Rápida (Scan)..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleReturnByCode((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
            className="w-full pl-14 pr-6 py-5 bg-sesi-blue/5 border border-sesi-blue/20 rounded-[2rem] text-sm font-bold text-sesi-blue placeholder:text-sesi-blue/40 focus:ring-4 focus:ring-sesi-blue/10 shadow-sm transition-all outline-none"
          />
        </div>

        <div className="lg:col-span-2 bg-sesi-blue text-white p-5 rounded-[2rem] flex flex-col justify-center gap-3 shadow-lg shadow-sesi-blue/20">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Ativos</p>
            <p className="text-xl font-black leading-none">{activeLoans.length}</p>
          </div>
          <div className="h-px w-full bg-white/10" />
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Disponíveis</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Laptop size={10} className="text-sesi-yellow" />
                <span className="text-xs font-black">{availableItems.filter(i => i.type === 'notebook').length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-sesi-yellow" />
                <span className="text-xs font-black">{availableItems.filter(i => i.type === 'charger').length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Headphones size={10} className="text-sesi-yellow" />
                <span className="text-xs font-black">{availableItems.filter(i => i.type === 'headphones').length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mouse size={10} className="text-sesi-yellow" />
                <span className="text-xs font-black">{availableItems.filter(i => i.type === 'mouse').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{error}</span>
          <button onClick={() => setError('')} className="ml-auto hover:bg-red-100 p-1 rounded-lg transition-colors"><X size={18} /></button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-600 p-5 rounded-2xl flex items-center gap-3 border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          <span className="text-sm font-bold">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto hover:bg-emerald-100 p-1 rounded-lg transition-colors"><X size={18} /></button>
        </div>
      )}

      {/* Active Loans Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowDownCircle className="text-sesi-blue" size={24} />
            Empréstimos Ativos
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {beneficiaries.slice(0, 5).map((p, i) => (
                <div key={i} className="size-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500">
                  {p.name[0]}
                </div>
              ))}
            </div>
            <span className="text-xs font-bold text-slate-400">Monitorando {activeLoans.length} registros</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredLoans.map((loan) => {
              const loanDate = new Date(loan.loanDate);
              const hoursOut = Math.floor((new Date().getTime() - loanDate.getTime()) / (1000 * 60 * 60));
              const isOld = hoursOut >= 4;

              return (
                <motion.div 
                  key={loan.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:border-sesi-blue/20 transition-all group animate-in fade-in zoom-in-95"
                >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-sesi-blue flex items-center justify-center text-white shadow-lg shadow-sesi-blue/20 group-hover:scale-110 transition-transform">
                      <User size={28} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight">{loan.beneficiaryName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {formatDate(loan.loanDate)} às {new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Laptop size={16} className="text-sesi-yellow" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Notebooks ({loan.items.length})</span>
                    </div>
                    {isOld && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg animate-pulse">
                        <AlertCircle size={10} />
                        {hoursOut}H ATRASADO
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(loan.items || []).map(itemCode => {
                      const item = (notebooks || []).find(n => n.code === itemCode);
                      return (
                        <div key={itemCode} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 group/item hover:border-sesi-blue/30 transition-all">
                          <div className="flex items-center gap-1.5">
                            {item?.type === 'notebook' && <Laptop size={10} className="text-sesi-yellow" />}
                            {item?.type === 'charger' && <Zap size={10} className="text-sesi-blue" />}
                            {item?.type === 'headphones' && <Headphones size={10} className="text-sesi-blue" />}
                            {item?.type === 'mouse' && <Mouse size={10} className="text-sesi-blue" />}
                            <span className="text-[10px] font-black font-mono text-slate-700">{itemCode}</span>
                          </div>
                          <button 
                            onClick={() => handleReturnByCode(itemCode)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Devolver este item"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador</span>
                    <span className="text-xs font-bold text-slate-700">{loan.operatorName}</span>
                  </div>
                  <button 
                    onClick={() => handleReturnAll(loan)}
                    className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Check size={16} />
                    DEVOLVER TUDO
                  </button>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
          {activeLoans.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-300 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <History size={48} className="opacity-20" />
              </div>
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Nenhum empréstimo ativo</h3>
              <p className="text-sm text-slate-400 mt-2">Tudo em ordem no estoque de notebooks.</p>
              <button 
                onClick={() => setIsLoanModalOpen(true)}
                className="mt-6 text-sesi-blue font-black text-sm hover:underline flex items-center gap-2"
              >
                <Plus size={18} />
                Iniciar novo empréstimo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loan Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Novo Empréstimo</h3>
                <p className="text-sm text-slate-500 font-medium">Selecione a pessoa ou local e os notebooks para saída.</p>
              </div>
              <button 
                onClick={() => {
                  setIsLoanModalOpen(false);
                  setSelectedItems([]);
                  setSelectedBeneficiaryId('');
                  setRangeStart(null);
                }} 
                className="size-12 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Column: Selection */}
                <div className="lg:col-span-7 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Beneficiary Selection */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-sesi-blue" />
                        Pessoa ou Local Responsável
                      </label>
                      <select 
                        value={selectedBeneficiaryId}
                        onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                        className="w-full h-16 px-6 bg-slate-50 border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-bold text-slate-700 appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {beneficiaries.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                        ))}
                      </select>
                    </div>

                    {/* Manual Input / Scan */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Scan size={14} className="text-sesi-blue" />
                        Scanner / Digitação
                      </label>
                      <div className="relative">
                        <input 
                          ref={inputRef}
                          type="text"
                          value={scannedCode}
                          onChange={(e) => setScannedCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddItem(scannedCode);
                            }
                          }}
                          placeholder="Ex: NB01 ou NB01-NB10"
                          className="w-full h-16 pl-6 pr-16 bg-slate-50 border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-mono font-black text-slate-700"
                        />
                        <button 
                          onClick={() => handleAddItem(scannedCode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 size-10 bg-sesi-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-sesi-blue/20 flex items-center justify-center"
                        >
                          <Plus size={24} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Type Selection Tabs */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                    {[
                      { id: 'notebook', label: 'Notebooks', icon: Laptop },
                      { id: 'charger', label: 'Carregadores', icon: Zap },
                      { id: 'headphones', label: 'Fones', icon: Headphones },
                      { id: 'mouse', label: 'Mouses', icon: Mouse },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setActiveType(type.id as any)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all",
                          activeType === type.id 
                            ? "bg-white text-sesi-blue shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <type.icon size={16} />
                        <span className="hidden sm:inline">{type.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Grid Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        {activeType === 'notebook' && <Laptop size={14} className="text-sesi-yellow" />}
                        {activeType === 'charger' && <Zap size={14} className="text-sesi-yellow" />}
                        {activeType === 'headphones' && <Headphones size={14} className="text-sesi-yellow" />}
                        {activeType === 'mouse' && <Mouse size={14} className="text-sesi-yellow" />}
                        Grade de {activeType === 'notebook' ? 'Notebooks' : activeType === 'charger' ? 'Carregadores' : activeType === 'headphones' ? 'Fones' : 'Mouses'} Disponíveis
                      </h3>
                      <div className="flex items-center gap-4">
                        {activeType === 'notebook' && (
                          <button 
                            onClick={() => {
                              const selectedNotebook = selectedItems.find(code => {
                                const item = notebooks.find(n => n.code === code);
                                return item?.type === 'notebook';
                              });

                              const nb = selectedNotebook ? null : filteredAvailableItems[0];
                              const charger = availableItems.find(n => n.type === 'charger' && !selectedItems.includes(n.code));
                              const mouse = availableItems.find(n => n.type === 'mouse' && !selectedItems.includes(n.code));
                              const headphones = availableItems.find(n => n.type === 'headphones' && !selectedItems.includes(n.code));
                              
                              const newItems = [];
                              if (nb) newItems.push(nb.code);
                              if (charger) newItems.push(charger.code);
                              if (mouse) newItems.push(mouse.code);
                              if (headphones) newItems.push(headphones.code);
                              
                              if (newItems.length === 0) {
                                setError('Nenhum item adicional disponível para o kit.');
                                return;
                              }

                              setSelectedItems(prev => Array.from(new Set([...prev, ...newItems])));
                              setSuccess('Kit atualizado com sucesso!');
                            }}
                            className="text-[10px] font-black text-sesi-blue hover:underline uppercase tracking-widest flex items-center gap-1"
                          >
                            <Plus size={12} />
                            Adicionar Kit Completo
                          </button>
                        )}
                        <p className="text-[10px] font-bold text-slate-400 italic">Clique duplo para intervalo</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 max-h-[40vh] overflow-y-auto">
                      {filteredAvailableItems.map(nb => (
                        <button
                          key={nb.id}
                          onClick={() => toggleGridItem(nb.code)}
                          onDoubleClick={() => handleDoubleClick(nb.code)}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-black font-mono transition-all border shadow-sm",
                            rangeStart === nb.code 
                              ? "bg-sesi-blue text-white border-sesi-blue scale-110 z-10 ring-4 ring-sesi-blue/20"
                              : selectedItems.includes(nb.code)
                                ? "bg-sesi-yellow border-amber-400 text-slate-900 scale-105"
                                : "bg-white border-slate-200 text-slate-500 hover:border-sesi-blue hover:text-sesi-blue"
                          )}
                        >
                          {nb.code}
                        </button>
                      ))}
                      {filteredAvailableItems.length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold italic">
                          Nenhum item deste tipo disponível.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Selected Items List */}
                <div className="lg:col-span-5 flex flex-col bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 bg-white/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black text-slate-900">Itens na Lista</h3>
                      <span className="px-3 py-1 bg-sesi-yellow text-slate-900 text-[10px] font-black rounded-lg">
                        {selectedItems.length}
                      </span>
                    </div>
                    {selectedItems.length > 0 && (
                      <button 
                        onClick={() => setSelectedItems([])}
                        className="text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto max-h-[50vh]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedItems.map(code => {
                        const item = notebooks.find(n => n.code === code);
                        return (
                          <div key={code} className="group relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-sesi-blue/30 transition-all">
                            <div className="flex flex-col items-center gap-1">
                              {item?.type === 'notebook' && <Laptop size={16} className="text-slate-300 group-hover:text-sesi-blue transition-colors" />}
                              {item?.type === 'charger' && <Zap size={16} className="text-slate-300 group-hover:text-sesi-blue transition-colors" />}
                              {item?.type === 'headphones' && <Headphones size={16} className="text-slate-300 group-hover:text-sesi-blue transition-colors" />}
                              {item?.type === 'mouse' && <Mouse size={16} className="text-slate-300 group-hover:text-sesi-blue transition-colors" />}
                              <span className="font-black text-slate-700 font-mono text-xs">{code}</span>
                            </div>
                            <button 
                              onClick={() => toggleGridItem(code)}
                              className="absolute -top-1.5 -right-1.5 size-5 bg-white border border-slate-200 text-slate-400 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                      {selectedItems.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-300">
                          <Plus size={32} className="opacity-20 mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum item selecionado</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 bg-slate-900 text-white">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de Saída</span>
                      <span className="text-2xl font-black">{selectedItems.length} Itens</span>
                    </div>
                    <button 
                      onClick={handleConfirmLoan}
                      disabled={!selectedBeneficiaryId || selectedItems.length === 0}
                      className="w-full py-4 bg-sesi-yellow text-slate-900 font-black rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Check size={20} />
                      CONFIRMAR EMPRÉSTIMO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador Responsável</p>
                  <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setIsLoanModalOpen(false);
                    setSelectedItems([]);
                    setSelectedBeneficiaryId('');
                    setRangeStart(null);
                  }}
                  className="px-8 py-4 bg-white text-slate-600 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleConfirmLoan}
                  disabled={!selectedBeneficiaryId || selectedItems.length === 0}
                  className="px-12 py-4 bg-sesi-blue text-white font-black rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-sesi-blue/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <Check size={20} />
                  CONFIRMAR EMPRÉSTIMO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
