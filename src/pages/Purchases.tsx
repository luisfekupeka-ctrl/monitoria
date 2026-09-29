import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  FileDown, 
  Trash2, 
  QrCode, 
  Copy, 
  Check, 
  FileText, 
  Download, 
  Building, 
  User, 
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PurchaseRequest, PurchasePriority, PurchaseItem } from '../types';
import { 
  fetchPurchaseRequests, 
  createPurchaseRequest, 
  updatePurchaseStatus, 
  deletePurchaseRequest, 
  deleteMultiplePurchaseRequests, 
  generatePurchasePDF, 
  generatePurchaseDoc, 
  exportPurchasesToExcel,
  normalizePurchaseRequest
} from '../lib/purchasesService';
import { cn, formatDate, formatTime } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface ManualItemForm {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reference_link: string;
  justification: string;
  estimated_price: string;
  has_technical_specs: boolean;
  technical_specs: string;
}

const DEPARTMENTS = [
  'Coordenação Pedagógica',
  'Robótica / Espaço Maker',
  'Biblioteca',
  'TI / Monitoria',
  'Ensino Fundamental I',
  'Ensino Fundamental II',
  'Ensino Médio',
  'Secretaria / Administrativo',
  'Manutenção / Infraestrutura',
  'Outro Setor'
];

