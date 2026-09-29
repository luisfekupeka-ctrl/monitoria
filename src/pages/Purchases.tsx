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
  Filter, 
  FileText, 
  Download, 
  AlertCircle, 
  Building, 
  User, 
  Tag, 
  Link2, 
  Eye, 
  RotateCcw,
  Sparkles,
  RefreshCw,
  Printer,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PurchaseRequest, PurchaseStatus, PurchasePriority } from '../types';
import { 
  fetchPurchaseRequests, 
  createPurchaseRequest, 
  updatePurchaseStatus, 
  deletePurchaseRequest, 
  deleteMultiplePurchaseRequests, 
  generatePurchasePDF, 
  generatePurchaseDoc, 
  exportPurchasesToExcel 
} from '../lib/purchasesService';
import { cn, formatDate, formatTime } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Purchases() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // New Purchase Form (Admin Manual)
  const [newReq, setNewReq] = useState({
    requester_name: user?.name || 'Administração',
    requester_department: 'Monitoria / TI',
    requester_contact: '',
    item_name: '',
    quantity: 1,
    unit: 'un',
    reference_link: '',
    justification: '',
    technical_specs: '',
    estimated_price: '',
    priority: 'normal' as PurchasePriority
  });

  const publicFormUrl = `${window.location.origin}/compras/solicitar`;

  useEffect(() => {
    loadData();

    // Supabase Realtime channel for purchases
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja apagar permanentemente a solicitação de "${name}"?`)) return;
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
    if (!newReq.item_name.trim() || !newReq.reference_link.trim() || !newReq.justification.trim()) {
      alert('Preencha os campos obrigatórios: Item, Link de Referência e Justificativa.');
      return;
    }

    try {
      let formattedUrl = newReq.reference_link.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }

      await createPurchaseRequest({
        requester_name: newReq.requester_name.trim(),
        requester_department: newReq.requester_department.trim() || undefined,
        requester_contact: newReq.requester_contact.trim() || undefined,
        item_name: newReq.item_name.trim(),
        quantity: Number(newReq.quantity) || 1,
        unit: newReq.unit,
        reference_link: formattedUrl,
        justification: newReq.justification.trim(),
        technical_specs: newReq.technical_specs.trim() || undefined,
        estimated_price: newReq.estimated_price ? parseFloat(newReq.estimated_price.replace(',', '.')) : undefined,
        priority: newReq.priority
      });

      setIsNewModalOpen(false);
      setNewReq({
        requester_name: user?.name || 'Administração',
        requester_department: 'Monitoria / TI',
        requester_contact: '',
        item_name: '',
        quantity: 1,
        unit: 'un',
        reference_link: '',
        justification: '',
        technical_specs: '',
        estimated_price: '',
        priority: 'normal'
      });
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
        const matchesItem = p.item_name.toLowerCase().includes(term);
        const matchesRequester = p.requester_name.toLowerCase().includes(term);
        const matchesDept = (p.requester_department || '').toLowerCase().includes(term);
        const matchesJust = (p.justification || '').toLowerCase().includes(term);
        const matchesSpecs = (p.technical_specs || '').toLowerCase().includes(term);
        return matchesItem || matchesRequester || matchesDept || matchesJust || matchesSpecs;
      }
      return true;
    });
  }, [purchases, activeTab, priorityFilter, searchTerm]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-sesi-blue text-white flex items-center justify-center shadow-md">
              <ShoppingBag size={26} />
            </div>
            <div>
              <h1 className={cn("text-2xl lg:text-3xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Gestão de Compras & Requisições
              </h1>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                Controle via QR Code, aprovação pelo Administrador e emissão de documentos PDF com link de referência.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
          >
            <QrCode size={16} />
            QR Code / Link
          </button>

          <button
            onClick={() => exportPurchasesToExcel(purchases)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all active:scale-95",
              isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <FileDown size={16} />
            Excel
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-sesi-yellow text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20 active:scale-95"
          >
            <Plus size={16} />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Em Espera */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('pending')}
          className={cn(
            "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'pending'
              ? "border-amber-400 ring-2 ring-amber-400/30 shadow-lg"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Clock size={24} />
            </div>
            <span className="text-3xl font-black text-amber-500">{pendingCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-base font-black mt-4", isDark ? "text-white" : "text-slate-900")}>Em Espera</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Aguardando aprovação do administrador</p>
        </motion.div>

        {/* Aprovados */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('approved')}
          className={cn(
            "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'approved'
              ? "border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-3xl font-black text-emerald-500">{approvedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-base font-black mt-4", isDark ? "text-white" : "text-slate-900")}>Aprovados</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Prontos para compra & PDF emitido</p>
        </motion.div>

        {/* Reprovados */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('rejected')}
          className={cn(
            "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
            activeTab === 'rejected'
              ? "border-rose-400 ring-2 ring-rose-400/30 shadow-lg"
              : isDark ? "bg-gray-800/40 border-gray-800" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
              <XCircle size={24} />
            </div>
            <span className="text-3xl font-black text-rose-500">{rejectedCount.toString().padStart(2, '0')}</span>
          </div>
          <h3 className={cn("text-base font-black mt-4", isDark ? "text-white" : "text-slate-900")}>Reprovados</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Na lista para serem apagados</p>
        </motion.div>
      </div>

      {/* Tabs & Search Header */}
      <div className={cn("p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200")}>
        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 dark:bg-gray-800 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === 'pending'
                ? "bg-amber-500 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Clock size={14} />
            Em Espera ({pendingCount})
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={cn(
              "flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === 'approved'
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <CheckCircle2 size={14} />
            Aprovados ({approvedCount})
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={cn(
              "flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === 'rejected'
                ? "bg-rose-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <XCircle size={14} />
            Reprovados ({rejectedCount})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar item, solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold outline-none transition-all",
                isDark ? "bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:border-sesi-blue" : "bg-slate-100 text-slate-900 border-none focus:ring-2 focus:ring-sesi-blue/20"
              )}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer",
              isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-slate-100 text-slate-800"
            )}
          >
            <option value="all">Todas Prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>

          {activeTab === 'rejected' && rejectedCount > 0 && (
            <button
              onClick={handleDeleteAllRejected}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0"
              title="Apagar todos os reprovados"
            >
              <Trash2 size={14} />
              Limpar Todos
            </button>
          )}
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="size-12 border-4 border-sesi-blue/30 border-t-sesi-blue rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando solicitações...</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className={cn("py-20 text-center rounded-[2.5rem] border-2 border-dashed p-8", isDark ? "bg-gray-900/40 border-gray-800" : "bg-white border-slate-200")}>
          <ShoppingBag size={48} className="mx-auto mb-3 text-slate-300 dark:text-gray-700" />
          <h3 className={cn("text-lg font-black", isDark ? "text-white" : "text-slate-900")}>
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1">
            {activeTab === 'pending'
              ? 'Não há solicitações de compras aguardando aprovação no momento.'
              : activeTab === 'approved'
                ? 'Nenhuma solicitação aprovada ainda.'
                : 'A lista de reprovados está vazia.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-500 transition-colors uppercase tracking-wider"
            >
              Ver QR Code para Professores
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredPurchases.map((purchase) => {
              return (
                <motion.div
                  key={purchase.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-6 rounded-[2rem] border transition-all relative group flex flex-col lg:flex-row lg:items-center justify-between gap-6",
                    isDark ? "bg-gray-900 border-gray-800 hover:border-gray-700" : "bg-white border-slate-200 hover:shadow-md",
                    purchase.priority === 'urgente' && "border-rose-500/40 ring-1 ring-rose-500/20"
                  )}
                >
                  {/* Left Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
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

                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                        #{purchase.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                      <h3 className={cn("text-xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                        {purchase.item_name}
                      </h3>
                      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black rounded-lg shrink-0">
                        {purchase.quantity} {purchase.unit || 'un'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-sesi-blue" />
                        <span className={isDark ? "text-slate-300" : "text-slate-700"}>{purchase.requester_name}</span>
                      </div>

                      {purchase.requester_department && (
                        <div className="flex items-center gap-1.5">
                          <Building size={14} className="text-amber-500" />
                          <span>{purchase.requester_department}</span>
                        </div>
                      )}

                      {purchase.estimated_price && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <span>Est: R$ {Number(purchase.estimated_price).toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                    </div>

                    {/* Justification snippet */}
                    <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-xl border border-slate-100 dark:border-gray-800">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Justificativa:</span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                        "{purchase.justification}"
                      </p>
                    </div>

                    {/* Technical Specs if exists */}
                    {purchase.technical_specs && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <strong className="text-[10px] uppercase font-black tracking-wider text-slate-400">Especificações: </strong>
                        <span>{purchase.technical_specs}</span>
                      </div>
                    )}

                    {/* Rejection / Approval Notes info */}
                    {purchase.status === 'rejected' && purchase.rejection_reason && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                        <strong>Motivo da Reprovação: </strong> {purchase.rejection_reason}
                      </div>
                    )}

                    {purchase.status === 'approved' && purchase.approved_by && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={14} />
                        <span>Aprovado por {purchase.approved_by} {purchase.approved_at && `em ${formatDate(purchase.approved_at)}`}</span>
                        {purchase.approval_notes && <span className="text-slate-400 italic">("{purchase.approval_notes}")</span>}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-gray-800 pt-4 lg:pt-0 lg:pl-6">
                    {/* Direct Reference Link Button */}
                    <a
                      href={purchase.reference_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                      title={purchase.reference_link}
                    >
                      <ExternalLink size={14} />
                      Link Referência
                    </a>

                    {/* Em Espera Actions */}
                    {purchase.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsApproveModalOpen(true);
                          }}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <CheckCircle2 size={16} />
                          APROVAR
                        </button>

                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsRejectModalOpen(true);
                          }}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <XCircle size={16} />
                          REPROVAR
                        </button>
                      </>
                    )}

                    {/* Aprovados Actions */}
                    {purchase.status === 'approved' && (
                      <>
                        <button
                          onClick={() => generatePurchasePDF(purchase)}
                          className="px-4 py-2.5 bg-sesi-blue hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Download size={14} />
                          Baixar PDF
                        </button>

                        <button
                          onClick={() => generatePurchaseDoc(purchase)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2",
                            isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <FileText size={14} />
                          Baixar .DOC
                        </button>

                        <button
                          onClick={() => handleRevertToPending(purchase.id)}
                          className="text-[10px] font-black text-slate-400 hover:text-amber-500 uppercase tracking-widest text-center transition-colors py-1"
                        >
                          Reverter para Em Espera
                        </button>
                      </>
                    )}

                    {/* Reprovados Actions */}
                    {purchase.status === 'rejected' && (
                      <>
                        <button
                          onClick={() => handleDelete(purchase.id, purchase.item_name)}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Trash2 size={16} />
                          APAGAR ITEM
                        </button>

                        <button
                          onClick={() => handleRevertToPending(purchase.id)}
                          className="px-4 py-2 bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={14} />
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
              "w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="text-center mb-6">
              <div className="size-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <QrCode size={32} />
              </div>
              <h3 className="text-2xl font-black">QR Code para Solicitações</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Professores e colaboradores apontam a câmera do celular para preencher o formulário.
              </p>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border-2 border-slate-100 dark:border-gray-800 flex items-center justify-center mb-6 shadow-inner">
              <QRCodeSVG
                value={publicFormUrl}
                size={200}
                level="H"
                includeMargin={false}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCopyLink}
                className="w-full py-4 bg-sesi-yellow text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sesi-yellow/20"
              >
                {copiedLink ? <Check size={18} /> : <Copy size={18} />}
                {copiedLink ? 'LINK COPIADO!' : 'COPIAR LINK DO FORMULÁRIO'}
              </button>

              <a
                href={publicFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all",
                  isDark ? "bg-gray-800 text-slate-300 border-gray-700 hover:bg-gray-700" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                )}
              >
                <ExternalLink size={16} />
                Abrir Formulário no Navegador
              </a>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-3 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest"
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
              "w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-3 mb-4 text-emerald-500">
              <CheckCircle2 size={28} />
              <h3 className="text-xl font-black">Aprovar Solicitação de Compra</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-4">
              Item: <strong>{selectedPurchase.item_name}</strong> ({selectedPurchase.quantity} {selectedPurchase.unit || 'un'})<br />
              Solicitante: <strong>{selectedPurchase.requester_name}</strong>
            </p>

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Observações da Aprovação / Orientações (Opcional)
              </label>
              <textarea
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ex: Compra autorizada para o laboratório 1. Realizar cotação com 3 fornecedores..."
                className={cn(
                  "w-full p-4 rounded-2xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-emerald-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                )}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setIsApproveModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all"
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
              "w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center gap-3 mb-4 text-rose-500">
              <XCircle size={28} />
              <h3 className="text-xl font-black">Reprovar Solicitação</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-4">
              Item: <strong>{selectedPurchase.item_name}</strong><br />
              Solicitante: <strong>{selectedPurchase.requester_name}</strong>
            </p>

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Motivo da Reprovação (Obrigatório) <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Já possuímos este item em estoque no Almoxarifado / Orçamento indisponível para o trimestre..."
                className={cn(
                  "w-full p-4 rounded-2xl text-xs font-medium outline-none resize-none",
                  isDark ? "bg-gray-800 text-white border border-gray-700 focus:border-rose-500" : "bg-slate-100 text-slate-900 focus:ring-2 focus:ring-rose-500/20"
                )}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setIsRejectModalOpen(false); setSelectedPurchase(null); }}
                className={cn("flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all"
              >
                Confirmar Reprovação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Manual Request Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 shadow-2xl",
              isDark ? "bg-gray-900 border border-gray-800 text-white" : "bg-white text-slate-900"
            )}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-gray-800 mb-6">
              <h3 className="text-xl font-black">Nova Solicitação de Compra (Admin)</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solicitante</label>
                  <input
                    required
                    value={newReq.requester_name}
                    onChange={(e) => setNewReq({ ...newReq, requester_name: e.target.value })}
                    className={cn("w-full h-12 px-4 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Departamento / Setor</label>
                  <input
                    value={newReq.requester_department}
                    onChange={(e) => setNewReq({ ...newReq, requester_department: e.target.value })}
                    className={cn("w-full h-12 px-4 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item / Material *</label>
                <input
                  required
                  placeholder="Ex: Teclado sem fio / Adaptador VGA para HDMI"
                  value={newReq.item_name}
                  onChange={(e) => setNewReq({ ...newReq, item_name: e.target.value })}
                  className={cn("w-full h-12 px-4 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReq.quantity}
                    onChange={(e) => setNewReq({ ...newReq, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className={cn("w-full h-12 px-4 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unidade</label>
                  <select
                    value={newReq.unit}
                    onChange={(e) => setNewReq({ ...newReq, unit: e.target.value })}
                    className={cn("w-full h-12 px-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  >
                    <option value="un">un</option>
                    <option value="cx">cx</option>
                    <option value="pct">pct</option>
                    <option value="kit">kit</option>
                    <option value="m">m</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridade</label>
                  <select
                    value={newReq.priority}
                    onChange={(e) => setNewReq({ ...newReq, priority: e.target.value as PurchasePriority })}
                    className={cn("w-full h-12 px-3 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link de Referência *</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={newReq.reference_link}
                  onChange={(e) => setNewReq({ ...newReq, reference_link: e.target.value })}
                  className={cn("w-full h-12 px-4 rounded-xl text-xs font-bold outline-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Justificativa *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explique o motivo da compra..."
                  value={newReq.justification}
                  onChange={(e) => setNewReq({ ...newReq, justification: e.target.value })}
                  className={cn("w-full p-3 rounded-xl text-xs font-medium outline-none resize-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações / Especificação Técnica</label>
                <textarea
                  rows={2}
                  placeholder="Voltagem, modelo, tamanho..."
                  value={newReq.technical_specs}
                  onChange={(e) => setNewReq({ ...newReq, technical_specs: e.target.value })}
                  className={cn("w-full p-3 rounded-xl text-xs font-medium outline-none resize-none", isDark ? "bg-gray-800 text-white" : "bg-slate-100 text-slate-900")}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className={cn("flex-1 py-3.5 rounded-2xl text-xs font-black uppercase", isDark ? "bg-gray-800 text-slate-300" : "bg-slate-100 text-slate-600")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-sesi-yellow text-slate-950 font-black rounded-2xl text-xs uppercase hover:bg-amber-400 transition-all shadow-md shadow-sesi-yellow/20"
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
