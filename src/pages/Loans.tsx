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
      if (nRes.data) {
        const sortedNotebooks = [...nRes.data]
          .sort((a, b) => {
            const codeA = (a.code || '').trim().toUpperCase();
            const codeB = (b.code || '').trim().toUpperCase();
            return codeA.localeCompare(codeB, undefined, { numeric: true });
          })
          .map(n => ({
            ...n,
            createdBy: n.created_by
          }));
        setNotebooks(sortedNotebooks);
      }
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
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    const loan = activeLoans.find(l => l.items.includes(cleanCode));
    if (!loan) {
      setError(`Empréstimo ativo para o equipamento ${cleanCode} não encontrado.`);
      return;
    }

    try {
      const nb = notebooks.find(n => n.code.trim().toUpperCase() === cleanCode);
      if (!nb) {
         setError(`Equipamento ${cleanCode} não encontrado no sistema.`);
         return;
      }

      await supabase.from('notebooks')
        .update({ status: 'available' })
        .eq('id', nb.id);

      const newItems = loan.items.filter(item => item.trim().toUpperCase() !== cleanCode);
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
          .eq('notebook_code', cleanCode);
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
      // Get notebook IDs for the items in this loan
      const notebookIds = loan.items
        .map(code => notebooks.find(n => n.code.trim().toUpperCase() === code.trim().toUpperCase())?.id)
        .filter(Boolean) as string[];

      if (notebookIds.length > 0) {
        // Update all notebooks to available in one go
        await supabase.from('notebooks')
          .update({ status: 'available' })
          .in('id', notebookIds);
      }

      // Mark loan as returned
      const { error: loanError } = await supabase.from('loans')
        .update({ 
          status: 'returned', 
          return_date: new Date().toISOString() 
        })
        .eq('id', loan.id);

      if (loanError) throw loanError;

      setSuccess(`Todos os itens de ${loan.beneficiaryName} foram devolvidos.`);
      fetchData();
    } catch (err) {
      console.error('Error in handleReturnAll:', err);
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
      const { data: newLoan, error: loanError } = await supabase
        .from('loans')
        .insert(sbLoan)
        .select()
        .single();

      if (loanError) {
        console.error("Erro no supabase (loans):", loanError);
        alert('Erro do Banco de Dados: ' + loanError.message);
        return;
      }

      if (newLoan) {
        // Insert loan items
        const sbItems = selectedItems.map(code => ({
          loan_id: newLoan.id,
          notebook_code: code
        }));
        const { error: itemsError } = await supabase.from('loan_items').insert(sbItems);
        
        if (itemsError) {
           console.error("Erro no supabase (loan_items):", itemsError);
           alert('Aviso: empréstimo criado, mas falha ao salvar os itens: ' + itemsError.message);
        }

        // Update notebooks status
        await Promise.all(selectedItems.map(async (code) => {
          const cleanCode = code.trim().toUpperCase();
          const nb = notebooks.find(n => n.code.trim().toUpperCase() === cleanCode);
          if (nb) {
            return supabase.from('notebooks')
              .update({ status: 'loaned' })
              .eq('id', nb.id);
          }
        }));

        setSuccess('Empréstimo realizado com sucesso!');
        setSelectedItems([]);
        setSelectedBeneficiaryId('');
        setIsLoanModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro inesperado: ' + err.message);
    }
  };

  // Filter and sort items for the modal grid using natural sort
  const modalItems = notebooks
    .filter(n => n.type === activeType)
    .sort((a, b) => {
      const codeA = (a.code || '').trim().toUpperCase();
      const codeB = (b.code || '').trim().toUpperCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
            Monitoria SESI
          </h1>
          <p className="text-slate-500 font-medium mt-2 flex items-center gap-2">
            <span className="size-2 bg-emerald-500 rounded-full animate-pulse" />
            Sistema Ativo • Gestão de Empréstimos e Devoluções
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsLoanModalOpen(true)}
            className="group relative flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-sm shadow-2xl shadow-slate-900/20 hover:scale-105 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-sesi-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Plus size={22} className="text-sesi-yellow" />
            <span className="relative">NOVO EMPRÉSTIMO</span>
          </button>
        </div>
      </div>

      {/* Grid of Dashboard Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-4 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-8">
            <div className="size-16 rounded-[1.5rem] bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <History size={32} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Empréstimos Ativos</p>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">{activeLoans.length}</h2>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-widest">Capacidade e Fluxo</span>
              <span className="font-black text-sesi-blue">{(activeLoans.length / 50 * 100).toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(activeLoans.length / 50 * 100)}%` }}
                className="h-full bg-gradient-to-r from-sesi-blue to-blue-400 rounded-full"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sesi-blue transition-colors" size={24} />
            <input 
              type="text" 
              placeholder="Pesquisar registros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full pl-16 pr-8 py-8 bg-white border border-slate-200 rounded-[3rem] text-lg font-bold focus:ring-[12px] focus:ring-sesi-blue/5 focus:border-sesi-blue shadow-xl shadow-slate-200/50 transition-all outline-none"
            />
          </div>
          
          <div className="relative group">
            <Scan className="absolute left-6 top-1/2 -translate-y-1/2 text-sesi-blue" size={24} />
            <input 
              type="text"
              placeholder="Devolução via Scanner..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val.trim()) {
                    handleReturnByCode(val);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
              className="w-full h-full pl-16 pr-8 py-8 bg-sesi-blue text-white placeholder:text-white/40 border-none rounded-[3rem] text-lg font-black shadow-xl shadow-sesi-blue/30 focus:ring-[12px] focus:ring-sesi-blue/10 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 text-rose-600 p-6 rounded-[2rem] flex items-center gap-4 border border-rose-100 shadow-lg shadow-rose-500/10"
        >
          <AlertCircle size={24} />
          <span className="text-base font-black">{error}</span>
          <button onClick={() => setError('')} className="ml-auto hover:bg-rose-100 p-2 rounded-xl transition-colors"><X size={20} /></button>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 text-emerald-600 p-6 rounded-[2rem] flex items-center gap-4 border border-emerald-100 shadow-lg shadow-emerald-500/10"
        >
          <CheckCircle2 size={24} />
          <span className="text-base font-black">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto hover:bg-emerald-100 p-2 rounded-xl transition-colors"><X size={20} /></button>
        </motion.div>
      )}

      {/* Main Grid Section */}
      <div className="space-y-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
              <ArrowDownCircle size={20} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Fluxo de Saída</h2>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
               {activeLoans.length} Registros no momento
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          <AnimatePresence mode="popLayout">
            {filteredLoans.map((loan) => {
              const loanDate = new Date(loan.loanDate);
              const minutesOut = Math.floor((new Date().getTime() - loanDate.getTime()) / (1000 * 60));
              const hoursOut = Math.floor(minutesOut / 60);
              const isOld = hoursOut >= 4;

              return (
                <motion.div 
                  key={loan.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/60 overflow-hidden flex flex-col hover:border-sesi-blue/40 transition-all group"
                >
                  <div className="p-8 pb-6 flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="size-16 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-sesi-blue group-hover:text-white group-hover:border-sesi-blue transition-all duration-500 shadow-inner">
                          <User size={32} />
                        </div>
                        {isOld && (
                          <div className="absolute -top-1 -right-1 size-5 bg-rose-500 rounded-full border-4 border-white animate-pulse shadow-md shadow-rose-500/40" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-xl tracking-tight leading-tight mb-1">{loan.beneficiaryName}</h4>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                             <History size={10} />
                             {formatDate(loan.loanDate)} às {new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 pb-8 flex-1">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-xl">
                        <Laptop size={14} className="text-sesi-yellow" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">{loan.items.length} Itens out</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-xl",
                        isOld ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {isOld ? `${hoursOut}H ATRASADO` : `${minutesOut}min decorridos`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(loan.items || []).map(itemCode => {
                        const item = (notebooks || []).find(n => n.code === itemCode);
                        return (
                          <div key={itemCode} className="group/item flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-[1.25rem] border border-slate-100 transition-all">
                            {item?.type === 'notebook' && <Laptop size={14} className="text-sesi-blue" />}
                            {item?.type === 'charger' && <Zap size={14} className="text-amber-500" />}
                            {item?.type === 'headphones' && <Headphones size={14} className="text-rose-500" />}
                            {item?.type === 'mouse' && <Mouse size={14} className="text-emerald-500" />}
                            <span className="text-xs font-black font-mono text-slate-700">{itemCode}</span>
                            <button 
                              onClick={() => handleReturnByCode(itemCode)}
                              className="ml-1 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 px-8 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
                       <div className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                         {loan.operatorName?.[0] || 'A'}
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operador</span>
                         <span className="text-[10px] font-bold text-slate-700 leading-none">{loan.operatorName}</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => handleReturnAll(loan)}
                      className="px-6 py-3.5 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black hover:bg-sesi-blue transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2 group-hover:scale-105 active:scale-95"
                    >
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      DEVOLVER TUDO
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {activeLoans.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-slate-300 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-inner">
              <div className="size-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-8 shadow-xl">
                <History size={64} className="opacity-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Registro de Empréstimos <span className="text-xs font-normal text-slate-400 font-mono">[v2.2]</span></h2>
              <p className="text-sm text-slate-400 mt-2 font-medium">Todos os equipamentos estão disponíveis no momento.</p>
              <button 
                onClick={() => setIsLoanModalOpen(true)}
                className="mt-8 bg-sesi-blue text-white px-8 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-sesi-blue/20"
              >
                Novo Empréstimo
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
                <h3 className="text-2xl font-black text-slate-900">Novo Empréstimo <span className="text-sesi-blue bg-sesi-blue/10 px-2 py-0.5 rounded text-xs">[v2.3]</span></h3>
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

                              const nb = selectedNotebook ? null : modalItems.find(n => n.status === 'available' && !selectedItems.includes(n.code));
                              const charger = notebooks.find(n => n.type === 'charger' && n.status === 'available' && !selectedItems.includes(n.code));
                              const mouse = notebooks.find(n => n.type === 'mouse' && n.status === 'available' && !selectedItems.includes(n.code));
                              const headphones = notebooks.find(n => n.type === 'headphones' && n.status === 'available' && !selectedItems.includes(n.code));
                              
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

                    {/* Laboratory Quick Selection */}
                    {activeType === 'notebook' && Array.from(new Set(notebooks.map(n => n.laboratory).filter(Boolean))).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="w-full mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emprestar Laboratório Inteiro</span>
                        </div>
                        {Array.from(new Set(notebooks.map(n => n.laboratory).filter(Boolean))).sort().map(lab => {
                          const labItems = notebooks.filter(n => n.laboratory === lab && n.type === 'notebook');
                          const availableLabItems = labItems.filter(n => n.status === 'available');
                          const allLabSelected = availableLabItems.length > 0 && availableLabItems.every(n => selectedItems.includes(n.code));
                          
                          if (labItems.length === 0) return null;

                          return (
                            <button
                              key={lab}
                              onClick={() => {
                                if (allLabSelected) {
                                  // Deselect all from this lab
                                  const labCodes = labItems.map(n => n.code);
                                  setSelectedItems(prev => prev.filter(c => !labCodes.includes(c)));
                                } else {
                                  // Select all available from this lab
                                  const availableCodes = availableLabItems.map(n => n.code);
                                  setSelectedItems(prev => Array.from(new Set([...prev, ...availableCodes])));
                                }
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-sm flex items-center gap-2",
                                allLabSelected
                                  ? "bg-sesi-blue text-white border-sesi-blue shadow-lg scale-105"
                                  : availableLabItems.length === 0
                                    ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-sesi-blue"
                              )}
                            >
                              <Laptop size={14} className={allLabSelected ? "text-sesi-yellow" : "text-slate-400"} />
                              {lab}
                              <span className="text-[10px] opacity-60">({availableLabItems.length}/{labItems.length})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 max-h-[40vh] overflow-y-auto">
                      {modalItems.map(nb => {
                        const isLoaned = nb.status === 'loaned';
                        const isSelected = selectedItems.includes(nb.code);
                        const isRangeStart = rangeStart === nb.code;

                        return (
                          <button
                            key={nb.id}
                            disabled={isLoaned}
                            onClick={() => !isLoaned && toggleGridItem(nb.code)}
                            onDoubleClick={() => !isLoaned && handleDoubleClick(nb.code)}
                            title={isLoaned ? "Este equipamento já está em uso" : ""}
                            className={cn(
                              "py-3 rounded-xl text-[10px] font-black font-mono transition-all border shadow-sm relative",
                              isLoaned
                                ? "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed grayscale"
                                : isRangeStart
                                  ? "bg-sesi-blue text-white border-sesi-blue scale-110 z-10 ring-4 ring-sesi-blue/20"
                                  : isSelected
                                    ? "bg-sesi-yellow border-amber-400 text-slate-900 scale-105"
                                    : "bg-white border-slate-200 text-slate-500 hover:border-sesi-blue hover:text-sesi-blue"
                            )}
                          >
                            {nb.code}
                            {isLoaned && (
                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-full h-[1px] bg-slate-300 -rotate-12 opacity-50" />
                               </div>
                            )}
                          </button>
                        );
                      })}
                      {modalItems.length === 0 && (
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
