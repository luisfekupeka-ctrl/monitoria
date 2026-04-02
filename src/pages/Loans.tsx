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
import { useNotification } from '../contexts/NotificationContext';
import { cn, formatDate, formatTime, getTimezoneOffset, formatReturnDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Loans() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
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
  const [activeTab, setActiveTab] = useState<'ativos' | 'agendamentos' | 'historico' | 'solicitacoes'>('ativos');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [teacherRequests, setTeacherRequests] = useState<any[]>([]);
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [preparationItems, setPreparationItems] = useState<string[]>([]);
  const [activePreparationType, setActivePreparationType] = useState<string>('notebook');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [startTime, setStartTime] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
     const [pRes, nRes, lRes, sRes, trRes] = await Promise.all([
      supabase.from('professors').select('*'),
      supabase.from('notebooks').select('*'),
      supabase.from('loans').select('*, loan_items(notebook_code)'),
      supabase.from('schedules').select('*'),
      supabase.from('teacher_requests').select('*, professor:professors(name)')
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
    if (trRes.data) {
      setTeacherRequests(trRes.data);
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
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const tzOffset = getTimezoneOffset();

      const sbSchedule = {
        id: crypto.randomUUID(),
        professor_id: selectedBeneficiaryId,
        equipment_codes: selectedItems,
        scheduled_date: dateStr,
        start_time: startTime ? `${dateStr}T${startTime}:00${tzOffset}` : now.toISOString(),
        return_deadline: returnDeadline || null,
        status: 'pending',
        created_by: user?.name
      };

      const { error: sError } = await supabase.from('schedules').insert(sbSchedule);
      if (sError) throw sError;

      setSuccess('Agendamento realizado com sucesso!');
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

  const handleApproveRequest = async (request: any) => {
    if (!confirm(`Aprovar solicitação de ${request.professor.name} para ${request.equipment_codes.length} itens?`)) return;
    try {
      const { error } = await supabase.from('teacher_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);
      if (error) throw error;
      setSuccess('Solicitação aprovada!');
      fetchData();
    } catch (err: any) {
      setError('Erro ao aprovar solicitação: ' + err.message);
    }
  };

  const handleRejectRequest = async (request: any) => {
    const totalItems = Object.values(request.requested_items as Record<string, number>).reduce((a, b) => a + b, 0);
    if (!confirm(`Rejeitar solicitação de ${request.professor?.name || 'Professor'} para ${totalItems} itens?`)) return;
    try {
      const { error } = await supabase.from('teacher_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);
      if (error) throw error;
      setSuccess('Solicitação rejeitada!');
      fetchData();
    } catch (err: any) {
      setError('Erro ao rejeitar solicitação: ' + err.message);
    }
  };

  const handleOpenPrepare = (request: any) => {
    setSelectedRequest(request);
    setPreparationItems([]);
    
    // Set first available requested type as active
    const hasItems = Object.values(request.requested_items as Record<string, number>).some(q => q > 0);
    const types = Object.keys(request.requested_items).filter(k => request.requested_items[k] > 0);
    if (types.length > 0) setActivePreparationType(types[0]);
    
    setIsPrepareModalOpen(true);
  };

  const handleConfirmPrepare = async () => {
    if (!selectedRequest) return;
    
    const requiredTotal = Object.values(selectedRequest.requested_items as Record<string, number>).reduce((a, b) => a + b, 0);
    if (preparationItems.length < requiredTotal) {
      if (!confirm(`Você selecionou apenas ${preparationItems.length} de ${requiredTotal} itens. Deseja continuar mesmo assim?`)) return;
    }

    try {
      // 1. Update request status
      const { error: uError } = await supabase.from('teacher_requests')
        .update({ status: 'prepared' })
        .eq('id', selectedRequest.id);
      if (uError) throw uError;

      // 2. Create standard schedule
      const tzOffset = getTimezoneOffset();
      const { error: sError } = await supabase.from('schedules')
        .insert({
          professor_id: selectedRequest.professor_id,
          equipment_codes: preparationItems,
          scheduled_date: selectedRequest.scheduled_date,
          start_time: `${selectedRequest.scheduled_date}T${selectedRequest.start_time}:00${tzOffset}`,
          return_deadline: selectedRequest.return_deadline ? `${selectedRequest.scheduled_date}T${selectedRequest.return_deadline}:00${tzOffset}` : null,
          status: 'pending',
          created_by: user?.name
        });
      if (sError) throw sError;

      setSuccess('Solicitação preparada e movida para agendamentos!');
      setIsPrepareModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError('Erro ao preparar solicitação: ' + err.message);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('AVISO: Isso irá apagar permanentemente todos os registros de histórico (devoluções concluídas) do banco de dados para liberar espaço. Deseja continuar?')) return;
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .in('status', ['returned', 'completed', 'returned_partial']);
      
      if (error) throw error;
      
      setSuccess('Histórico limpo com sucesso!');
      fetchData();
    } catch (err: any) {
      setError('Erro ao limpar histórico: ' + err.message);
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
      className="max-w-7xl mx-auto space-y-8 md:space-y-12 px-2 md:px-0"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8 mb-6 md:mb-12">
        <div className="text-center lg:text-left">
          <h1 className="text-2xl md:text-5xl font-black tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-emerald-600">
            Monitoria SESI
          </h1>
          <p className="text-slate-500 font-medium mt-1 md:mt-2 flex items-center justify-center lg:justify-start gap-2 text-[10px] md:text-sm">
            <span className="size-1.5 md:size-2 bg-emerald-500 rounded-full animate-pulse" />
            Sistema Ativo • Gestão de Ativos
          </p>
        </div>
        <div className="grid grid-cols-2 lg:flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="group flex flex-col sm:flex-row items-center justify-center gap-1 md:gap-3 bg-white border border-slate-200 text-slate-900 px-4 md:px-8 py-3 md:py-5 rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-sm hover:bg-slate-50 transition-all shadow-lg shadow-slate-200/50"
          >
            <Calendar size={18} className="text-amber-500" />
            <span>AGENDA</span>
          </button>
          <button 
            onClick={() => setIsLoanModalOpen(true)}
            className="group relative flex flex-col sm:flex-row items-center justify-center gap-1 md:gap-3 bg-slate-900 text-white px-4 md:px-10 py-3 md:py-5 rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-sm shadow-2xl shadow-slate-900/20 hover:scale-[1.02] transition-all overflow-hidden"
          >
            <Plus size={18} className="text-sesi-yellow" />
            <span className="relative">NOVO</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Horizontal Scroll on Mobile */}
      <div className="relative mb-6 md:mb-10">
        <div className="flex overflow-x-auto pb-4 -mb-4 scrollbar-hide gap-2 md:gap-4 p-1.5 md:p-2 bg-slate-100/50 rounded-2xl md:rounded-[2.5rem] border border-slate-200/50">
          {[
            { id: 'ativos', label: 'Ativos', fullLabel: 'Ativos', icon: ArrowDownCircle, color: 'text-sesi-blue' },
            { id: 'agendamentos', label: 'Agenda', fullLabel: 'Agenda', icon: Calendar, color: 'text-amber-500' },
            { id: 'solicitacoes', label: 'Pedidos', fullLabel: 'Solicitações', icon: Bell, color: 'text-rose-500' },
            { id: 'historico', label: 'Histórico', fullLabel: 'Histórico', icon: History, color: 'text-slate-500' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-none flex items-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-4 rounded-xl md:rounded-[2rem] text-[10px] md:text-sm font-black transition-all relative whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white text-slate-900 shadow-lg shadow-slate-200/60 scale-105"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tab.icon size={16} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
              <span>{tab.fullLabel}</span>
              {tab.id === 'solicitacoes' && teacherRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="size-3 md:size-4 bg-rose-500 text-white text-[7px] md:text-[8px] flex items-center justify-center rounded-full">
                  {teacherRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Dashboard Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 items-stretch">
        <div className="lg:col-span-4 bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <div className="size-10 md:size-16 rounded-xl md:rounded-[1.5rem] bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <History size={24} />
            </div>
            <div className="text-right">
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Empréstimos Ativos</p>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight">{activeLoans.length}</h2>
            </div>
          </div>
          <div className="space-y-2 md:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px] md:text-[10px]">Fluxo</span>
              <span className="font-black text-emerald-500 text-[10px] md:text-xs">{(activeLoans.length / 50 * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(activeLoans.length / 50 * 100)}%` }}
                className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sesi-blue transition-colors" size={22} />
            <input 
              type="text" 
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-16 md:h-full pl-14 md:pl-16 pr-6 md:pr-8 py-5 md:py-8 bg-white border border-slate-200 rounded-2xl md:rounded-[3rem] text-sm md:text-lg font-bold focus:ring-[12px] focus:ring-sesi-blue/5 focus:border-sesi-blue shadow-xl shadow-slate-200/50 transition-all outline-none"
            />
          </div>
          
          <div className="relative group">
            <Scan className="absolute left-6 top-1/2 -translate-y-1/2 text-sesi-blue" size={22} />
            <input 
              type="text"
              placeholder="Devolução Scanner..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val.trim()) {
                    handleReturnByCode(val);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
              className="w-full h-16 md:h-full pl-14 md:pl-16 pr-6 md:pr-8 py-5 md:py-8 bg-sesi-blue text-white placeholder:text-white/40 border-none rounded-2xl md:rounded-[3rem] text-sm md:text-lg font-black shadow-xl shadow-sesi-blue/30 focus:ring-[12px] focus:ring-sesi-blue/10 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 text-rose-600 p-4 md:p-6 rounded-2xl md:rounded-[2rem] flex items-center gap-3 md:gap-4 border border-rose-100 shadow-lg shadow-rose-500/10"
        >
          <AlertCircle size={22} />
          <span className="text-xs md:text-base font-black">{error}</span>
          <button onClick={() => setError('')} className="ml-auto hover:bg-rose-100 p-2 rounded-xl transition-colors"><X size={20} /></button>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 text-emerald-600 p-4 md:p-6 rounded-2xl md:rounded-[2rem] flex items-center gap-3 md:gap-4 border border-emerald-100 shadow-lg shadow-emerald-500/10"
        >
          <CheckCircle2 size={22} />
          <span className="text-xs md:text-base font-black">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto hover:bg-emerald-100 p-2 rounded-xl transition-colors"><X size={20} /></button>
        </motion.div>
      )}

      {/* Main Grid Section */}
      <div className="space-y-6 md:space-y-8 pt-4 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-8 md:size-10 rounded-xl md:rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
              <ArrowDownCircle size={18} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'ativos' ? 'Fluxo de Saída' : activeTab === 'agendamentos' ? 'Agendamentos' : activeTab === 'solicitacoes' ? 'Solicitações' : 'Histórico'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
             {(activeTab === 'agendamentos' || activeTab === 'solicitacoes') && (
               <div className="flex items-center gap-2">
                 <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Filtro:</span>
                 <input 
                   type="date"
                   value={selectedScheduleDate}
                   onChange={(e) => setSelectedScheduleDate(e.target.value)}
                   className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:ring-2 focus:ring-sesi-blue/20 cursor-pointer text-slate-600"
                 />
                 {selectedScheduleDate && (
                   <button 
                     onClick={() => setSelectedScheduleDate('')}
                     className="text-[9px] md:text-[10px] font-black text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-widest transition-all"
                   >
                     Limpar
                   </button>
                 )}
               </div>
             )}
             {activeTab === 'historico' && history.length > 0 && (
               <button
                 onClick={handleClearHistory}
                 className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
               >
                 <Trash2 size={14} />
                 Limpar
               </button>
             )}
             <span className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-sm">
               {activeTab === 'ativos' ? activeLoans.length : activeTab === 'agendamentos' ? (schedules || []).filter((s: any) => !selectedScheduleDate || s.scheduled_date === selectedScheduleDate).length : activeTab === 'solicitacoes' ? teacherRequests.filter(r => r.status === 'pending' && (!selectedScheduleDate || r.scheduled_date === selectedScheduleDate)).length : history.length} Registros
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
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
                  className="relative bg-white rounded-2xl md:rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col hover:border-sesi-blue/40 transition-all group"
                >
                  <div className="p-4 md:p-8 pb-3 md:pb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="relative">
                        <div className="size-12 md:size-16 rounded-2xl md:rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-sesi-blue group-hover:text-white group-hover:border-sesi-blue transition-all duration-500 shadow-inner">
                          <User size={28} />
                        </div>
                        {isOld && (
                          <div className="absolute -top-1 -right-1 size-4 md:size-5 bg-rose-500 rounded-full border-2 md:border-4 border-white animate-pulse shadow-md shadow-rose-500/40" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-lg md:text-xl tracking-tight leading-tight mb-0.5 md:mb-1">{loan.beneficiaryName}</h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 md:gap-2">
                            <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                              <History size={10} />
                              {formatDate(loan.loanDate)} {formatTime(loan.loanDate)}
                            </span>
                            {loan.returnDeadline && (
                              <span className="text-[8px] md:text-[10px] font-black text-sesi-blue uppercase tracking-widest flex items-center gap-1 bg-white border border-sesi-blue/20 px-3 py-1 rounded-full shadow-sm">
                                <Clock size={10} />
                                Devolver {formatReturnDate(loan.returnDeadline)}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 md:px-8 pb-4 md:pb-8 flex-1">
                    <div className="mb-3 md:mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-amber-50 rounded-lg md:rounded-xl">
                        <Laptop size={14} className="text-sesi-yellow" />
                        <span className="text-[8px] md:text-[10px] font-black text-amber-700 uppercase tracking-widest">{loan.items.length} Itens</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 px-2 md:px-3 py-1 rounded-lg md:rounded-xl",
                        isOld ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                          {isOld ? `${hoursOut}H ATRASADO` : `${minutesOut}min`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {(loan.items || []).map(itemCode => {
                        const item = (notebooks || []).find(n => n.code === itemCode);
                        return (
                          <div key={itemCode} className="group/item flex items-center gap-1.5 md:gap-2 bg-slate-50 hover:bg-slate-100 px-3 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-[1.25rem] border border-slate-100 transition-all">
                            {item?.type === 'notebook' && <Laptop size={14} className="text-sesi-blue" />}
                            {item?.type === 'charger' && <Zap size={14} className="text-amber-500" />}
                            {item?.type === 'headphones' && <Headphones size={14} className="text-rose-500" />}
                            {item?.type === 'mouse' && <Mouse size={14} className="text-emerald-500" />}
                            <span className="text-[10px] md:text-xs font-black font-mono text-slate-700">{itemCode}</span>
                            <button 
                              onClick={() => handleReturnByCode(itemCode)}
                              className="ml-0.5 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          setSelectedBeneficiaryId(loan.beneficiaryId);
                          setIsLoanModalOpen(true);
                          setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                        className="flex items-center justify-center size-8 md:size-10 bg-sesi-blue/10 border-2 border-dashed border-sesi-blue/30 text-sesi-blue rounded-lg md:rounded-[1.25rem] hover:bg-sesi-blue hover:text-white hover:border-sesi-blue transition-all"
                        title="Adicionar mais itens"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 px-4 md:px-8 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 md:gap-3">
                       <div className="size-6 md:size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[8px] md:text-[10px] font-black text-slate-400">
                         {loan.operatorName?.[0] || 'A'}
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Op</span>
                         <span className="text-[9px] md:text-[10px] font-bold text-slate-700 leading-none">{loan.operatorName?.split(' ')[0]}</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => handleReturnAll(loan)}
                      className="px-4 md:px-6 py-2 md:py-3.5 bg-slate-900 text-white rounded-xl md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black hover:bg-sesi-blue transition-all shadow-lg flex items-center gap-2 group-hover:scale-105"
                    >
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      DEVOLVER TUDO
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {activeTab === 'agendamentos' && (schedules || []).filter((s: any) => !selectedScheduleDate || s.scheduled_date === selectedScheduleDate).map((schedule) => {
              const prof = beneficiaries.find(b => b.id === schedule.professor_id);
              return (
                <motion.div 
                  key={schedule.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-2xl md:rounded-[3.5rem] border border-slate-100 shadow-lg shadow-slate-200/40 p-5 md:p-8 hover:border-amber-400/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-3">
                      <div className="size-10 md:size-14 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 tracking-tight leading-none text-base md:text-lg">{prof?.name || 'Professor'}</h4>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          {schedule.scheduled_date === new Date().toISOString().split('T')[0] ? 'Agendado para Hoje' : `Agendado para ${formatDate(schedule.scheduled_date)}`}
                        </p>
                      </div>
                    </div>
                    <div className="px-2 md:px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[9px] md:text-[10px] font-black uppercase">Pendente</div>
                  </div>
                  
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Horário</span>
                       <span className="font-black text-slate-900">{formatTime(schedule.start_time)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Equipamentos</span>
                       <span className="font-black text-sesi-blue">{schedule.equipment_codes?.length || 0} Itens</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-1.5 md:gap-2">
                    {schedule.equipment_codes?.slice(0, 3).map((code: string) => (
                      <span key={code} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] md:text-[10px] font-black font-mono">{code}</span>
                    ))}
                    {(schedule.equipment_codes?.length || 0) > 3 && (
                      <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold">+{schedule.equipment_codes.length - 3}</span>
                    )}
                  </div>

                  <div className="mt-8 flex gap-2 md:gap-3">
                    <button 
                      onClick={() => handleStartSchedule(schedule)}
                      className="flex-1 py-3 md:py-4 bg-slate-900 text-white rounded-2xl text-[9px] md:text-[10px] font-black hover:bg-sesi-blue transition-all shadow-lg shadow-slate-900/10"
                    >
                      INICIAR AGORA
                    </button>
                    <button 
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="size-12 md:size-14 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {activeTab === 'solicitacoes' && (teacherRequests || [])
              .filter(r => r.status === 'pending' && (!selectedScheduleDate || r.scheduled_date === selectedScheduleDate))
              .map((request) => (
              <motion.div 
                key={request.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl md:rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-4 md:p-8 hover:border-rose-400/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-3 md:mb-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="size-10 md:size-14 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                      <Bell size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 tracking-tight leading-none text-base md:text-lg">{request.professor?.name || 'Professor'}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Solicitação</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-2 md:px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase",
                    request.status === 'pending' && 'bg-amber-100 text-amber-600',
                    request.status === 'approved' && 'bg-emerald-100 text-emerald-600',
                    request.status === 'rejected' && 'bg-rose-100 text-rose-600'
                  )}>
                    {request.status === 'pending' && 'Pendente'}
                    {request.status === 'approved' && 'Aprovada'}
                    {request.status === 'rejected' && 'Rejeitada'}
                  </div>
                </div>
                
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between text-[10px] md:text-xs">
                     <span className="font-bold text-slate-400 uppercase tracking-widest">Data/Hora</span>
                     <span className="font-black text-slate-900">
                       {formatDate(request.scheduled_date)} • {request.start_time}
                     </span>
                  </div>
                  {request.destination && (
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                       <span className="font-bold text-slate-400 uppercase tracking-widest">Destino</span>
                       <span className="font-black text-sesi-orange truncate max-w-[120px] md:max-w-[150px]">{request.destination}</span>
                    </div>
                  )}
                  {request.observations && (
                    <div className="mt-2 p-2.5 md:p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Obs</span>
                      <p className="text-[9px] md:text-[10px] text-slate-600 leading-normal font-bold italic truncate md:whitespace-normal">"{request.observations}"</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens</span>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {Object.keys(request.requested_items).map(type => {
                        const qty = (request.requested_items as any)[type];
                        if (qty === 0) return null;
                        return (
                          <div key={type} className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-50 border border-slate-100 rounded-lg md:rounded-xl flex items-center gap-1.5 md:gap-2">
                            <span className="size-1.5 md:size-2 rounded-full bg-sesi-blue" />
                            <span className="text-[9px] md:text-[10px] font-black text-slate-700 uppercase">{qty}x {type}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {request.status === 'pending' && (
                  <div className="mt-6 md:mt-8 flex gap-2 md:gap-3">
                    <button 
                      onClick={() => handleOpenPrepare(request)}
                      className="flex-1 py-3 md:py-4 bg-sesi-blue text-white rounded-2xl md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black hover:bg-sesi-blue/90 transition-all shadow-lg shadow-sesi-blue/20"
                    >
                      PREPARAR KIT
                    </button>
                    <button 
                      onClick={() => handleRejectRequest(request)}
                      className="px-4 md:px-6 py-3 md:py-4 bg-slate-100 text-slate-400 rounded-2xl md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black hover:bg-rose-50 hover:text-rose-500 transition-all"
                    >
                      X
                    </button>
                  </div>
                )}
              </motion.div>
            ))}

            {activeTab === 'historico' && (history || []).sort((a,b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime()).slice(0, 20).map((loan) => (
               <motion.div 
                 key={loan.id}
                 layout
                 className="bg-white/50 backdrop-blur-sm rounded-2xl md:rounded-[2.5rem] border border-slate-100 p-4 md:p-6 flex items-center justify-between group"
               >
                 <div className="flex items-center gap-3 md:gap-4">
                   <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                     <History size={22} />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-900 leading-none text-xs md:text-sm">{loan.beneficiaryName}</h4>
                     <p className="text-[9px] md:text-[10px] text-slate-400 font-medium mt-1">Devolvido em {formatDate(loan.returnDate)} às {formatTime(loan.returnDate)}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <span className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">{loan.items.length} Itens</span>
                   <span className="px-2 md:px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[7px] md:text-[8px] font-black uppercase">Concluído</span>
                 </div>
               </motion.div>
            ))}
          </AnimatePresence>
          
          {((activeTab === 'ativos' && activeLoans.length === 0) || 
            (activeTab === 'agendamentos' && (schedules || []).length === 0) ||
            (activeTab === 'solicitacoes' && (teacherRequests || []).length === 0) ||
            (activeTab === 'historico' && history.length === 0)) && (
            <div className="col-span-full py-20 md:py-40 flex flex-col items-center justify-center text-slate-300 bg-white rounded-3xl md:rounded-[4rem] border-2 border-dashed border-slate-100 shadow-inner px-6 text-center">
               <div className="size-20 md:size-32 bg-slate-50 rounded-2xl md:rounded-[3rem] flex items-center justify-center mb-6 md:mb-8 shadow-xl">
                 <History size={48} className="opacity-10" />
               </div>
               <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Vazio por enquanto</h2>
               <p className="text-xs md:text-sm text-slate-400 mt-2 font-medium">Não há registros nesta categoria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Loan Modal */}
{/* Loan Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-7xl h-[100dvh] md:h-[90vh] bg-white rounded-none md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="p-6 md:p-10 lg:p-12 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="size-12 md:size-16 bg-sesi-yellow text-slate-900 rounded-2xl md:rounded-[2rem] flex items-center justify-center shadow-2xl shadow-sesi-yellow/30">
                  <ArrowDownCircle size={28} />
                </div>
                <div>
                  <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Novo Empréstimo</h2>
                  <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Ativos • Monitoria</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsLoanModalOpen(false);
                  setSelectedItems([]);
                  setSelectedBeneficiaryId('');
                }}
                className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="flex flex-col lg:grid lg:grid-cols-12 h-full">
                {/* Left Column: Form and Selection */}
                <div className="lg:col-span-7 p-4 md:p-10 lg:p-12 space-y-6 md:space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-sesi-blue" />
                        Pessoa ou Local
                      </label>
                      <select 
                        value={selectedBeneficiaryId}
                        onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                        className="w-full h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-bold text-slate-700"
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
                        className="w-full h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-bold text-slate-700"
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
                          className="w-full h-14 md:h-16 pl-6 pr-16 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-sesi-blue/10 outline-none transition-all font-mono font-black text-slate-700"
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

                    <div className="flex overflow-x-auto pb-4 -mb-4 scrollbar-hide grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-4 md:p-5 bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 max-h-[35vh] md:max-h-[40vh] overflow-y-auto">
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
                <div className="lg:col-span-5 flex flex-col bg-slate-50 rounded-none lg:rounded-[2.5rem] border-t lg:border border-slate-100 overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-slate-200 bg-white/50 flex items-center justify-between">
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

            <div className="mt-auto p-4 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
              <div className="hidden md:flex items-center gap-4">
                <div className="size-10 md:size-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <User size={22} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador Responsável</p>
                  <p className="text-xs md:text-sm font-bold text-slate-900">{user?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                <button 
                  onClick={() => {
                    setIsLoanModalOpen(false);
                    setSelectedItems([]);
                    setSelectedBeneficiaryId('');
                    setRangeStart(null);
                  }}
                  className="flex-1 md:flex-none px-6 md:px-8 py-3.5 md:py-4 bg-white text-slate-600 font-black rounded-xl md:rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all text-xs md:text-sm"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleConfirmLoan}
                  disabled={!selectedBeneficiaryId || selectedItems.length === 0}
                  className="flex-1 md:flex-none px-8 md:px-12 py-3.5 md:py-4 bg-sesi-blue text-white font-black rounded-xl md:rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-sesi-blue/20 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-2 md:gap-3 text-xs md:text-sm"
                >
                  <Check size={20} />
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prepare Request Modal */}
      <AnimatePresence>
        {isPrepareModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsPrepareModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-5xl h-[100dvh] md:h-full bg-white rounded-none md:rounded-[4rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 md:p-10 lg:p-12 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="size-10 md:size-16 bg-sesi-blue text-white rounded-xl md:rounded-[2rem] flex items-center justify-center shadow-xl shadow-sesi-blue/20">
                    <Laptop size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-3xl font-black text-slate-900 tracking-tight">Preparar Kit</h2>
                    <p className="text-[9px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {selectedRequest.professor?.name} • {selectedRequest.start_time?.slice(0, 5)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPrepareModalOpen(false)} 
                  className="size-10 md:size-14 bg-white text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100"
                >
                  <X size={22} />
                </button>
              </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto scrollbar-hide">
              {/* Left side: Item Selection */}
              <div className="w-full lg:w-2/3 p-4 md:p-10 lg:p-12 border-b lg:border-r lg:border-b-0 border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex flex-wrap gap-2 md:gap-4">
                    {Object.keys(selectedRequest.requested_items).filter(k => (selectedRequest.requested_items as any)[k] > 0).map((type) => (
                      <button
                        key={type}
                        onClick={() => setActivePreparationType(type)}
                        className={cn(
                          "px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all",
                          activePreparationType === type 
                            ? "bg-sesi-blue text-white shadow-lg shadow-sesi-blue/20" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-100"
                        )}
                      >
                        {type}s ({(selectedRequest.requested_items as any)[type]})
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const requestedQty = (selectedRequest.requested_items as any)[activePreparationType] || 0;
                      const currentlySelectedCount = preparationItems.filter(code => {
                        const item = notebooks.find(n => n.code === code);
                        return item?.type === activePreparationType;
                      }).length;
                      
                      const qtyToSelect = Math.max(0, requestedQty - currentlySelectedCount);
                      
                      if (qtyToSelect <= 0) return;

                      const available = notebooks
                        .filter(n => n.type === activePreparationType && n.status === 'available' && !preparationItems.includes(n.code))
                        .sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true}))
                        .slice(0, qtyToSelect);
                      
                      setPreparationItems(prev => [...prev, ...available.map(n => n.code)]);
                    }}
                    className="w-full md:w-auto px-6 py-3 bg-sesi-orange text-white rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sesi-orange/20 hover:scale-105 transition-all text-center"
                  >
                    Selecionar Automático
                  </button>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-4 gap-2 md:gap-4">
                  {notebooks
                    .filter(n => n.type === activePreparationType && n.status === 'available')
                    .sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true, sensitivity: 'base'}))
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (rangeStart) {
                            const availableForCurrentType = notebooks
                              .filter(n => n.type === activePreparationType && n.status === 'available')
                              .sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true, sensitivity: 'base'}));
                            const allCodes = availableForCurrentType.map(n => n.code);
                            const startIndex = allCodes.indexOf(rangeStart);
                            const endIndex = allCodes.indexOf(item.code);
                            const start = Math.min(startIndex, endIndex);
                            const end = Math.max(startIndex, endIndex);
                            const rangeCodes = allCodes.slice(start, end + 1);
                            setPreparationItems(prev => Array.from(new Set([...prev, ...rangeCodes])));
                            setRangeStart(null);
                          } else {
                            if (preparationItems.includes(item.code)) {
                              setPreparationItems(prev => prev.filter(c => c !== item.code));
                            } else {
                              setPreparationItems(prev => [...prev, item.code]);
                            }
                          }
                        }}
                        onDoubleClick={() => setRangeStart(item.code)}
                        className={cn(
                          "group p-3 rounded-2xl md:rounded-3xl border-2 transition-all text-left",
                          preparationItems.includes(item.code)
                            ? "bg-sesi-blue border-sesi-blue text-white shadow-xl shadow-sesi-blue/20"
                            : rangeStart === item.code
                              ? "border-sesi-blue ring-4 ring-sesi-blue/10 scale-105 z-10"
                              : "bg-white border-slate-100 hover:border-sesi-blue/50 text-slate-600"
                        )}
                      >
                        <div className={cn(
                          "size-8 rounded-xl mb-2 flex items-center justify-center transition-colors",
                          preparationItems.includes(item.code) ? "bg-white/20" : "bg-slate-50 group-hover:bg-sesi-blue/10"
                        )}>
                          {item.type === 'notebook' && <Laptop size={14} />}
                          {item.type === 'mouse' && <Mouse size={14} />}
                          {item.type === 'charger' && <Zap size={14} />}
                          {item.type === 'headphones' && <Headphones size={14} />}
                        </div>
                        <div className="font-black text-[9px] md:text-xs tracking-tight">{item.code}</div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Right side: Summary */}
              <div className="w-full lg:w-1/3 p-4 md:p-10 lg:p-12 bg-slate-50/50 flex flex-col">
                <div className="flex-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 md:mb-8">Resumo da Preparação</h3>
                  
                  <div className="space-y-4 md:space-y-6">
                    {Object.keys(selectedRequest.requested_items).filter(k => (selectedRequest.requested_items as any)[k] > 0).map((type) => {
                       const requested = (selectedRequest.requested_items as any)[type];
                       const selected = preparationItems.filter(code => {
                         const item = notebooks.find(n => n.code === code);
                         return item?.type === type;
                       }).length;
                       
                       return (
                         <div key={type} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100">
                           <div className="flex items-center justify-between mb-2 text-[10px] font-black uppercase tracking-widest">
                             <span className="text-slate-400">{type}s</span>
                             <span className={cn(selected >= requested ? "text-emerald-500" : "text-amber-500")}>
                               {selected}/{requested}
                             </span>
                           </div>
                           <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full transition-all", selected >= requested ? "bg-emerald-500" : "bg-amber-500")}
                               style={{ width: `${Math.min(100, (selected / requested) * 100)}%` }}
                             />
                           </div>
                         </div>
                       );
                    })}
                  </div>

                  <div className="mt-8 md:mt-12 space-y-3 md:space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens Selecionados ({preparationItems.length})</label>
                     <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
                       {preparationItems.map(code => (
                         <span key={code} className="px-2 md:px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] md:text-[10px] font-black font-mono shadow-sm">
                           {code}
                         </span>
                       ))}
                       {preparationItems.length === 0 && <p className="text-[10px] font-bold text-slate-300 italic">Nenhum item selecionado</p>}
                     </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmPrepare}
                  disabled={preparationItems.length === 0}
                  className="w-full h-14 md:h-20 mt-4 lg:mt-0 bg-emerald-500 text-white rounded-xl md:rounded-[2rem] font-black text-base md:text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                >
                  FINALIZAR
                  <Check size={22} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isScheduleModalOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-5xl h-[100dvh] md:h-auto md:max-h-[95vh] rounded-none md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="p-4 md:p-8 border-b border-slate-100 flex items-center justify-between bg-white text-center md:text-left">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="size-10 md:size-12 bg-amber-50 text-amber-500 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                <Calendar size={22} />
              </div>
              <div className="text-left">
                <h3 className="text-lg md:text-2xl font-black text-slate-900 leading-tight">
                  Agendar Reserva
                </h3>
                <p className="text-[9px] md:text-sm text-slate-500 font-medium">Reserve itens para o futuro.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsScheduleModalOpen(false);
              setSelectedItems([]);
              setSelectedBeneficiaryId('');
              setReturnDeadline('');
              setStartTime('');
              }} 
              className="size-10 md:size-12 bg-slate-50 text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
              <div className="lg:col-span-7 space-y-5 md:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User size={14} className="text-amber-500" />
                      Professor Responsável
                    </label>
                    <select 
                      value={selectedBeneficiaryId}
                      onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                      className="w-full h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-sm md:text-base text-slate-700"
                    >
                      <option value="">Selecione o professor...</option>
                        {beneficiaries.filter(b => b.type === 'professor').map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="text-amber-500" />
                        Horário de Retirada
                      </label>
                      <input 
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="text-amber-500" />
                        Prazo de Devolução (Opcional)
                      </label>
                      <input 
                        type="time"
                        value={returnDeadline}
                        onChange={(e) => setReturnDeadline(e.target.value)}
                        className="w-full h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-slate-100 rounded-xl md:rounded-[1.25rem] focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-slate-700"
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
                <div className="lg:col-span-5 bg-slate-50 rounded-2xl md:rounded-[2.5rem] border border-slate-100 flex flex-col shadow-inner overflow-hidden">
                  <div className="p-4 md:p-8 flex-1">
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
                  <div className="p-4 md:p-8 bg-slate-900 text-white">
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
      </AnimatePresence>
    </motion.div>
  );
}
