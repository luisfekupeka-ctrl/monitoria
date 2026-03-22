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
  Mouse,
  Calendar,
  Clock,
  Clock9,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Beneficiary, Notebook, Loan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'alert' | 'info' | 'success';
  read: boolean;
}

export function Loans() {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [history, setHistory] = useState<Loan[]>([]);
  
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
  
  // New States for Advanced Features
  const [activeTab, setActiveTab] = useState<'ativos' | 'agendamentos' | 'historico'>('ativos');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [returnDeadline, setReturnDeadline] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
    fetchData();
    
    // 17:40 Alert Logic
    const timer = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      if (hours === 17 && minutes === 40 && !alertDismissed && activeLoans.length > 0) {
        const nonReturnedNames = activeLoans.map(l => l.beneficiaryName).join(', ');
        
        const newNotify: Notification = {
          id: Date.now().toString(),
          title: 'Alerta de Devolução',
          message: `O prazo de 17:45 está chegando. Notebooks com: ${nonReturnedNames}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          type: 'alert',
          read: false
        };

        setNotifications(prev => [newNotify, ...prev]);
        setAlertDismissed(true);
      }
      
      // Reset alert state at midnight
      if (hours === 0 && minutes === 0) setAlertDismissed(false);
    }, 60000);

    return () => clearInterval(timer);
  }, [activeLoans, alertDismissed]);

  const fetchData = async () => {
     const [pRes, nRes, lRes, sRes] = await Promise.all([
      supabase.from('professors').select('*'),
      supabase.from('notebooks').select('*'),
      supabase.from('loans').select('*, loan_items(notebook_code)'),
      supabase.from('schedules').select('*')
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
        returnDeadline: l.return_deadline,
        operatorId: l.operator_id,
        operatorName: l.operator_name || 'Monitor',
        items: Array.isArray(l.loan_items) ? l.loan_items.map((item: any) => item.notebook_code) : []
      }));
       setActiveLoans(mappedLoans.filter((l: any) => l.status === 'active'));
       setHistory(mappedLoans.filter((l: any) => l.status === 'returned' || l.status === 'completed' || l.status === 'returned_partial'));
    }
    if (sRes.data) {
      setSchedules(sRes.data);
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
      status: 'active',
      returnDeadline: returnDeadline || undefined
    };

    const loanId = Date.now().toString();
    const sbLoan = {
      id: loanId,
      beneficiary_id: selectedBeneficiaryId,
      beneficiary_name: beneficiary?.name || 'N/A',
      operator_id: user?.id,
      operator_name: user?.name,
      status: 'active',
      loan_date: new Date().toISOString(),
      return_deadline: returnDeadline || null
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
        setReturnDeadline('');
        setIsLoanModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro inesperado: ' + err.message);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!selectedBeneficiaryId) {
      setError('Selecione uma pessoa ou local.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Adicione pelo menos um item.');
      return;
    }

    const beneficiary = beneficiaries.find(b => b.id === selectedBeneficiaryId);
    if (!beneficiary) return;

    try {
      const sbSchedule = {
        id: crypto.randomUUID(),
        professor_id: selectedBeneficiaryId,
        equipment_codes: selectedItems,
        scheduled_date: new Date().toISOString().split('T')[0],
        start_time: new Date().toISOString(),
        return_deadline: returnDeadline || null,
        status: 'pending',
        created_by: user?.name
      };

      const { error: sError } = await supabase.from('schedules').insert(sbSchedule);
      if (sError) throw sError;

      setSuccess('Agendamento realizado com sucesso!');
      setSelectedItems([]);
      setSelectedBeneficiaryId('');
      setReturnDeadline('');
      setIsScheduleModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError('Erro ao criar agendamento: ' + err.message);
    }
  };

  const handleStartSchedule = async (schedule: any) => {
    try {
      const loanId = Date.now().toString();
      const sbLoan = {
        id: loanId,
        beneficiary_id: schedule.professor_id,
        beneficiary_name: beneficiaries.find(b => b.id === schedule.professor_id)?.name || 'N/A',
        operator_id: user?.id,
        operator_name: user?.name,
        status: 'active',
        loan_date: new Date().toISOString(),
        return_deadline: schedule.return_deadline
      };

      const loanItems = schedule.equipment_codes.map((code: string) => ({
        loan_id: loanId,
        notebook_code: code
      }));

      const { error: lError } = await supabase.from('loans').insert(sbLoan);
      if (lError) throw lError;

      const { error: liError } = await supabase.from('loan_items').insert(loanItems);
      if (liError) throw liError;

      const { error: sError } = await supabase.from('schedules').delete().eq('id', schedule.id);
      if (sError) throw sError;

      setSuccess('Agendamento iniciado com sucesso!');
      fetchData();
    } catch (err: any) {
      setError('Erro ao iniciar agendamento: ' + err.message);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Deseja realmente excluir este agendamento?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Agendamento excluído.');
      fetchData();
    } catch (err: any) {
      setError('Erro ao excluir: ' + err.message);
    }
  };

  // Filter and sort items for the modal grid using natural sort
  const modalItems = notebooks
    .filter(n => n.type === activeType)
    .filter(n => {
      // If loaning, check if item is already loaned
      const isAlreadyLoaned = activeLoans.some(l => l.items.includes(n.code));
      if (isAlreadyLoaned) return false;

      // Check if scheduled for NOW
      const now = new Date();
      const isScheduledNow = schedules.some(s => {
        if (s.status !== 'pending') return false;
        const start = new Date(s.start_time);
        const deadline = s.return_deadline ? new Date(`${now.toISOString().split('T')[0]}T${s.return_deadline}`) : null;
        
        // Simple check: if scheduled today and start <= now, and (no deadline or now < deadline)
        const isToday = s.scheduled_date === now.toISOString().split('T')[0];
        if (!isToday) return false;
        
        const isAfterStart = now >= start;
        const isBeforeEnd = deadline ? now < deadline : true;
        
        return isAfterStart && isBeforeEnd && s.equipment_codes.includes(n.code);
      });
      
      return !isScheduledNow;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

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
          <div className="relative">
            <button 
              onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
              className={cn(
                "size-14 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-50 hover:text-sesi-blue transition-all shadow-md relative",
                isNotificationMenuOpen && "border-sesi-blue text-sesi-blue"
              )}
            >
              <Bell size={24} />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-3 right-3 size-3 bg-rose-500 rounded-full border-2 border-white" />
              )}
            </button>

            <AnimatePresence>
              {isNotificationMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotificationMenuOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 z-50 ring-1 ring-slate-200"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-black text-slate-900 tracking-tight">Notificações</h4>
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-black text-sesi-blue uppercase tracking-widest hover:underline"
                      >
                        Marcar todas como lidas
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-slate-300">
                          <Bell size={32} className="mx-auto mb-2 opacity-10" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma notificação</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id}
                            className={cn(
                              "p-4 rounded-2xl border transition-all relative group",
                              n.read ? "bg-slate-50/50 border-slate-100" : "bg-blue-50/50 border-blue-100"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "size-8 rounded-xl flex items-center justify-center shrink-0",
                                n.type === 'alert' ? "bg-rose-100 text-rose-500" : "bg-blue-100 text-blue-500"
                              )}>
                                {n.type === 'alert' ? <AlertCircle size={16} /> : <Bell size={16} />}
                              </div>
                              <div className="flex-1">
                                <h5 className="text-xs font-black text-slate-900 mb-1">{n.title}</h5>
                                <p className="text-[11px] text-slate-500 leading-relaxed">{n.message}</p>
                                <span className="text-[9px] font-bold text-slate-400 mt-2 block">{n.time}</span>
                              </div>
                              <button 
                                onClick={() => removeNotification(n.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="group relative flex items-center gap-3 bg-white border border-slate-200 text-slate-900 px-8 py-5 rounded-[2rem] font-black text-sm hover:bg-slate-50 transition-all shadow-lg"
          >
            <Calendar size={20} className="text-sesi-blue" />
            <span>AGENDAR</span>
          </button>
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

      {/* Navigation Tabs */}
      <div className="flex gap-4 p-2 bg-slate-100/50 rounded-[2.5rem] w-fit border border-slate-200/50 mb-8">
        {[
          { id: 'ativos', label: 'Empréstimos Ativos', icon: ArrowDownCircle, color: 'text-sesi-blue' },
          { id: 'agendamentos', label: 'Agendamentos', icon: Calendar, color: 'text-amber-500' },
          { id: 'historico', label: 'Histórico', icon: History, color: 'text-slate-500' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-3 px-8 py-4 rounded-[2rem] text-sm font-black transition-all",
              activeTab === tab.id 
                ? "bg-white text-slate-900 shadow-xl shadow-slate-200/50 scale-105"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
            {tab.label}
          </button>
        ))}
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'ativos' ? 'Fluxo de Saída' : activeTab === 'agendamentos' ? 'Agendamentos' : 'Histórico de Registros'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
               {activeTab === 'ativos' ? activeLoans.length : activeTab === 'agendamentos' ? schedules.length : history.length} Registros
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          <AnimatePresence mode="popLayout">
            {activeTab === 'ativos' && filteredLoans.map((loan) => {
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
                           {loan.returnDeadline && (
                             <span className="text-[10px] font-black text-sesi-blue uppercase tracking-widest flex items-center gap-1 bg-sesi-blue/10 px-2 py-0.5 rounded">
                               <Clock size={10} />
                               Prazo: {loan.returnDeadline}
                             </span>
                           )}
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

            {activeTab === 'agendamentos' && (schedules || []).map((schedule) => {
              const prof = beneficiaries.find(b => b.id === schedule.professor_id);
              return (
                <motion.div 
                  key={schedule.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/60 p-8 hover:border-amber-400/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="size-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                        <Calendar size={28} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 tracking-tight leading-none">{prof?.name || 'Professor'}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Agendado para Hoje</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase">Pendente</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Horário</span>
                       <span className="font-black text-slate-900">{schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Equipamentos</span>
                       <span className="font-black text-sesi-blue">{schedule.equipment_codes?.length || 0} Itens</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {schedule.equipment_codes?.slice(0, 3).map((code: string) => (
                      <span key={code} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black font-mono">{code}</span>
                    ))}
                    {(schedule.equipment_codes?.length || 0) > 3 && (
                      <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold">+{schedule.equipment_codes.length - 3}</span>
                    )}
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={() => handleStartSchedule(schedule)}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black hover:bg-sesi-blue transition-all"
                    >
                      INICIAR AGORA
                    </button>
                    <button 
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {activeTab === 'historico' && (history || []).sort((a,b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime()).slice(0, 20).map((loan) => (
               <motion.div 
                 key={loan.id}
                 layout
                 className="bg-white/50 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 p-6 flex items-center justify-between group"
               >
                 <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                     <History size={24} />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-900 leading-none">{loan.beneficiaryName}</h4>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">Devolvido em {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : 'N/A'}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">{loan.items.length} Itens</span>
                   <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase">Concluído</span>
                 </div>
               </motion.div>
            ))}
          </AnimatePresence>
          
          {((activeTab === 'ativos' && activeLoans.length === 0) || 
            (activeTab === 'agendamentos' && schedules.length === 0) ||
            (activeTab === 'historico' && history.length === 0)) && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-slate-300 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-inner">
               <div className="size-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-8 shadow-xl">
                 <History size={64} className="opacity-10" />
               </div>
               <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vazio por enquanto</h2>
               <p className="text-sm text-slate-400 mt-2 font-medium">Não há registros nesta categoria.</p>
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

                    {/* Return Deadline */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="text-sesi-blue" />
                        Prazo de Devolução (Opcional)
                      </label>
                      <input 
                        type="time"
                        value={returnDeadline}
                        onChange={(e) => setReturnDeadline(e.target.value)}
                        className="w-full h-16 px-6 bg-slate-50 border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-bold text-slate-700"
                      />
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

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Calendar className="text-amber-500" />
                  Agendar Reserva <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded text-xs">NOVO</span>
                </h3>
                <p className="text-sm text-slate-500 font-medium">Reserve equipamentos para uso futuro hoje ou em outra data.</p>
              </div>
              <button 
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setSelectedItems([]);
                  setSelectedBeneficiaryId('');
                  setReturnDeadline('');
                }} 
                className="size-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-amber-500" />
                        Professor Responsável
                      </label>
                      <select 
                        value={selectedBeneficiaryId}
                        onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                        className="w-full h-16 px-6 bg-slate-50 border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700 appearance-none"
                      >
                        <option value="">Selecione o professor...</option>
                        {beneficiaries.filter(b => b.type === 'professor').map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="text-amber-500" />
                        Prazo de Devolução (Opcional)
                      </label>
                      <input 
                        type="time"
                        value={returnDeadline}
                        onChange={(e) => setReturnDeadline(e.target.value)}
                        className="w-full h-16 px-6 bg-slate-50 border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Laboratory Quick Selection for Scheduling */}
                  <div className="space-y-4">
                     <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ArrowDownCircle size={14} className="text-amber-500" />
                        Reservar Laboratório Inteiro
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(notebooks.map(n => n.laboratory).filter(Boolean))).sort().map(lab => (
                          <button
                            key={lab}
                            onClick={() => {
                              const labItems = notebooks.filter(n => n.laboratory === lab && n.type === 'notebook' && n.status === 'available');
                              const codes = labItems.map(n => n.code);
                              setSelectedItems(prev => Array.from(new Set([...prev, ...codes])));
                              setSuccess(`${lab} selecionado para reserva.`);
                            }}
                            className="px-4 py-2 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 border border-slate-100 rounded-xl text-[10px] font-black transition-all uppercase"
                          >
                            SELECIONAR {lab}
                          </button>
                        ))}
                      </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Notebooks Disponíveis para Reserva</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                      {notebooks.filter(n => n.type === 'notebook' && n.status === 'available').map(n => (
                        <button
                          key={n.code}
                          onClick={() => {
                            if (selectedItems.includes(n.code)) {
                              setSelectedItems(prev => prev.filter(c => c !== n.code));
                            } else {
                              setSelectedItems(prev => [...prev, n.code]);
                            }
                          }}
                          className={cn(
                            "group relative h-12 rounded-xl border-2 transition-all flex items-center justify-center font-black text-[10px]",
                            selectedItems.includes(n.code)
                              ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                              : "bg-white border-slate-100 text-slate-400 hover:border-amber-200"
                          )}
                        >
                          {n.code.replace('NB', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Summary */}
                <div className="lg:col-span-5 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col shadow-inner overflow-hidden">
                  <div className="p-8 flex-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Resumo do Agendamento</h4>
                    <div className="space-y-4">
                      {selectedItems.map(code => {
                        const item = notebooks.find(n => n.code === code);
                        return (
                          <div key={code} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                              <Laptop size={16} className="text-amber-500" />
                              <span className="font-black text-slate-700 font-mono text-xs">{code}</span>
                            </div>
                            <button 
                              onClick={() => setSelectedItems(prev => prev.filter(c => c !== code))}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                      {selectedItems.length === 0 && (
                        <div className="py-20 text-center text-slate-300">
                           <Calendar size={48} className="mx-auto mb-4 opacity-10" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Nenhum item selecionado</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-8 bg-slate-900 text-white">
                    <button 
                      onClick={handleConfirmSchedule}
                      disabled={!selectedBeneficiaryId || selectedItems.length === 0}
                      className="w-full py-5 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      <Check size={20} />
                      SALVAR AGENDAMENTO
                    </button>
                  </div>
                </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
