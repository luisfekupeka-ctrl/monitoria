import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Laptop, 
  Mouse, 
  Zap, 
  Headphones, 
  Clock, 
  Calendar, 
  User, 
  ChevronRight, 
  CheckCircle2,
  Minus,
  Plus,
  Send,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface EquipmentItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

const EQUIPMENT_TYPES: EquipmentItem[] = [
  { id: 'notebook', name: 'Notebooks', icon: <Laptop size={24} />, color: 'bg-blue-500' },
  { id: 'mouse', name: 'Mouses', icon: <Mouse size={24} />, color: 'bg-teal-500' },
  { id: 'charger', name: 'Carregadores', icon: <Zap size={24} />, color: 'bg-amber-500' },
  { id: 'headphones', name: 'Fones', icon: <Headphones size={24} />, color: 'bg-purple-500' },
];

export function TeacherRequest() {
  const [professors, setProfessors] = useState<{ id: string, name: string }[]>([]);
  const [selectedProfessorId, setSelectedProfessorId] = useState('');
  const [requestedItems, setRequestedItems] = useState<Record<string, number>>({
    notebook: 0,
    mouse: 0,
    charger: 0,
    headphones: 0
  });
  const [startTime, setStartTime] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  useEffect(() => {
    validateToken();
    fetchProfessors();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'active_request_token')
        .single();

      if (fetchError) throw fetchError;
      
      const activeToken = data?.value?.token;
      setIsValidToken(activeToken === token);
    } catch (err) {
      console.error('Error validating token:', err);
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

  const updateQuantity = (id: string, delta: number) => {
    setRequestedItems(prev => ({
      ...prev,
      [id]: Math.max(0, prev[id] + delta)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfessorId) {
      setError('Por favor, selecione o seu nome.');
      return;
    }

    const hasItems = Object.values(requestedItems as Record<string, number>).some((q: number) => q > 0);
    if (!hasItems) {
      setError('Selecione pelo menos um equipamento.');
      return;
    }

    if (!startTime) {
      setError('Defina o horário de retirada.');
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
          scheduled_date: new Date().toISOString().split('T')[0],
          start_time: startTime,
          return_deadline: returnDeadline || null,
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

  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="size-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-10 shadow-2xl border border-slate-700"
        >
          <div className="size-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black mb-4 tracking-tight text-white">Acesso Expirado</h2>
          <p className="text-slate-400 font-medium mb-8 leading-relaxed">
            Este QR Code não é mais válido ou foi desativado pela monitoria. 
            Peça ao monitor para gerar um novo QR Code.
          </p>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-700 pt-8">
            SESI MONITORIA • PORTAL SEGURO
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
      {/* Header */}
      <div className="p-8 pt-12 text-center">
        <h1 className="text-4xl font-black tracking-tight mb-2">Solicitar Kit</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal do Professor • SESI Monitoria</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-6 space-y-8">
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

        {/* Equipment Selection */}
        <section className="space-y-4">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Laptop size={14} className="text-blue-500" />
            O que você precisa?
          </label>
          <div className="grid grid-cols-1 gap-4">
            {EQUIPMENT_TYPES.map(item => (
              <div 
                key={item.id}
                className={cn(
                  "p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between",
                  requestedItems[item.id] > 0 
                    ? "bg-slate-800 border-blue-500/50 ring-4 ring-blue-500/5" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white", item.color)}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">{item.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unidades</p>
                  </div>
                </div>

                  <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-inner">
                    <button
                      onClick={() => setRequestedItems(prev => ({
                        ...prev,
                        [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                      }))}
                      className="size-10 bg-white text-slate-900 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all border border-slate-100 shadow-sm active:scale-90"
                    >
                      <Minus size={20} />
                    </button>
                    
                    <input 
                      type="number"
                      value={requestedItems[item.id] || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRequestedItems(prev => ({
                          ...prev,
                          [item.id]: isNaN(val) ? 0 : Math.max(0, val)
                        }));
                      }}
                      className="w-16 bg-transparent text-center font-black text-xl text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <button
                      onClick={() => setRequestedItems(prev => ({
                        ...prev,
                        [item.id]: (prev[item.id] || 0) + 1
                      }))}
                      className="size-10 bg-sesi-blue text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-90"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule */}
        <section className="grid grid-cols-2 gap-6">
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
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              Devolução
            </label>
            <input 
              type="time" 
              value={returnDeadline}
              onChange={(e) => setReturnDeadline(e.target.value)}
              className="w-full h-16 px-6 bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-amber-500/50 outline-none transition-all font-bold text-slate-200"
            />
          </div>
        </section>

        {/* Feedback / Submit */}
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
