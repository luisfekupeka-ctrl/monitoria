import React, { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface EquipmentItem {
  id: string;
  label: string;
  icon: any;
  color: string;
}

const EQUIPMENT_TYPES: EquipmentItem[] = [
  { id: 'notebook', label: 'Notebooks', icon: Laptop, color: 'bg-blue-500' },
  { id: 'mouse', label: 'Mouses', icon: Mouse, color: 'bg-amber-500' },
  { id: 'charger', label: 'Carregadores', icon: Zap, color: 'bg-emerald-500' },
  { id: 'headphones', label: 'Fones', icon: Headphones, color: 'bg-purple-500' },
  { id: 'kit', label: 'Kit Completo', icon: CheckCircle2, color: 'bg-indigo-500' }
];

export default function TeacherRequest() {
  const [professors, setProfessors] = useState<{ id: string, name: string }[]>([]);
  const [selectedProfessorId, setSelectedProfessorId] = useState('');
  const [requestedItems, setRequestedItems] = useState<Record<string, number>>({
    notebook: 0,
    mouse: 0,
    charger: 0,
    headphones: 0,
    kit: 0
  });
  const [stock, setStock] = useState<Record<string, number>>({});
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
    fetchStock();
  }, [token]);

  const fetchStock = async () => {
    const { data } = await supabase.from('products').select('name, quantity');
    if (data) {
      const stockMap: Record<string, number> = {};
      data.forEach(item => {
        const name = item.name.toLowerCase();
        if (name.includes('notebook')) stockMap.notebook = item.quantity;
        if (name.includes('mouse')) stockMap.mouse = item.quantity;
        if (name.includes('carregador')) stockMap.charger = item.quantity;
        if (name.includes('fone')) stockMap.headphones = item.quantity;
        if (name.includes('kit')) stockMap.kit = item.quantity;
      });
      setStock(stockMap);
    }
  };

  const validateToken = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'active_request_token')
        .single();

      if (fetchError) throw fetchError;
      
      setIsValidToken(data?.value?.token === token);
    } catch (err) {
      console.error('Token validation error:', err);
      setIsValidToken(false);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const fetchProfessors = async () => {
    const { data } = await supabase
      .from('professors')
      .select('id, name, type')
      .neq('type', 'local')
      .order('name');
    if (data) setProfessors(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessorId) {
      setError('Por favor, selecione o seu nome.');
      return;
    }

    const hasItems = Object.values(requestedItems).some(q => q > 0);
    if (!hasItems) {
      setError('Selecione pelo menos um item.');
      return;
    }

    if (!startTime) {
      setError('Defina o horário de retirada.');
      return;
    }
    if (!destination.trim()) {
      setError('Informe o destino (onde os notebooks serão usados).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('teacher_requests')
        .insert({
          professor_id: selectedProfessorId,
          requested_items: requestedItems,
          scheduled_date: scheduledDate,
          start_time: startTime,
          return_deadline: returnDeadline || null,
          destination: destination,
          observations: observations || null,
          status: 'pending'
        });

      if (insertError) throw insertError;
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao enviar solicitação: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdvanceNoticeOk = () => {
    if (!startTime) return true;
    const now = new Date();
    const scheduled = new Date();
    const [h, m] = startTime.split(':');
    scheduled.setHours(parseInt(h), parseInt(m), 0, 0);
    
    // If scheduled time is earlier today or in the past, it's definitely not 24h notice
    // But since the form only asks for time (not date, assuming today), we check the diff
    const diffHours = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="size-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-10 text-center shadow-2xl border border-slate-700"
        >
          <div className="size-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 ring-8 ring-rose-500/5">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">Acesso Expirado</h2>
          <p className="text-slate-400 font-medium mb-8 leading-relaxed">
            Este QR Code não é mais válido. <br />
            Por favor, solicite um novo acesso à monitoria.
          </p>
          <div className="pt-6 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Monitoria SESI</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-10 text-center shadow-2xl border border-slate-700"
        >
          <div className="size-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 ring-8 ring-emerald-500/5">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-black mb-4 tracking-tight">Solicitado!</h2>
          <p className="text-slate-400 font-medium mb-10 leading-relaxed">
            Sua solicitação foi enviada para a monitoria. <br />
            Preparem-se para as aulas!
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            Fazer outra solicitação
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pb-10">
      <div className="p-6 md:p-8 pt-10 md:pt-12 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Solicitar Kit</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Portal do Professor • SESI Monitoria</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 md:px-6 space-y-6 md:space-y-8">
        {/* Professor Selection */}
        <section className="space-y-4">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <User size={14} className="text-blue-500" />
            Quem está solicitando?
          </label>
          <select 
            value={selectedProfessorId}
            onChange={(e) => setSelectedProfessorId(e.target.value)}
            className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200 appearance-none"
          >
            <option value="">Selecione seu nome</option>
            {professors.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </section>

        {/* Destination Field */}
        <section className="space-y-4">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ChevronRight size={14} className="text-sesi-orange" />
            Destino do Empréstimo
          </label>
          <input 
            type="text"
            placeholder="Ex: Sala 05, Laboratório de Informática..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200 placeholder:text-slate-600"
          />
        </section>

        {/* Equipment Selection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Laptop size={14} className="text-blue-500" />
              O que você precisa?
            </label>
          </div>

          {!isAdvanceNoticeOk() && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl flex gap-3 overflow-hidden"
            >
              <AlertCircle className="text-amber-500 shrink-0" size={18} />
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tight leading-4">
                Solicitação com menos de 24h: Os notebooks irão para análise. 
                Sempre peça com antecedência!
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-2 md:gap-3">
            {EQUIPMENT_TYPES.map(item => (
              <div 
                key={item.id}
                className={cn(
                  "p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all flex items-center justify-between",
                  requestedItems[item.id] > 0 
                    ? "bg-slate-800 border-blue-500/50 ring-4 ring-blue-500/5" 
                    : "bg-slate-800/50 border-slate-700/30"
                )}
              >
                <div className="flex items-center gap-3 md:gap-4 font-sans">
                  <div className={cn("size-10 md:size-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg", item.color)}>
                    <item.icon size={20} className="md:size-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm md:text-base">{item.label}</h4>
                    {stock[item.id] !== undefined && (
                      <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${stock[item.id] <= 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                        {stock[item.id] <= 0 ? 'Sem estoque' : `${stock[item.id]} em estoque`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 bg-slate-900/50 p-1 md:p-1.5 rounded-xl border border-slate-700/50">
                  <button
                    type="button"
                    disabled={stock[item.id] !== undefined && stock[item.id] <= 0}
                    onClick={() => setRequestedItems(prev => ({
                      ...prev,
                      [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                    }))}
                    className="size-8 md:size-10 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-all text-slate-400 disabled:opacity-30 active:scale-90"
                  >
                    <Minus size={16} md:size={20} />
                  </button>
                  
                  <input 
                    type="number"
                    disabled={stock[item.id] !== undefined && stock[item.id] <= 0}
                    value={requestedItems[item.id] === 0 ? '' : requestedItems[item.id]}
                    placeholder="0"
                    onChange={(e) => {
                      const rawVal = e.target.value;
                      if (rawVal === '') {
                        setRequestedItems(prev => ({ ...prev, [item.id]: 0 }));
                        return;
                      }
                      const val = parseInt(rawVal);
                      const finalVal = isNaN(val) ? 0 : Math.max(0, val);
                      const limit = stock[item.id] !== undefined ? stock[item.id] : 999;
                      setRequestedItems(prev => ({
                        ...prev,
                        [item.id]: Math.min(finalVal, limit)
                      }));
                    }}
                    className="w-8 md:w-10 bg-transparent text-center font-black text-base md:text-lg text-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-30 placeholder:text-slate-700"
                  />

                  <button
                    type="button"
                    disabled={stock[item.id] !== undefined && stock[item.id] <= 0}
                    onClick={() => setRequestedItems(prev => ({
                      ...prev,
                      [item.id]: Math.min((prev[item.id] || 0) + 1, stock[item.id] !== undefined ? stock[item.id] : 999)
                    }))}
                    className="size-8 md:size-10 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-all text-blue-400 disabled:opacity-30 active:scale-90"
                  >
                    <Plus size={16} md:size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timing */}
        <section className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              Retirada
            </label>
            <input 
              type="time" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" />
                Data do Agendamento
              </label>
              <input 
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-blue-500" />
                Início do Uso
              </label>
              <input 
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              Devolução Estimada (Opcional)
            </label>
            <input 
              type="time" 
              value={returnDeadline}
              onChange={(e) => setReturnDeadline(e.target.value)}
              className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-amber-500/50 outline-none transition-all font-bold text-slate-200"
            />
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} className="text-slate-400" />
              Observação (Opcional)
            </label>
            <textarea 
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Vou precisar de adaptadores HDMI..."
              rows={2}
              className="w-full p-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-200 resize-none placeholder:text-slate-600"
            />
          </div>
        </section>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 font-bold text-sm"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          type="submit"
          disabled={isLoading}
          className="w-full h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center gap-4 hover:bg-blue-500 transition-all active:scale-95 shadow-xl shadow-blue-500/20 text-white disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <div className="size-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-xl font-black italic tracking-tighter">SOLICITAR AGORA</span>
              <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-12 text-center px-8">
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
          Gerenciamento de Ativos • Sesi Monitoria
        </p>
      </div>
    </div>
  );
}