export function Purchases() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRequest | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Manual New Request Form
  const [manualRequester, setManualRequester] = useState(user?.name || 'Administração');
  const [manualDept, setManualDept] = useState('Coordenação Pedagógica');
  const [manualContact, setManualContact] = useState('');
  const [manualPriority, setManualPriority] = useState<PurchasePriority>('normal');
  const [manualItems, setManualItems] = useState<ManualItemForm[]>([
    {
      id: 'it-1',
      name: '',
      quantity: 1,
      unit: 'un',
      reference_link: '',
      justification: '',
      estimated_price: '',
      has_technical_specs: false,
      technical_specs: ''
    }
  ]);

  const publicFormUrl = `${window.location.origin}/compras/solicitar`;

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('purchases-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requests' }, () => {
        loadData();
      })
      .subscribe();

    const interval = setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchPurchaseRequests();
      setPurchases(data);
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRequests(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicFormUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleApprove = async () => {
    if (!selectedPurchase) return;
    try {
      await updatePurchaseStatus(selectedPurchase.id, 'approved', {
        approved_by: user?.name || 'Administrador',
        approval_notes: approvalNotes.trim() || undefined
      });
      setIsApproveModalOpen(false);
      setApprovalNotes('');
      setSelectedPurchase(null);
      await loadData();
    } catch (err: any) {
      alert('Erro ao aprovar: ' + err.message);
    }
  };

  const handleReject = async () => {
    if (!selectedPurchase) return;
    if (!rejectionReason.trim()) {
      alert('Por favor, informe o motivo da reprovação.');
      return;
    }
    try {
      await updatePurchaseStatus(selectedPurchase.id, 'rejected', {
        rejection_reason: rejectionReason.trim()
      });
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setSelectedPurchase(null);
      await loadData();
    } catch (err: any) {
      alert('Erro ao reprovar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja apagar permanentemente esta solicitação?')) return;
    try {
      await deletePurchaseRequest(id);
      await loadData();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleDeleteAllRejected = async () => {
    const rejectedIds = purchases.filter(p => p.status === 'rejected').map(p => p.id);
    if (rejectedIds.length === 0) return;
    if (!confirm(`Deseja apagar permanentemente todas as ${rejectedIds.length} solicitações reprovadas?`)) return;

    try {
      await deleteMultiplePurchaseRequests(rejectedIds);
      await loadData();
    } catch (err: any) {
      alert('Erro ao limpar reprovados: ' + err.message);
    }
  };

  const handleRevertToPending = async (id: string) => {
    try {
      await updatePurchaseStatus(id, 'pending');
      await loadData();
    } catch (err: any) {
      alert('Erro ao reverter: ' + err.message);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualItems.some(it => !it.name.trim() || !it.reference_link.trim() || !it.justification.trim())) {
      alert('Preencha os campos obrigatórios (Item, Link e Justificativa de cada item).');
      return;
    }

    try {
      const items: PurchaseItem[] = manualItems.map(it => {
        let link = it.reference_link.trim();
        if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
        return {
          id: it.id,
          name: it.name.trim(),
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'un',
          reference_link: link,
          justification: it.justification.trim(),
          estimated_price: it.estimated_price ? parseFloat(it.estimated_price.replace(',', '.')) : undefined,
          has_technical_specs: it.has_technical_specs,
          technical_specs: it.has_technical_specs ? it.technical_specs.trim() : undefined
        };
      });

      await createPurchaseRequest({
        requester_name: manualRequester.trim(),
        requester_department: manualDept.trim() || undefined,
        requester_contact: manualContact.trim() || undefined,
        justification: items[0]?.justification || '',
        priority: manualPriority,
        items
      });

      setIsNewModalOpen(false);
      setManualItems([{
        id: 'it-1',
        name: '',
        quantity: 1,
        unit: 'un',
        reference_link: '',
        justification: '',
        estimated_price: '',
        has_technical_specs: false,
        technical_specs: ''
      }]);
      await loadData();
    } catch (err: any) {
      alert('Erro ao criar solicitação: ' + err.message);
    }
  };

  // Counts
  const pendingCount = purchases.filter(p => p.status === 'pending').length;
  const approvedCount = purchases.filter(p => p.status === 'approved').length;
  const rejectedCount = purchases.filter(p => p.status === 'rejected').length;

  // Filtered List
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (p.status !== activeTab) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (deptFilter !== 'all' && p.requester_department !== deptFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesRequester = p.requester_name.toLowerCase().includes(term);
        const matchesDept = (p.requester_department || '').toLowerCase().includes(term);
        const matchesAnyItem = p.items?.some(it => 
          it.name.toLowerCase().includes(term) || 
          (it.justification || '').toLowerCase().includes(term) ||
          (it.technical_specs || '').toLowerCase().includes(term) ||
          it.reference_link.toLowerCase().includes(term)
        );
        return matchesRequester || matchesDept || matchesAnyItem;
      }
      return true;
    });
  }, [purchases, activeTab, priorityFilter, deptFilter, searchTerm]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-sesi-blue text-white flex items-center justify-center shadow-md">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className={cn("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Gestão de Compras & Requisições
              </h1>
              <p className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                Aprovação, geração de PDF com links de referência e exportação para Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            <QrCode size={14} />
            QR Code / Link
          </button>

          <button
            onClick={() => exportPurchasesToExcel(purchases)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all active:scale-95",
              isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title="Exporta Excel com Item, Quantidade, Valor Estimado e Link clicável"
          >
            <FileDown size={14} />
            Excel
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sesi-yellow text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20 active:scale-95"
          >
            <Plus size={14} />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Em Espera */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('pending')}
          className={cn(
            "p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'pending'
              ? "border-amber-400 ring-2 ring-amber-400/30 shadow-md bg-amber-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <span className="text-2xl font-black text-amber-500">{pendingCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2", isDark ? "text-white" : "text-slate-900")}>Em Espera</h3>
          <p className="text-[11px] text-slate-400 font-medium">Aguardando aprovação</p>
        </motion.div>

        {/* Aprovados */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('approved')}
          className={cn(
            "p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'approved'
              ? "border-emerald-400 ring-2 ring-emerald-400/30 shadow-md bg-emerald-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-2xl font-black text-emerald-500">{approvedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2", isDark ? "text-white" : "text-slate-900")}>Aprovados</h3>
          <p className="text-[11px] text-slate-400 font-medium">Prontos para compra & PDF</p>
        </motion.div>

        {/* Reprovados */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('rejected')}
          className={cn(
            "p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'rejected'
              ? "border-rose-400 ring-2 ring-rose-400/30 shadow-md bg-rose-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
              <XCircle size={18} />
            </div>
            <span className="text-2xl font-black text-rose-500">{rejectedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2", isDark ? "text-white" : "text-slate-900")}>Reprovados</h3>
          <p className="text-[11px] text-slate-400 font-medium">Na lista para serem apagados</p>
        </motion.div>
      </div>

      {/* Tabs & Search Header */}
      <div className={cn("p-3 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-2.5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200")}>
        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 dark:bg-gray-800 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'pending'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Clock size={12} />
            Em Espera ({pendingCount})
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={cn(
              "flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'approved'
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <CheckCircle2 size={12} />
            Aprovados ({approvedCount})
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={cn(
              "flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'rejected'
                ? "bg-rose-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <XCircle size={12} />
            Reprovados ({rejectedCount})
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar itens, autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs font-bold outline-none transition-all",
                isDark ? "bg-gray-800 text-white placeholder-gray-500 border border-gray-700" : "bg-slate-100 text-slate-900 border-none"
              )}
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className={cn(
              "px-2 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer",
              isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-slate-100 text-slate-800"
            )}
          >
            <option value="all">Todos os Setores</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={cn(
              "px-2 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer",
              isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-slate-100 text-slate-800"
            )}
          >
            <option value="all">Prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>

          {activeTab === 'rejected' && rejectedCount > 0 && (
            <button
              onClick={handleDeleteAllRejected}
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1 shrink-0"
              title="Apagar todos os reprovados"
            >
              <Trash2 size={12} />
              Limpar Todos
            </button>
          )}
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="size-9 border-3 border-sesi-blue/30 border-t-sesi-blue rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando solicitações...</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className={cn("py-14 text-center rounded-2xl border-2 border-dashed p-5", isDark ? "bg-gray-900/40 border-gray-800" : "bg-white border-slate-200")}>
          <ShoppingBag size={36} className="mx-auto mb-2 text-slate-300 dark:text-gray-700" />
          <h3 className={cn("text-sm font-black", isDark ? "text-white" : "text-slate-900")}>
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-0.5">
            {activeTab === 'pending'
              ? 'Não há solicitações aguardando aprovação.'
              : activeTab === 'approved'
                ? 'Nenhuma solicitação aprovada ainda.'
                : 'A lista de reprovados está vazia.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredPurchases.map((purchase) => {
              const isExpanded = !!expandedRequests[purchase.id];
              const totalEst = purchase.items.reduce((acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 0);

              return (
                <motion.div
                  key={purchase.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all relative flex flex-col lg:flex-row lg:items-start justify-between gap-4",
                    isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200 hover:shadow-sm",
                    purchase.priority === 'urgente' && "border-rose-500/40"
                  )}
                >
                  {/* Left Details */}
                  <div className="flex-1 space-y-2.5">
                    {/* Header line with department & priority */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-600/15 text-blue-500 text-[10px] font-black rounded-md uppercase tracking-wider">
                        {purchase.requester_department || 'Coordenação Pedagógica'}
                      </span>

                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                        purchase.priority === 'urgente'
                          ? "bg-rose-500 text-white animate-pulse"
                          : purchase.priority === 'alta'
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {purchase.priority || 'Normal'}
                      </span>

                      <span className="text-[11px] font-bold text-slate-400">
                        {formatDate(purchase.created_at)} às {formatTime(purchase.created_at)}
                      </span>

                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        #{purchase.id.slice(0, 8).toUpperCase()}
                      </span>

                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded">
                        {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    {/* Solicitante info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <User size={13} className="text-sesi-blue" />
                        <span className={isDark ? "text-slate-200" : "text-slate-800"}>{purchase.requester_name}</span>
                      </div>

                      {purchase.requester_contact && (
                        <span className="text-[11px] text-slate-400 font-medium">({purchase.requester_contact})</span>
                      )}

                      {totalEst > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-auto sm:ml-0">
                          Total Est: R$ {totalEst.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>

                    {/* Items List (Distributed view with per-item justification!) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Itens Solicitados:
                        </span>
                        {purchase.items.length > 2 && (
                          <button
                            onClick={() => toggleExpand(purchase.id)}
                            className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-0.5"
                          >
                            {isExpanded ? 'Recolher' : `Ver todos (${purchase.items.length})`}
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {(isExpanded ? purchase.items : purchase.items.slice(0, 2)).map((it, idx) => (
                          <div
                            key={it.id || idx}
                            className="p-2.5 bg-slate-100/70 dark:bg-gray-800/40 rounded-xl border border-slate-200/50 dark:border-gray-700/50 space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                  {idx + 1}. {it.name}
                                </span>
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded shrink-0">
                                  {it.quantity} {it.unit || 'un'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {it.estimated_price && (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    R$ {Number(it.estimated_price).toFixed(2).replace('.', ',')}
                                  </span>
                                )}
                                <a
                                  href={it.reference_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded text-[10px] font-black flex items-center gap-1 transition-colors"
                                >
                                  <ExternalLink size={10} /> Link
                                </a>
                              </div>
                            </div>

                            {/* Justification of this item */}
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg">
                              <strong className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">Justificativa: </strong>
                              {it.justification || 'Conforme necessidade da disciplina'}
                            </p>

                            {/* Technical Specs if exists */}
                            {it.technical_specs && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                <strong>Especificação Técnica: </strong> {it.technical_specs}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rejection / Approval Notes */}
                    {purchase.status === 'rejected' && purchase.rejection_reason && (
                      <div className="p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                        <strong>Motivo da Reprovação: </strong> {purchase.rejection_reason}
                      </div>
                    )}

                    {purchase.status === 'approved' && purchase.approved_by && (
                      <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        <span>Aprovado por {purchase.approved_by} em {formatDate(purchase.approved_at || purchase.updated_at || new Date())}</span>
                        {purchase.approval_notes && <span className="text-slate-400 italic">("{purchase.approval_notes}")</span>}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-gray-800 pt-3 lg:pt-0 lg:pl-4">
                    {/* Em Espera Actions */}
                    {purchase.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsApproveModalOpen(true);
                          }}
                          className="flex-1 lg:flex-none px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <CheckCircle2 size={13} />
                          APROVAR
                        </button>

                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsRejectModalOpen(true);
                          }}
                          className="flex-1 lg:flex-none px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <XCircle size={13} />
                          REPROVAR
                        </button>
                      </>
                    )}

                    {/* Aprovados Actions */}
                    {purchase.status === 'approved' && (
                      <>
                        <button
                          onClick={() => generatePurchasePDF(purchase)}
                          className="flex-1 lg:flex-none px-3 py-1.5 bg-sesi-blue hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Download size={13} />
                          Baixar PDF
                        </button>

                        <button
                          onClick={() => generatePurchaseDoc(purchase)}
                          className={cn(
                            "flex-1 lg:flex-none px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1",
                            isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <FileText size={13} />
                          DOC
                        </button>

                        <button
                          onClick={() => handleRevertToPending(purchase.id)}
                          className="text-[10px] font-black text-slate-400 hover:text-amber-500 uppercase tracking-widest text-center transition-colors py-0.5"
                        >
                          Reverter
                        </button>
                      </>
                    )}

                    {/* Reprovados Actions */}
                    {purchase.status === 'rejected' && (
                      <>
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="flex-1 lg:flex-none px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Trash2 size={13} />
                          APAGAR
                        </button>

                        <button
                          onClick={() => handleRevertToPending(purchase.id)}
                          className="flex-1 lg:flex-none px-3 py-1.5 bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <RotateCcw size={12} />
                          Reavaliar
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-sm rounded-3xl p-5 shadow-2xl relative",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="text-center mb-3">
              <div className="size-11 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                <QrCode size={22} />
              </div>
              <h3 className="text-base font-black">QR Code de Compras</h3>
              <p className="text-xs text-slate-400 font-medium">
                Professores apontam a câmera para abrir o formulário.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-gray-800 flex items-center justify-center mb-3.5">
              <QRCodeSVG
                value={publicFormUrl}
                size={170}
                level="H"
                includeMargin={false}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 bg-sesi-yellow text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                {copiedLink ? 'LINK COPIADO!' : 'COPIAR LINK DO FORMULÁRIO'}
              </button>

              <a
                href={publicFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all",
                  isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                )}
              >
                <ExternalLink size={13} />
                Abrir Formulário no Navegador
              </a>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-1.5 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-wider"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Approve Modal */}
      {isApproveModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-md rounded-3xl p-5 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-2 mb-3 text-emerald-500">
              <CheckCircle2 size={22} />
              <h3 className="text-base font-black">Aprovar Solicitação de Compra</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-3">
              Solicitante: <strong>{selectedPurchase.requester_name}</strong> • Setor: <strong>{selectedPurchase.requester_department}</strong><br />
              Total de itens: <strong>{selectedPurchase.items.length} item(ns)</strong>
            </p>

            <div className="space-y-1 mb-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Observações da Aprovação (Opcional)
              </label>
              <textarea
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ex: Compra autorizada. Realizar cotação..."
                className={cn(
                  "w-full p-2.5 rounded-xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-emerald-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                )}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsApproveModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
              >
                Confirmar Aprovação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-md rounded-3xl p-5 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-2 mb-3 text-rose-500">
              <XCircle size={22} />
              <h3 className="text-base font-black">Reprovar Solicitação</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-3">
              Solicitante: <strong>{selectedPurchase.requester_name}</strong> • Setor: <strong>{selectedPurchase.requester_department}</strong>
            </p>

            <div className="space-y-1 mb-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Motivo da Reprovação <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Item já disponível no almoxarifado..."
                className={cn(
                  "w-full p-2.5 rounded-xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-rose-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-rose-500/20"
                )}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsRejectModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
              >
                Confirmar Reprovação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Manual Multi-Item Request Modal (Admin) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 shadow-2xl space-y-3.5",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-gray-800">
              <h3 className="text-base font-black">Nova Solicitação de Compra (Admin)</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Solicitante</label>
                  <input
                    required
                    value={manualRequester}
                    onChange={(e) => setManualRequester(e.target.value)}
                    className={cn("w-full h-9 px-2.5 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Setor</label>
                  <select
                    value={manualDept}
                    onChange={(e) => setManualDept(e.target.value)}
                    className={cn("w-full h-9 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prioridade</label>
                  <select
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as PurchasePriority)}
                    className={cn("w-full h-9 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Items in Manual Form */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                    Itens da Solicitação ({manualItems.length})
                  </span>
                </div>

                {manualItems.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-slate-50 dark:bg-gray-800/80 rounded-2xl border border-slate-200 dark:border-gray-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-blue-500">Item #{idx + 1}</span>
                      {manualItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setManualItems(manualItems.filter(i => i.id !== item.id))}
                          className="text-rose-500 text-[10px] font-bold"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <input
                      required
                      placeholder="Nome do Item *"
                      value={item.name}
                      onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                      className={cn("w-full h-8 px-2.5 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, parseInt(e.target.value) || 1) } : i))}
                        placeholder="Qtd"
                        className={cn("w-full h-8 px-2 text-center rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                      />

                      <select
                        value={item.unit}
                        onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, unit: e.target.value } : i))}
                        className={cn("w-full h-8 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                      >
                        <option value="un">un</option>
                        <option value="cx">cx</option>
                        <option value="pct">pct</option>
                        <option value="kit">kit</option>
                      </select>

                      <input
                        placeholder="Valor Est. (R$)"
                        value={item.estimated_price}
                        onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, estimated_price: e.target.value } : i))}
                        className={cn("w-full h-8 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                      />
                    </div>

                    <input
                      type="url"
                      required
                      placeholder="Link de Referência *"
                      value={item.reference_link}
                      onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, reference_link: e.target.value } : i))}
                      className={cn("w-full h-8 px-2.5 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                    />

                    <textarea
                      required
                      rows={2}
                      placeholder="Justificativa deste item *"
                      value={item.justification}
                      onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, justification: e.target.value } : i))}
                      className={cn("w-full p-2 rounded-lg text-xs font-medium outline-none resize-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                    />

                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.has_technical_specs}
                          onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, has_technical_specs: e.target.checked } : i))}
                          className="size-3 rounded"
                        />
                        Especificação Técnica
                      </label>

                      {item.has_technical_specs && (
                        <textarea
                          rows={2}
                          value={item.technical_specs}
                          onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, technical_specs: e.target.value } : i))}
                          placeholder="Voltagem, modelo, tamanho..."
                          className={cn("w-full p-2 mt-1 rounded-lg text-xs font-medium outline-none resize-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                        />
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setManualItems([...manualItems, {
                    id: 'it-' + Date.now().toString(36),
                    name: '',
                    quantity: 1,
                    unit: 'un',
                    reference_link: '',
                    justification: '',
                    estimated_price: '',
                    has_technical_specs: false,
                    technical_specs: ''
                  }])}
                  className="w-full py-2 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase"
                >
                  + Adicionar Outro Item
                </button>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sesi-yellow text-slate-950 font-black rounded-xl text-xs uppercase hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20"
                >
                  Cadastrar Solicitação
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
