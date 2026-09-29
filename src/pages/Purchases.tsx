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
  estimated_price: string;
  has_technical_specs: boolean;
  technical_specs: string;
}

export function Purchases() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
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
  const [manualDept, setManualDept] = useState('Monitoria / TI');
  const [manualContact, setManualContact] = useState('');
  const [manualJustification, setManualJustification] = useState('');
  const [manualPriority, setManualPriority] = useState<PurchasePriority>('normal');
  const [manualItems, setManualItems] = useState<ManualItemForm[]>([
    {
      id: 'it-1',
      name: '',
      quantity: 1,
      unit: 'un',
      reference_link: '',
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
    if (!manualJustification.trim() || manualItems.some(it => !it.name.trim() || !it.reference_link.trim())) {
      alert('Preencha os campos obrigatórios (Item, Link e Justificativa).');
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
          estimated_price: it.estimated_price ? parseFloat(it.estimated_price.replace(',', '.')) : undefined,
          has_technical_specs: it.has_technical_specs,
          technical_specs: it.has_technical_specs ? it.technical_specs.trim() : undefined
        };
      });

      await createPurchaseRequest({
        requester_name: manualRequester.trim(),
        requester_department: manualDept.trim() || undefined,
        requester_contact: manualContact.trim() || undefined,
        justification: manualJustification.trim(),
        priority: manualPriority,
        items
      });

      setIsNewModalOpen(false);
      setManualJustification('');
      setManualItems([{
        id: 'it-1',
        name: '',
        quantity: 1,
        unit: 'un',
        reference_link: '',
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
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesRequester = p.requester_name.toLowerCase().includes(term);
        const matchesDept = (p.requester_department || '').toLowerCase().includes(term);
        const matchesJust = (p.justification || '').toLowerCase().includes(term);
        const matchesAnyItem = p.items?.some(it => 
          it.name.toLowerCase().includes(term) || 
          (it.technical_specs || '').toLowerCase().includes(term) ||
          it.reference_link.toLowerCase().includes(term)
        );
        return matchesRequester || matchesDept || matchesJust || matchesAnyItem;
      }
      return true;
    });
  }, [purchases, activeTab, priorityFilter, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-sesi-blue text-white flex items-center justify-center shadow-md">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 className={cn("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Gestão de Compras & Requisições
              </h1>
              <p className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                Aprovação, geração de PDF com links e exportação para Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            <QrCode size={15} />
            QR Code / Link
          </button>

          <button
            onClick={() => exportPurchasesToExcel(purchases)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all active:scale-95",
              isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title="Exporta Excel com Item, Quantidade, Valor Estimado e Link clicável"
          >
            <FileDown size={15} />
            Excel
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-sesi-yellow text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20 active:scale-95"
          >
            <Plus size={15} />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Em Espera */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('pending')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'pending'
              ? "border-amber-400 ring-2 ring-amber-400/30 shadow-md bg-amber-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <span className="text-2xl font-black text-amber-500">{pendingCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2.5", isDark ? "text-white" : "text-slate-900")}>Em Espera</h3>
          <p className="text-[11px] text-slate-400 font-medium">Aguardando aprovação</p>
        </motion.div>

        {/* Aprovados */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('approved')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'approved'
              ? "border-emerald-400 ring-2 ring-emerald-400/30 shadow-md bg-emerald-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-2xl font-black text-emerald-500">{approvedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2.5", isDark ? "text-white" : "text-slate-900")}>Aprovados</h3>
          <p className="text-[11px] text-slate-400 font-medium">Prontos para compra & PDF</p>
        </motion.div>

        {/* Reprovados */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setActiveTab('rejected')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'rejected'
              ? "border-rose-400 ring-2 ring-rose-400/30 shadow-md bg-rose-500/5"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
              <XCircle size={20} />
            </div>
            <span className="text-2xl font-black text-rose-500">{rejectedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-sm font-black mt-2.5", isDark ? "text-white" : "text-slate-900")}>Reprovados</h3>
          <p className="text-[11px] text-slate-400 font-medium">Na lista para serem apagados</p>
        </motion.div>
      </div>

      {/* Tabs & Search Header */}
      <div className={cn("p-3 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200")}>
        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 dark:bg-gray-800 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'pending'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Clock size={13} />
            Em Espera ({pendingCount})
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={cn(
              "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'approved'
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <CheckCircle2 size={13} />
            Aprovados ({approvedCount})
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={cn(
              "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              activeTab === 'rejected'
                ? "bg-rose-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <XCircle size={13} />
            Reprovados ({rejectedCount})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar itens, solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-bold outline-none transition-all",
                isDark ? "bg-gray-800 text-white placeholder-gray-500 border border-gray-700" : "bg-slate-100 text-slate-900 border-none"
              )}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer",
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
              <Trash2 size={13} />
              Limpar Todos
            </button>
          )}
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="size-10 border-4 border-sesi-blue/30 border-t-sesi-blue rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando solicitações...</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className={cn("py-16 text-center rounded-2xl border-2 border-dashed p-6", isDark ? "bg-gray-900/40 border-gray-800" : "bg-white border-slate-200")}>
          <ShoppingBag size={40} className="mx-auto mb-2 text-slate-300 dark:text-gray-700" />
          <h3 className={cn("text-base font-black", isDark ? "text-white" : "text-slate-900")}>
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
        <div className="grid grid-cols-1 gap-3.5">
          <AnimatePresence mode="popLayout">
            {filteredPurchases.map((purchase) => {
              const isExpanded = !!expandedRequests[purchase.id];
              const totalEst = purchase.items.reduce((acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 0);

              return (
                <motion.div
                  key={purchase.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-5 rounded-2xl border transition-all relative flex flex-col lg:flex-row lg:items-start justify-between gap-5",
                    isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200 hover:shadow-md",
                    purchase.priority === 'urgente' && "border-rose-500/40"
                  )}
                >
                  {/* Left Details */}
                  <div className="flex-1 space-y-3">
                    {/* Header line */}
                    <div className="flex flex-wrap items-center gap-2">
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

                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded">
                        {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    {/* Solicitante info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <User size={13} className="text-sesi-blue" />
                        <span className={isDark ? "text-slate-200" : "text-slate-800"}>{purchase.requester_name}</span>
                      </div>

                      {purchase.requester_department && (
                        <div className="flex items-center gap-1">
                          <Building size={13} className="text-amber-500" />
                          <span>{purchase.requester_department}</span>
                        </div>
                      )}

                      {totalEst > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Total Est: R$ {totalEst.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>

                    {/* Justification Box */}
                    <div className="p-2.5 bg-slate-50 dark:bg-gray-800/60 rounded-xl border border-slate-100 dark:border-gray-800">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Justificativa:</span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        "{purchase.justification}"
                      </p>
                    </div>

                    {/* Items List (Distributed view) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Itens da Solicitação ({purchase.items.length}):
                        </span>
                        {purchase.items.length > 2 && (
                          <button
                            onClick={() => toggleExpand(purchase.id)}
                            className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-0.5"
                          >
                            {isExpanded ? 'Ver menos' : `Ver todos (${purchase.items.length})`}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {(isExpanded ? purchase.items : purchase.items.slice(0, 2)).map((it, idx) => (
                          <div
                            key={it.id || idx}
                            className="p-2.5 bg-slate-100/70 dark:bg-gray-800/40 rounded-xl border border-slate-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {idx + 1}. {it.name}
                                </span>
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded shrink-0">
                                  {it.quantity} {it.unit || 'un'}
                                </span>
                              </div>

                              {it.technical_specs && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  <strong className="text-[9px] uppercase font-bold text-amber-500">Spec: </strong>
                                  {it.technical_specs}
                                </p>
                              )}
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
                                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink size={11} /> Link
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rejection / Approval Notes */}
                    {purchase.status === 'rejected' && purchase.rejection_reason && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300">
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
                  <div className="flex flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-gray-800 pt-3 lg:pt-0 lg:pl-5">
                    {/* Em Espera Actions */}
                    {purchase.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsApproveModalOpen(true);
                          }}
                          className="flex-1 lg:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 size={14} />
                          APROVAR
                        </button>

                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsRejectModalOpen(true);
                          }}
                          className="flex-1 lg:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <XCircle size={14} />
                          REPROVAR
                        </button>
                      </>
                    )}

                    {/* Aprovados Actions */}
                    {purchase.status === 'approved' && (
                      <>
                        <button
                          onClick={() => generatePurchasePDF(purchase)}
                          className="flex-1 lg:flex-none px-3.5 py-2 bg-sesi-blue hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Download size={13} />
                          Baixar PDF
                        </button>

                        <button
                          onClick={() => generatePurchaseDoc(purchase)}
                          className={cn(
                            "flex-1 lg:flex-none px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5",
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
                          className="flex-1 lg:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Trash2 size={14} />
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
              "w-full max-w-sm rounded-3xl p-6 shadow-2xl relative",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="text-center mb-4">
              <div className="size-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <QrCode size={24} />
              </div>
              <h3 className="text-lg font-black">QR Code de Compras</h3>
              <p className="text-xs text-slate-400 font-medium">
                Professores apontam a câmera para abrir o formulário.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-gray-800 flex items-center justify-center mb-4">
              <QRCodeSVG
                value={publicFormUrl}
                size={180}
                level="H"
                includeMargin={false}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-3 bg-sesi-yellow text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
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
                <ExternalLink size={14} />
                Abrir Formulário no Navegador
              </a>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-2 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-wider"
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
              "w-full max-w-md rounded-3xl p-6 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-2.5 mb-3 text-emerald-500">
              <CheckCircle2 size={24} />
              <h3 className="text-lg font-black">Aprovar Solicitação de Compra</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-3">
              Solicitante: <strong>{selectedPurchase.requester_name}</strong><br />
              Total de itens: <strong>{selectedPurchase.items.length} item(ns)</strong>
            </p>

            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Observações da Aprovação / Orientações (Opcional)
              </label>
              <textarea
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ex: Compra autorizada. Realizar cotação com fornecedores credenciados..."
                className={cn(
                  "w-full p-3 rounded-xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-emerald-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                )}
              />
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => { setIsApproveModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-2.5 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all"
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
              "w-full max-w-md rounded-3xl p-6 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-2.5 mb-3 text-rose-500">
              <XCircle size={24} />
              <h3 className="text-lg font-black">Reprovar Solicitação</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-3">
              Solicitante: <strong>{selectedPurchase.requester_name}</strong><br />
              Total de itens: <strong>{selectedPurchase.items.length} item(ns)</strong>
            </p>

            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Motivo da Reprovação <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Item já disponível no almoxarifado / Orçamento indisponível..."
                className={cn(
                  "w-full p-3 rounded-xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-rose-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-rose-500/20"
                )}
              />
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => { setIsRejectModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-2.5 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/20 transition-all"
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
              "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-4",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="text-lg font-black">Nova Solicitação de Compra</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Solicitante</label>
                  <input
                    required
                    value={manualRequester}
                    onChange={(e) => setManualRequester(e.target.value)}
                    className={cn("w-full h-10 px-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Setor</label>
                  <input
                    value={manualDept}
                    onChange={(e) => setManualDept(e.target.value)}
                    className={cn("w-full h-10 px-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prioridade</label>
                  <select
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as PurchasePriority)}
                    className={cn("w-full h-10 px-2 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Justificativa *</label>
                <textarea
                  required
                  rows={2}
                  value={manualJustification}
                  onChange={(e) => setManualJustification(e.target.value)}
                  placeholder="Motivo da compra..."
                  className={cn("w-full p-2.5 rounded-xl text-xs font-medium outline-none resize-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                />
              </div>

              {/* Items in Manual Form */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                    Itens ({manualItems.length})
                  </span>
                </div>

                {manualItems.map((item, idx) => (
                  <div key={item.id} className="p-3.5 bg-slate-50 dark:bg-gray-800/80 rounded-2xl border border-slate-200 dark:border-gray-700 space-y-2.5">
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
                      className={cn("w-full h-9 px-3 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, parseInt(e.target.value) || 1) } : i))}
                        placeholder="Qtd"
                        className={cn("w-full h-9 px-2 text-center rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                      />

                      <select
                        value={item.unit}
                        onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, unit: e.target.value } : i))}
                        className={cn("w-full h-9 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
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
                        className={cn("w-full h-9 px-2 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                      />
                    </div>

                    <input
                      type="url"
                      required
                      placeholder="Link de Referência *"
                      value={item.reference_link}
                      onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, reference_link: e.target.value } : i))}
                      className={cn("w-full h-9 px-3 rounded-lg text-xs font-bold outline-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
                    />

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.has_technical_specs}
                          onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, has_technical_specs: e.target.checked } : i))}
                          className="size-3.5 rounded"
                        />
                        Especificação Técnica
                      </label>

                      {item.has_technical_specs && (
                        <textarea
                          rows={2}
                          value={item.technical_specs}
                          onChange={(e) => setManualItems(manualItems.map(i => i.id === item.id ? { ...i, technical_specs: e.target.value } : i))}
                          placeholder="Voltagem, modelo, tamanho..."
                          className={cn("w-full p-2 mt-1.5 rounded-lg text-xs font-medium outline-none resize-none", isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900")}
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
                    estimated_price: '',
                    has_technical_specs: false,
                    technical_specs: ''
                  }])}
                  className="w-full py-2 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase"
                >
                  + Adicionar Outro Item
                </button>
              </div>

              <div className="pt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className={cn("flex-1 py-2.5 rounded-xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sesi-yellow text-slate-950 font-black rounded-xl text-xs uppercase hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20"
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
