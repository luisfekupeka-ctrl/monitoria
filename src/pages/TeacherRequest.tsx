import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Laptop, 
  Mouse, 
  Zap, 
  Headphones, 
  Clock, 
  User, 
  ChevronRight, 
  CheckCircle2,
  Minus,
  Plus,
  Send,
  AlertCircle,
  Calendar,
  Phone,
  Sun,
  Sunset,
  Package,
  TrendingDown,
  History,
  Edit2,
  Trash2,
  ChevronLeft,
  Search,
  Filter,
  Tablet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, formatTime } from '../lib/utils';

interface EquipmentItem {
  id: string;
  label: string;
  icon: any;
  color: string;
}

const EQUIPMENT_TYPES: EquipmentItem[] = [
  { id: 'notebook', label: 'Notebooks', icon: Laptop, color: 'bg-blue-500' },
  { id: 'mesa', label: 'Mesas Digitais', icon: Tablet, color: 'bg-rose-500' },
  { id: 'mouse', label: 'Mouses', icon: Mouse, color: 'bg-amber-500' },
  { id: 'charger', label: 'Carregadores', icon: Zap, color: 'bg-emerald-500' },
  { id: 'headphones', label: 'Fones', icon: Headphones, color: 'bg-purple-500' },
  { id: 'kit', label: 'Kit Completo', icon: CheckCircle2, color: 'bg-indigo-500' }
];

function getShiftFromTime(time: string): 'morning' | 'afternoon' | null {
  if (!time) return null;
  const [h] = time.split(':').map(Number);
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 13 && h < 18) return 'afternoon';
  return null;
}

