import React, { useEffect, useState } from 'react';
import { 
  Laptop, 
  Handshake, 
  AlertTriangle, 
  ArrowRightLeft,
  Plus,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { Product, Loan, Notebook } from '../types';
import { cn, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [pRes, lRes, nRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('loans').select('*, loan_items(notebook_code)'),
        supabase.from('notebooks').select('*')
      ]);

      if (pRes.data) {
        setProducts(pRes.data.map(p => ({
          ...p,
          minQuantity: p.min_quantity
        })));
      }

      if (lRes.data) {
        setLoans(lRes.data.map(l => ({
          ...l,
          beneficiaryId: l.beneficiary_id,
          loanDate: l.loan_date,
          returnDate: l.return_date,
          operatorId: l.operator_id,
          operatorName: l.operator_name,
          items: l.loan_items.map((item: any) => item.notebook_code)
        })));
      }

      if (nRes.data) {
        setNotebooks(nRes.data);
      }
    };
    fetchData();
  }, []);

  const availableNotebooks = notebooks.filter(n => n.status === 'available').length;
  const loanedNotebooks = notebooks.filter(n => n.status === 'loaned').length;
  const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity).length;
  const recentMovements = 28; // Mocked for now

  const stats = [
    { 
      label: 'Equipamentos Disponíveis', 
      value: availableNotebooks, 
      icon: Laptop, 
      color: 'bg-sesi-blue/10 text-sesi-blue',
      trend: '+2%',
      trendUp: true
    },
    { 
      label: 'Equipamentos Emprestados', 
      value: loanedNotebooks, 
      icon: Handshake, 
      color: 'bg-sesi-yellow/10 text-sesi-yellow',
      trend: '-1%',
      trendUp: false
    },
    { 
      label: 'Estoque Baixo', 
      value: lowStockProducts, 
      icon: AlertTriangle, 
      color: 'bg-orange-100 text-orange-600',
      trend: '+12%',
      trendUp: true
    },
    { 
      label: 'Movimentações Recentes', 
      value: recentMovements, 
      icon: ArrowRightLeft, 
      color: 'bg-slate-100 text-slate-600',
      trend: '-5%',
      trendUp: false
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm mt-1">Bem-vindo de volta! Aqui está o resumo do inventário hoje.</p>
        </div>
        <button className="flex items-center gap-2 bg-sesi-yellow px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20 text-slate-900">
          <Plus size={18} />
          Novo Registro
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl transition-colors", stat.color)}>
                <stat.icon size={24} />
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1",
                stat.trendUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
              )}>
                {stat.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.trend}
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value.toString().padStart(2, '0')}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Loans Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black text-slate-900">Empréstimos Ativos</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Acompanhamento em tempo real das saídas.</p>
          </div>
          <button className="bg-sesi-blue/10 text-sesi-blue px-4 py-2 rounded-xl text-xs font-black hover:bg-sesi-blue/20 transition-all">
            Ver todos
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Beneficiário</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Equipamentos</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Horário</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.filter(l => l.status === 'active').slice(0, 5).map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-2xl bg-sesi-blue/10 flex items-center justify-center text-sesi-blue font-black text-xs">
                        {(loan.beneficiaryName || 'U').split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{loan.beneficiaryName || 'N/A'}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{loan.operatorName || 'Sistema'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-1.5">
                      {(loan.items || []).slice(0, 3).map(item => (
                        <span key={item} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black font-mono border border-slate-200">
                          {item}
                        </span>
                      ))}
                      {(loan.items || []).length > 3 && (
                        <span className="px-2 py-1 bg-sesi-yellow/20 text-sesi-yellow rounded-lg text-[10px] font-black border border-sesi-yellow/30">
                          +{(loan.items || []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-600">{loan.loanDate ? new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                      <span className="text-[10px] font-bold text-slate-400">{loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('pt-BR') : '--/--/--'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      EM USO
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sesi-blue transition-all">
                      <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                  </td>
                </tr>
              ))}
              {loans.filter(l => l.status === 'active').length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400 text-sm font-medium italic">
                    <div className="flex flex-col items-center gap-2">
                      <Laptop size={32} className="opacity-20" />
                      Nenhum notebook em uso no momento.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
