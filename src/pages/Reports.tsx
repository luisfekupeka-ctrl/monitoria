import React, { useState, useEffect } from 'react';
import { 
  BarChart4, 
  FileDown, 
  Calendar,
  TrendingUp,
  Package,
  Laptop,
  ArrowRightLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Loan, StockMovement } from '../types';
import { formatDate, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Reports() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [pRes, lRes, mRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('loans').select('*, loan_items(notebook_code)'),
        supabase.from('stock_movements').select('*')
      ]);

      if (pRes.data) setProducts(pRes.data.map(p => ({
        ...p,
        minQuantity: p.min_quantity
      })));

      if (lRes.data) {
        setLoans(lRes.data.map(l => ({
          ...l,
          beneficiaryId: l.beneficiary_id,
          loanDate: l.loan_date,
          returnDate: l.return_date,
          operatorId: l.operator_id,
          operatorName: l.operator_name || 'Monitor',
          items: Array.isArray(l.loan_items) ? l.loan_items.map((item: any) => item.notebook_code) : []
        })));
      }

      if (mRes.data) {
        setMovements(mRes.data.map(m => ({
          ...m,
          productName: m.product_name,
          productId: m.product_id,
          operatorName: m.operator_name,
          beneficiaryName: m.beneficiary_name
        })));
      }
    };
    fetchData();
  }, []);

  const exportStockReport = () => {
    try {
      const doc = new jsPDF();
      doc.text("Relatório de Estoque Atual", 14, 15);
      autoTable(doc, {
        head: [['Produto', 'Categoria', 'Qtd', 'Mínima', 'Status']],
        body: products.map(p => [
          p.name, 
          p.category, 
          p.quantity, 
          p.minQuantity,
          (p.quantity ?? 0) <= (p.minQuantity ?? 0) ? 'CRÍTICO' : 'NORMAL'
        ]),
        startY: 20,
      });
      doc.save("relatorio_estoque.pdf");
    } catch (error) {
      console.error('Erro ao exportar PDF de estoque:', error);
      alert('Não foi possível gerar o PDF de estoque. Tente novamente.');
    }
  };

  const exportStockExcel = () => {
    try {
      const data = products.map(p => ({
        'Produto': p.name,
        'Categoria': p.category,
        'Quantidade': p.quantity,
        'Mínima': p.minQuantity,
        'Status': (p.quantity ?? 0) <= (p.minQuantity ?? 0) ? 'CRÍTICO' : 'NORMAL'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Estoque");
      XLSX.writeFile(wb, "relatorio_estoque.xlsx");
    } catch (error) {
      console.error('Erro ao exportar Excel de estoque:', error);
      alert('Não foi possível gerar a planilha de estoque.');
    }
  };

  const exportLoanHistory = () => {
    try {
      const doc = new jsPDF();
      doc.text("Histórico de Empréstimos", 14, 15);
      autoTable(doc, {
        head: [['Beneficiário', 'Itens', 'Data Empréstimo', 'Status']],
        body: loans.map(l => [
          l.beneficiaryName || 'N/A', 
          (l.items || []).join(', '), 
          l.loanDate ? formatDate(l.loanDate) : '--/--/--',
          l.status === 'active' ? 'ATIVO' : 'DEVOLVIDO'
        ]),
        startY: 20,
      });
      doc.save("historico_emprestimos.pdf");
    } catch (error) {
      console.error('Erro ao exportar PDF de empréstimos:', error);
      alert('Erro ao gerar PDF de empréstimos.');
    }
  };

  const exportLoansExcel = () => {
    try {
      const data = loans.map(l => ({
        'Beneficiário': l.beneficiaryName || 'N/A',
        'Equipamentos': (l.items || []).join(', '),
        'Data Empréstimo': l.loanDate ? formatDate(l.loanDate) : '',
        'Operador': l.operatorName || 'Sistema',
        'Status': l.status === 'active' ? 'ATIVO' : 'DEVOLVIDO'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Empréstimos");
      XLSX.writeFile(wb, "historico_emprestimos.xlsx");
    } catch (error) {
      console.error('Erro ao exportar Excel de empréstimos:', error);
      alert('Erro ao gerar a planilha de empréstimos.');
    }
  };

  const exportDailyMovement = () => {
    try {
      const doc = new jsPDF();
      doc.text("Movimentação Diária - " + formatDate(new Date().toISOString()), 14, 15);
      
      const last24h = movements.filter(m => {
        const movDate = new Date(m.date);
        const dayAgo = new Date();
        dayAgo.setHours(dayAgo.getHours() - 24);
        return movDate >= dayAgo;
      });

      autoTable(doc, {
        head: [['Produto', 'Tipo', 'Qtd', 'Origem/Destino', 'Operador']],
        body: last24h.map(m => [
          m.productName,
          m.type === 'in' ? 'ENTRADA' : 'SAÍDA',
          m.quantity,
          m.beneficiaryName || '-',
          m.operatorName
        ]),
        startY: 20,
      });
      doc.save("movimentacao_diaria.pdf");
    } catch (error) {
      console.error('Erro ao exportar relatório diário:', error);
      alert('Erro ao gerar relatório diário.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Relatórios e Indicadores</h2>
        <p className="text-slate-500 mt-1">Gere documentos oficiais e analise o histórico de movimentações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock Report Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <div className="size-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <Package size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Relatório de Estoque</h3>
          <p className="text-slate-500 text-sm mb-8">Lista completa de produtos, quantidades atuais e alertas de reposição.</p>
          <div className="flex gap-3">
            <button 
              onClick={exportStockReport}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
            >
              <FileDown size={18} />
              PDF
            </button>
            <button 
              onClick={exportStockExcel}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all font-sans"
            >
              <FileDown size={18} />
              Excel
            </button>
          </div>
        </motion.div>

        {/* Loan History Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <div className="size-14 bg-sesi-blue/10 text-sesi-blue rounded-2xl flex items-center justify-center mb-6">
            <Laptop size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Histórico de Empréstimos</h3>
          <p className="text-slate-500 text-sm mb-8">Registro detalhado de todas as saídas e entradas de equipamentos por usuário.</p>
          <div className="flex gap-3">
            <button 
              onClick={exportLoanHistory}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
            >
              <FileDown size={18} />
              PDF
            </button>
            <button 
              onClick={exportLoansExcel}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all font-sans"
            >
              <FileDown size={18} />
              Excel
            </button>
          </div>
        </motion.div>

        {/* Movement Report Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <div className="size-14 bg-sesi-yellow/10 text-sesi-yellow rounded-2xl flex items-center justify-center mb-6">
            <ArrowRightLeft size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Movimentação Diária</h3>
          <p className="text-slate-500 text-sm mb-8">Resumo de entradas e saídas de produtos nas últimas 24 horas.</p>
          <button 
            onClick={exportDailyMovement}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
          >
            <FileDown size={18} />
            Gerar Relatório Diário
          </button>
        </motion.div>

        {/* Custom Report Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <div className="size-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-6">
            <Calendar size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Relatório por Período</h3>
          <p className="text-slate-500 text-sm mb-8">Selecione um intervalo de datas para gerar um relatório personalizado.</p>
          <button className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 py-3 rounded-xl font-bold text-sm cursor-not-allowed">
            Em breve
          </button>
        </motion.div>
      </div>

      {/* Loan History Visualization */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black text-slate-900">Histórico de Movimentações</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Visualização rápida dos últimos empréstimos e devoluções.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
              <div className="size-1.5 bg-emerald-500 rounded-full" />
              {loans.filter(l => l.status === 'active').length} ATIVOS
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Beneficiário</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Equipamentos</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.slice().reverse().slice(0, 10).map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="text-sm font-black text-slate-900">{loan.beneficiaryName}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-1">
                      {loan.items.map(item => (
                        <span key={item} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold font-mono border border-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-600">{formatDate(loan.loanDate)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(loan.loanDate).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {loan.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        ATIVO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                        DEVOLVIDO
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-slate-500">{loan.operatorName}</span>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                    Nenhuma movimentação registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Stock Movement History */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black text-slate-900">Histórico de Estoque</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Registro de entradas e saídas de produtos de consumo.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-sesi-yellow/10 text-sesi-yellow rounded-full text-[10px] font-black border border-sesi-yellow/20">
              <ArrowRightLeft size={10} />
              {movements.length} MOVIMENTAÇÕES
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Produto</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Qtd</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Destino/Origem</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.slice().reverse().slice(0, 10).map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="text-sm font-black text-slate-900">{mov.productName}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border",
                      mov.type === 'in' 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-orange-50 text-orange-600 border-orange-100"
                    )}>
                      {mov.type === 'in' ? 'ENTRADA' : 'SAÍDA'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-slate-700">{mov.quantity}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-medium text-slate-600">{mov.beneficiaryName || '-'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-600">{formatDate(mov.date)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(mov.date).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-slate-500">{mov.operatorName}</span>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                    Nenhuma movimentação de estoque registrada.
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