// Inline availability bar for each equipment row
function AvailabilityBar({ 
  available, 
  total,
  morningAvailable,
  afternoonAvailable,
  shift
}: { 
  available: number; 
  total: number;
  morningAvailable: number;
  afternoonAvailable: number;
  shift: 'morning' | 'afternoon' | null;
}) {
  const morningPct = total > 0 ? (morningAvailable / total) * 100 : 0;
  const afternoonPct = total > 0 ? (afternoonAvailable / total) * 100 : 0;

  const getBarColor = (val: number) => {
    if (val >= 60) return 'bg-emerald-500';
    if (val >= 30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getGlow = (val: number) => {
    if (val >= 60) return 'shadow-emerald-500/30';
    if (val >= 30) return 'shadow-amber-500/30';
    return 'shadow-rose-500/30';
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <Sun size={10} className="text-amber-400 shrink-0" />
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${morningPct}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
            className={cn("h-full rounded-full shadow-sm", getBarColor(morningPct), getGlow(morningPct))}
          />
        </div>
        <span className={cn(
          "text-[9px] font-black tabular-nums min-w-[24px] text-right",
          morningAvailable <= 5 ? "text-rose-400" : morningAvailable <= 15 ? "text-amber-400" : "text-emerald-400"
        )}>
          {morningAvailable}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Sunset size={10} className="text-orange-400 shrink-0" />
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${afternoonPct}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
            className={cn("h-full rounded-full shadow-sm", getBarColor(afternoonPct), getGlow(afternoonPct))}
          />
        </div>
        <span className={cn(
          "text-[9px] font-black tabular-nums min-w-[24px] text-right",
          afternoonAvailable <= 5 ? "text-rose-400" : afternoonAvailable <= 15 ? "text-amber-400" : "text-emerald-400"
        )}>
          {afternoonAvailable}
        </span>
      </div>
    </div>
  );
}

export default function TeacherRequest() {
  const [professors, setProfessors] = useState<{ id: string, name: string, type: string, phone?: string, pin?: string }[]>([]);
  const [selectedProfessorId, setSelectedProfessorId] = useState('');
  
  // Search state for professor
  const [professorSearch, setProfessorSearch] = useState('');
  const [isProfessorDropdownOpen, setIsProfessorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Navigation & View States
  const [view, setView] = useState<'selection' | 'form' | 'management'>('selection');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [managementFilter, setManagementFilter] = useState<'future' | 'past' | 'all'>('future');

  // PIN states
  const [phoneInput, setPhoneInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Form states
  const [requestedItems, setRequestedItems] = useState<Record<string, number>>({
    notebook: 0,
    mesa: 0,
    mouse: 0,
    charger: 0,
    headphones: 0,
    kit: 0
  });
  const [stock, setStock] = useState<Record<string, number>>({});
  const [totalStock, setTotalStock] = useState<Record<string, number>>({});
  const [dayRequests, setDayRequests] = useState<any[]>([]);
  const [destination, setDestination] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [startTime, setStartTime] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token } = useParams<{ token: string }>();
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    validateToken();
    fetchProfessors();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfessorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [token]);

  // Refetch availability whenever date changes
  useEffect(() => {
    fetchAvailability();
  }, [scheduledDate]);

  const fetchAvailability = async () => {
    const { data: notebooksData } = await supabase.from('notebooks').select('*');
    const { data: requestsData } = await supabase
      .from('teacher_requests')
      .select('*, professor:professors(name)')
      .eq('scheduled_date', scheduledDate)
      .in('status', ['pending', 'approved', 'prepared']);

    if (requestsData) setDayRequests(requestsData);

    if (notebooksData) {
      const totals: Record<string, number> = {};
      const availables: Record<string, number> = {};
      const types = ['notebook', 'mouse', 'charger', 'headphones', 'mesa'];
      types.forEach(type => {
        const allOfType = notebooksData.filter((n: any) => n.type === type);
        totals[type] = allOfType.length;
        availables[type] = allOfType.filter((n: any) => n.status === 'available').length;
      });
      setTotalStock(totals);
      setStock(availables);
    }
  };

  const fetchMyRequests = async () => {
    if (!selectedProfessorId) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('teacher_requests')
      .select('*')
      .eq('professor_id', selectedProfessorId)
      .order('scheduled_date', { ascending: false });
    if (data) setMyRequests(data);
    setIsLoading(false);
  };

  const filteredMyRequests = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (managementFilter === 'all') return myRequests;
    if (managementFilter === 'future') return myRequests.filter(r => r.scheduled_date >= todayStr);
    return myRequests.filter(r => r.scheduled_date < todayStr);
  }, [myRequests, managementFilter]);

  const handleEditRequest = (req: any) => {
    setEditingRequestId(req.id);
    setRequestedItems(req.requested_items || { notebook: 0, mouse: 0, charger: 0, headphones: 0, kit: 0 });
    setScheduledDate(req.scheduled_date);
    setStartTime(req.start_time);
    setReturnDeadline(req.return_deadline || '');
    setDestination(req.destination);
    setObservations(req.observations || '');
    setView('form');
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Deseja realmente cancelar esta reserva?')) return;
    setIsLoading(true);
    const { error } = await supabase.from('teacher_requests').delete().eq('id', id);
    if (!error) { fetchMyRequests(); fetchAvailability(); }
    setIsLoading(false);
  };

  // Compute availability per shift considering reservations for the chosen date
  const shiftAvailability = useMemo(() => {
    const types = ['notebook', 'mesa', 'mouse', 'charger', 'headphones', 'kit'];
    const result: Record<string, { morning: number; afternoon: number; total: number; currentAvailable: number }> = {};
    types.forEach(type => {
      if (type === 'kit') return;
      const typeTotal = totalStock[type] || 0;
      const currentAvailable = stock[type] || 0;
      let morningReserved = 0, afternoonReserved = 0;
      dayRequests.forEach(req => {
        if (editingRequestId && req.id === editingRequestId) return;
        const reqShift = getShiftFromTime(req.start_time);
        const itemQty = req.requested_items?.[type] || 0;
        if (reqShift === 'morning') morningReserved += itemQty;
        else if (reqShift === 'afternoon') afternoonReserved += itemQty;
        else { morningReserved += itemQty; afternoonReserved += itemQty; }
      });
      result[type] = {
        morning: Math.max(0, currentAvailable - morningReserved),
        afternoon: Math.max(0, currentAvailable - afternoonReserved),
        total: typeTotal,
        currentAvailable
      };
    });
    const kitTypes = ['notebook', 'mouse', 'charger', 'headphones', 'mesa'];
    result['kit'] = {
      morning: Math.min(...kitTypes.map(t => result[t]?.morning || 0)),
      afternoon: Math.min(...kitTypes.map(t => result[t]?.afternoon || 0)),
      total: Math.min(...kitTypes.map(t => result[t]?.total || 0)),
      currentAvailable: Math.min(...kitTypes.map(t => result[t]?.currentAvailable || 0))
    };
    return result;
  }, [totalStock, stock, dayRequests, editingRequestId]);

  const getEffectiveAvailable = (type: string): number => {
    const avail = shiftAvailability[type];
    if (!avail) return stock[type] || 0;
    const shift = getShiftFromTime(startTime);
    if (shift === 'morning') return avail.morning;
    if (shift === 'afternoon') return avail.afternoon;
    return avail.currentAvailable;
  };

  const validateToken = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'active_request_token').single();
      setIsValidToken(data?.value?.token === token);
    } catch (err) { setIsValidToken(false); }
    finally { setIsCheckingToken(false); }
  };

  const fetchProfessors = async () => {
    const { data } = await supabase.from('professors').select('id, name, type, phone, pin').in('type', ['professor', 'collaborator']).order('name');
    if (data) setProfessors(data);
  };

  const handleProfessorSelect = (id: string) => {
    setSelectedProfessorId(id);
    setIsVerified(false);
    setPinInput('');
    setView('selection');
    setEditingRequestId(null);
    const prof = professors.find(p => p.id === id);
    if (prof) {
      setPhoneInput(prof.phone || '');
      setProfessorSearch(prof.name);
    }
    setIsProfessorDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessorId) { setError('Selecione seu nome.'); return; }
    const hasItems = Object.values(requestedItems).some(q => (Number(q)) > 0);
    if (!hasItems) { setError('Selecione pelo menos um item.'); return; }
    if (!startTime) { setError('Defina o horário de retirada.'); return; }
    if (!destination.trim()) { setError('Informe o destino.'); return; }

    // 24h Restriction Check
    const scheduledDateTime = new Date(`${scheduledDate}T${startTime}`);
    const now = new Date();
    const diffInHours = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      setError('Agendamentos com menos de 24 hrs de antecedência precisam ser feitos na monitoria pois precisa ser verificado a disponibilidade');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const payload = {
      professor_id: selectedProfessorId,
      requested_items: requestedItems,
      scheduled_date: scheduledDate,
      start_time: startTime,
      return_deadline: returnDeadline || null,
      destination: destination,
      observations: observations || null,
      status: editingRequestId ? undefined : 'pending'
    };

    try {
      const query = editingRequestId ? supabase.from('teacher_requests').update(payload).eq('id', editingRequestId) : supabase.from('teacher_requests').insert(payload);
      const { error: dbError } = await query;
      if (dbError) throw dbError;
      const prof = professors.find(p => p.id === selectedProfessorId);
      if (prof && !prof.pin) await supabase.from('professors').update({ phone: phoneInput, pin: pinInput }).eq('id', selectedProfessorId);
      setIsSuccess(true);
    } catch (err: any) { setError('Erro ao processar: ' + err.message); }
    finally { setIsLoading(false); }
  };

  if (isCheckingToken) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="size-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  if (isValidToken === false) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-10 shadow-2xl border border-slate-700"><div className="size-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500"><AlertCircle size={40} /></div><h2 className="text-2xl font-black mb-2">Acesso Expirado</h2></motion.div></div>;
  }

  if (isSuccess) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center"><motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-10 shadow-2xl border border-slate-700"><div className="size-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500"><CheckCircle2 size={48} /></div><h2 className="text-3xl font-black mb-4">Sucesso!</h2><button onClick={() => window.location.reload()} className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-lg">Voltar para o Início</button></motion.div></div>;
  }

  const currentShift = getShiftFromTime(startTime);
  const filteredProfessors = professors.filter(p => p.name.toLowerCase().includes(professorSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-10">
      <div className="p-6 md:p-8 pt-10 md:pt-12 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 italic">Monitoria SESI</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal de Solicitações</p>
      </div>

      <div className="max-w-md mx-auto px-4 md:px-6 space-y-6 md:space-y-8">
        {/* Searchable Professor Selection */}
        <section className="space-y-4 relative" ref={dropdownRef}>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <User size={14} className="text-blue-500" />
            Professor / Colaborador
          </label>
          <div className="relative">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"><Search size={20}/></div>
            <input 
              type="text"
              placeholder="Digite seu nome..."
              value={professorSearch}
              onChange={(e) => {
                setProfessorSearch(e.target.value);
                setIsProfessorDropdownOpen(true);
                if (selectedProfessorId) setSelectedProfessorId('');
              }}
              onFocus={() => setIsProfessorDropdownOpen(true)}
              className="w-full h-16 pl-14 pr-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200"
            />
            
            {/* Custom Dropdown */}
            <AnimatePresence>
              {isProfessorDropdownOpen && professorSearch.length > 1 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 top-20 inset-x-0 bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto scrollbar-hide py-2"
                >
                  {filteredProfessors.length > 0 ? (
                    filteredProfessors.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => handleProfessorSelect(p.id)}
                        className="w-full px-6 py-3 text-left hover:bg-blue-600/20 text-slate-200 font-bold border-b border-white/5 last:border-0 transition-colors flex items-center justify-between group"
                      >
                        {p.name}
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-blue-400"/>
                      </button>
                    ))
                  ) : (
                    <div className="px-6 py-4 text-slate-500 font-bold italic text-sm">Nenhum nome encontrado...</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {selectedProfessorId && (
             <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest pl-2">
                <CheckCircle2 size={12}/> Professor selecionado
             </motion.div>
          )}
        </section>

        {selectedProfessorId && (
          <AnimatePresence mode="wait">
            {!isVerified && (
              <motion.div key="verification" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="bg-slate-800/80 p-8 rounded-[2rem] border border-blue-500/30 shadow-xl space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500"><Phone size={24} /></div>
                    <div><h2 className="text-xl font-bold">Verificação</h2><p className="text-xs text-blue-400 uppercase font-black">PIN de Segurança</p></div>
                  </div>
                  {(() => {
                    const prof = professors.find(p => p.id === selectedProfessorId);
                    const hasPin = !!prof?.pin;
                    return (
                      <div className="space-y-4">
                        {!hasPin && <div className="space-y-4"><p className="text-sm text-slate-300 font-medium">Parece que é seu primeiro acesso! Digite seu WhatsApp e crie um PIN.</p><input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="(11) 99999-9999" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500 outline-none font-bold text-lg" /></div>}
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-blue-400 uppercase tracking-widest">{hasPin ? 'Sua Senha (PIN)' : 'Crie seu PIN (4 dígitos)'}</label>
                          <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="****" maxLength={4} className="w-full text-center tracking-[1.5em] font-mono text-3xl bg-slate-900 border-2 border-slate-700 text-white rounded-2xl p-6 focus:border-emerald-500 outline-none" />
                        </div>
                        {error && <div className="text-rose-400 text-[10px] font-black uppercase text-center">{error}</div>}
                        <button type="button" onClick={() => {
                          const prof = professors.find(p => p.id === selectedProfessorId);
                          if (!prof?.pin) { if (pinInput.length === 4 && phoneInput.length >= 10) { setIsVerified(true); setError(null); } else { setError("Dados incompletos."); } }
                          else { if (pinInput === prof.pin) { setIsVerified(true); setError(null); } else { setError("PIN Incorreto."); } }
                        }} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-lg transition-all active:scale-95 group">
                          {hasPin ? 'ENTRAR' : 'CADASTRAR E CONTINUAR'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}

            {isVerified && view === 'selection' && (
              <motion.div key="selection" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <button onClick={() => { setEditingRequestId(null); setView('form'); }} className="w-full p-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] text-left border border-white/10 shadow-2xl relative overflow-hidden group">
                  <div className="relative z-10"><h3 className="text-2xl font-black tracking-tight">Nova Reserva</h3><p className="text-blue-200 text-sm font-medium mt-1">Solicitar equipamentos</p></div>
                  <Plus size={100} className="absolute -right-4 -bottom-4 text-white/5 opacity-40" />
                </button>
                <button onClick={() => { setView('management'); fetchMyRequests(); }} className="w-full p-8 bg-slate-800 rounded-[2.5rem] text-left border border-slate-700 shadow-xl relative overflow-hidden group">
                  <div className="relative z-10"><h3 className="text-2xl font-black tracking-tight">Meus Agendamentos</h3><p className="text-slate-400 text-sm font-medium mt-1">Histórico e edições</p></div>
                  <History size={100} className="absolute -right-4 -bottom-4 text-slate-700/20" />
                </button>
              </motion.div>
            )}

            {isVerified && view === 'management' && (
              <motion.div key="management" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <button onClick={() => setView('selection')} className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest"><ChevronLeft size={16} /> Voltar</button>
                  <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5">
                    {(['future', 'past', 'all'] as const).map(f => (
                      <button 
                        key={f} 
                        onClick={() => setManagementFilter(f)}
                        className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", managementFilter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300')}
                      >
                        {f === 'future' ? 'Próximos' : f === 'past' ? 'Passados' : 'Tudo'}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoading ? <div className="flex justify-center py-20"><div className="size-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div> : 
                  filteredMyRequests.length === 0 ? <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700"><p className="text-slate-500 font-bold">Sem reservas {managementFilter === 'future' ? 'programadas' : 'no histórico'}.</p></div> : 
                  <div className="space-y-4">
                    {filteredMyRequests.map((req: any) => {
                      const dt = new Date(req.scheduled_date + 'T12:00:00');
                      const items = Object.entries(req.requested_items || {}).filter(([_, q]) => (Number(q)) > 0);
                      const isPast = new Date(req.scheduled_date) < new Date(new Date().toISOString().split('T')[0]);
                      return (
                        <div key={req.id} className={cn("p-5 rounded-3xl bg-slate-800 border-2 transition-all", isPast ? "opacity-60 border-transparent bg-slate-900/50" : "border-slate-700 shadow-lg")}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{dt.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                               <h4 className="text-lg font-black">{dt.toLocaleDateString('pt-BR')} <span className="text-slate-500 font-bold ml-1">{req.start_time} {req.return_deadline ? `→ ${req.return_deadline}` : ''}</span></h4>
                               <div className={cn("px-2.5 py-1 rounded-xl text-[8px] font-black uppercase", req.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-700 text-slate-500')}>{req.status}</div>
                            </div>
                          </div>
                          
                          {req.created_at && (
                            <div className="flex items-center gap-2 mb-3 text-slate-500 text-[9px] font-bold italic">
                              <Clock size={10} />
                              <span>Solicitado em: {formatDate(req.created_at)} às {formatTime(req.created_at)}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mb-4">
                            {items.map(([key, qty]) => (
                              <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-lg text-xs font-bold text-slate-300 border border-slate-700/30">
                                <span>{qty} {key}</span>
                              </div>
                            ))}
                          </div>
                          
                          {req.observations && (
                            <div className="mb-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Observações</p>
                              <p className="text-xs text-slate-400 leading-relaxed font-medium">{req.observations}</p>
                            </div>
                          )}

                          {!isPast && (req.status === 'pending' || req.status === 'approved') && <div className="flex gap-2 pt-4 border-t border-white/5"><button onClick={() => handleEditRequest(req)} className="flex-1 py-3 bg-blue-600/10 text-blue-400 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-600/20"><Edit2 size={12}/> Editar</button><button onClick={() => handleDeleteRequest(req.id)} className="flex-1 py-3 bg-rose-500/10 text-rose-400 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-rose-500/20"><Trash2 size={12}/> Cancelar</button></div>}
                        </div>
                      );
                    })}
                  </div>
                }
              </motion.div>
            )}

            {isVerified && view === 'form' && (
              <motion.form key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setView('selection')} className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest"><ChevronLeft size={16} /> Voltar</button>
                  <h3 className="font-black text-sm uppercase tracking-[0.2em] text-emerald-400">{editingRequestId ? 'Editar Reserva' : 'Nova Reserva'}</h3>
                </div>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</label><input type="date" required min={new Date().toISOString().split('T')[0]} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full h-14 px-4 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-200 [color-scheme:dark]" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retirada</label><input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full h-14 px-4 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-200 [color-scheme:dark]" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-amber-500/70">Devolução</label><input type="time" value={returnDeadline} onChange={(e) => setReturnDeadline(e.target.value)} className="w-full h-14 px-4 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-amber-500/30 outline-none font-bold text-slate-200 [color-scheme:dark]" /></div>
                </section>

                <motion.div className="bg-slate-800/50 border border-white/5 rounded-3xl p-4 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-4"><Package size={16} className="text-blue-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Estoque disponível</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    {EQUIPMENT_TYPES.filter(t => t.id !== 'kit').map(item => {
                      const avail = shiftAvailability[item.id], eff = getEffectiveAvailable(item.id);
                      return (<div key={item.id} className="bg-slate-900/40 p-2.5 rounded-xl border border-white/[0.03]"><div className="flex justify-between items-center mb-1"><span className="text-[8px] font-black text-slate-500 uppercase">{item.label}</span><span className={cn("text-xs font-black tabular-nums", eff <= 0 ? 'text-rose-400' : 'text-emerald-400')}>{eff}</span></div><AvailabilityBar morningAvailable={avail?.morning || 0} afternoonAvailable={avail?.afternoon || 0} total={avail?.total || 0} available={eff} shift={currentShift} /></div>);
                    })}
                  </div>
                </motion.div>

                <section className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Destino</label><input type="text" placeholder="Ex: Sala 05, Lab A..." value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full h-14 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-bold italic" /></section>

                <section className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observações / Descrição</label>
                  <textarea 
                    placeholder="Detalhes sobre a solicitação (opcional)..." 
                    value={observations} 
                    onChange={(e) => setObservations(e.target.value)} 
                    className="w-full min-h-[100px] p-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-medium text-slate-200 resize-none"
                  />
                </section>

                <section className="space-y-3">
                  {EQUIPMENT_TYPES.map(item => {
                    const eff = getEffectiveAvailable(item.id), isOut = (shiftAvailability[item.id]?.total || 0) > 0 && eff <= 0 && requestedItems[item.id] <= 0;
                    return (
                      <div key={item.id} className={cn("p-4 rounded-3xl border-2 transition-all flex items-center justify-between", requestedItems[item.id] > 0 ? "bg-slate-800 border-blue-500/40 shadow-lg" : "bg-slate-800/40 border-slate-700/50")}>
                        <div className="flex items-center gap-3"><div className={cn("size-10 rounded-xl flex items-center justify-center", item.color)}><item.icon size={18} /></div><div><h4 className="font-bold text-sm text-slate-300">{item.label}</h4><span className={cn("text-[9px] font-black uppercase", eff <= 5 ? "text-amber-500" : "text-emerald-500")}>{isOut ? 'Esgotado' : `${eff} disp.`}</span></div></div>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/5">
                          <button type="button" onClick={() => setRequestedItems(p => ({...p, [item.id]: Math.max(0, p[item.id]-1)}))} className="size-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"><Minus size={14}/></button>
                          <input 
                            type="number" 
                            className="w-10 bg-transparent text-center font-black text-lg text-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={requestedItems[item.id] === 0 ? '' : requestedItems[item.id]}
                            onChange={(e) => {
                                const val = parseInt(e.target.value || '0');
                                const limit = eff + (requestedItems[item.id] || 0);
                                setRequestedItems(p => ({...p, [item.id]: Math.min(Math.max(0, val), limit)}));
                            }}
                            placeholder="0"
                          />
                          <button type="button" onClick={() => { const limit = eff + (requestedItems[item.id] || 0); setRequestedItems(p => ({...p, [item.id]: Math.min(p[item.id]+1, eff > 0 ? p[item.id]+1 : p[item.id])})); }} className="size-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-blue-400 transition-colors"><Plus size={14}/></button>
                        </div>
                      </div>
                    );
                  })}
                </section>

                <button type="submit" disabled={isLoading} className="w-full h-20 bg-blue-600 hover:bg-blue-500 rounded-[2rem] flex items-center justify-center gap-4 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 group">
                  {isLoading ? <div className="size-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : <><span className="text-xl font-black italic tracking-tighter">{editingRequestId ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR RESERVA'}</span><Send size={20}/></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
