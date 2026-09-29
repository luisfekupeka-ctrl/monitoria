import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Send, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Minus, 
  FileText, 
  Sparkles, 
  Link2, 
  Clock, 
  User, 
  Building, 
  Trash2, 
  Download,
  Info,
  Phone,
  Layers
} from 'lucide-react';
import { createPurchaseRequest, generatePurchasePDF, generatePurchaseDoc } from '../lib/purchasesService';
import { PurchasePriority, PurchaseRequest, PurchaseItem } from '../types';

interface FormItemState {
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

function generateItemId(): string {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

export default function PurchaseFormPublic() {
  const [requesterName, setRequesterName] = useState('');
  const [requesterDepartment, setRequesterDepartment] = useState('Coordenação Pedagógica');
  const [customDepartment, setCustomDepartment] = useState('');
  const [requesterContact, setRequesterContact] = useState('');
  const [priority, setPriority] = useState<PurchasePriority>('normal');

  // Multi-item dynamic list with per-item justification
  const [itemsList, setItemsList] = useState<FormItemState[]>([
    {
      id: generateItemId(),
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

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<PurchaseRequest | null>(null);

  const handleAddItem = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newItem: FormItemState = {
      id: generateItemId(),
      name: '',
      quantity: 1,
      unit: 'un',
      reference_link: '',
      justification: '',
      estimated_price: '',
      has_technical_specs: false,
      technical_specs: ''
    };
    setItemsList(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setItemsList(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(it => it.id !== id);
    });
  };

  const handleUpdateItem = (id: string, field: keyof FormItemState, value: any) => {
    setItemsList(prev => prev.map(it => {
      if (it.id === id) {
        return { ...it, [field]: value };
      }
      return it;
    }));
  };

  const handleTestLink = (url: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!url.trim()) {
      alert('Por favor, digite ou cole o link antes de testar.');
      return;
    }
    let formatted = url.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    window.open(formatted, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!requesterName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    const finalDept = requesterDepartment === 'Outro Setor' && customDepartment.trim()
      ? customDepartment.trim()
      : requesterDepartment;

    if (!finalDept) {
      setErrorMessage('Selecione o departamento ou setor de onde a solicitação está vindo.');
      return;
    }

    if (itemsList.length === 0) {
      setErrorMessage('Adicione pelo menos um item à solicitação.');
      return;
    }

    for (let i = 0; i < itemsList.length; i++) {
      const it = itemsList[i];
      if (!it.name.trim()) {
        setErrorMessage(`Informe o nome/descrição do Item #${i + 1}.`);
        return;
      }
      if (!it.reference_link.trim()) {
        setErrorMessage(`O link de referência/produto é obrigatório para o Item #${i + 1} (${it.name}).`);
        return;
      }
      if (!it.justification.trim() || it.justification.trim().length < 4) {
        setErrorMessage(`Apresente a justificativa para o Item #${i + 1} (${it.name}).`);
        return;
      }
      if (it.has_technical_specs && !it.technical_specs.trim()) {
        setErrorMessage(`Você marcou que o Item #${i + 1} necessita de especificação técnica. Por favor, informe os detalhes.`);
        return;
      }
    }

    setIsLoading(true);

    try {
      const formattedItems: PurchaseItem[] = itemsList.map((it, idx) => {
        let link = it.reference_link.trim();
        if (!/^https?:\/\//i.test(link)) {
          link = 'https://' + link;
        }

        return {
          id: it.id || `item-${idx + 1}`,
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

      const created = await createPurchaseRequest({
        requester_name: requesterName.trim(),
        requester_department: finalDept,
        requester_contact: requesterContact.trim() || undefined,
        justification: formattedItems[0]?.justification || '',
        priority: priority,
        items: formattedItems
      });

      setSubmittedRequest(created);
    } catch (err: any) {
      console.error('Error submitting purchase request:', err);
      setErrorMessage('Erro ao registrar solicitação: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSubmittedRequest(null);
    setPriority('normal');
    setCustomDepartment('');
    setItemsList([
      {
        id: generateItemId(),
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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none text-white">Monitoria SESI</h1>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-0.5">Portal de Requisição de Compras</p>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Acesso QR Code
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5">
        {submittedRequest ? (
          /* Success State */
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-center transition-all animate-fadeIn">
            <div className="size-14 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={32} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-wider mb-2">
              <Clock size={11} />
              Em Espera (Aguardando Aprovação)
            </div>

            <h2 className="text-xl font-black text-white mb-1">Solicitação Enviada com Sucesso!</h2>
            <p className="text-slate-400 text-xs max-w-md mx-auto mb-5">
              Sua requisição do setor <strong className="text-slate-200">{submittedRequest.requester_department}</strong> contendo <strong className="text-amber-400">{submittedRequest.items.length} item(ns)</strong> foi registrada e enviada para aprovação do administrador.
            </p>

            {/* Items Summary Card */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-left space-y-3 mb-5 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Protocolo Individual</span>
                <span className="font-mono font-bold text-emerald-400">#{submittedRequest.id.slice(0, 10).toUpperCase()}</span>
              </div>

              <div className="text-xs text-slate-300">
                <span className="text-[10px] text-slate-500 uppercase font-black block">Solicitante / Setor</span>
                <strong className="text-white">{submittedRequest.requester_name}</strong> • <span className="text-amber-400 font-bold">{submittedRequest.requester_department}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-black block mb-1.5">
                  Itens Desta Solicitação ({submittedRequest.items.length})
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {submittedRequest.items.map((it, idx) => (
                    <div key={it.id || idx} className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-200 truncate">{idx + 1}. {it.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {it.quantity} {it.unit || 'un'} {it.estimated_price ? `• Est: R$ ${Number(it.estimated_price).toFixed(2).replace('.', ',')}` : ''}
                          </p>
                        </div>
                        <a
                          href={it.reference_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-black shrink-0 underline flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg"
                        >
                          <ExternalLink size={10} /> Abrir Link
                        </a>
                      </div>
                      <p className="text-[11px] text-slate-300 italic bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                        <strong>Justificativa:</strong> "{it.justification}"
                      </p>
                      {it.technical_specs && (
                        <p className="text-[10px] text-amber-300/90 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                          <strong>Especificações Técnicas:</strong> {it.technical_specs}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => generatePurchasePDF(submittedRequest)}
                className="py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Download size={14} />
                Baixar PDF Desta Solicitação
              </button>

              <button
                type="button"
                onClick={() => generatePurchaseDoc(submittedRequest)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <FileText size={14} />
                Baixar Word (.doc)
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-5 text-xs font-black text-amber-400 hover:text-amber-300 hover:underline uppercase tracking-wider block mx-auto cursor-pointer"
            >
              + Fazer Nova Solicitação
            </button>
          </div>
        ) : (
          /* Purchase Request Form */
          <div className="space-y-4">
            <div className="text-center sm:text-left">
              <span className="px-2.5 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 mb-1">
                <Sparkles size={11} /> Requisição de Aquisições
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Formulário de Compras</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Preencha os dados do setor e adicione os itens com link de referência e justificativa.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Origem da Solicitação (Dados & Departamento) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Building size={16} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">1. Origem & Solicitante</h3>
                  </div>

                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PurchasePriority)}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-[10px] font-bold text-amber-400 outline-none cursor-pointer hover:border-slate-600 transition-colors"
                  >
                    <option value="baixa">Prioridade: Baixa</option>
                    <option value="normal">Prioridade: Normal</option>
                    <option value="alta">Prioridade: Alta</option>
                    <option value="urgente">🚨 Prioridade: Urgente</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <User size={11} className="text-blue-400" /> Seu Nome Completo <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Ex: Prof. Mariana Souza"
                      className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none text-xs transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Phone size={11} className="text-blue-400" /> WhatsApp / Contato
                    </label>
                    <input
                      type="text"
                      value={requesterContact}
                      onChange={(e) => setRequesterContact(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none text-xs transition-all"
                    />
                  </div>
                </div>

                {/* Department Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers size={11} className="text-blue-400" /> Departamento / Setor Solicitante <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {DEPARTMENTS.map((dept) => {
                      const isSelected = requesterDepartment === dept;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setRequesterDepartment(dept)}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all text-left border cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                  </div>

                  {requesterDepartment === 'Outro Setor' && (
                    <input
                      type="text"
                      required
                      value={customDepartment}
                      onChange={(e) => setCustomDepartment(e.target.value)}
                      placeholder="Digite o nome do seu setor..."
                      className="w-full h-10 px-3 mt-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none text-xs"
                    />
                  )}
                </div>
              </div>

              {/* 2. Items List (With Per-Item Justification!) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ShoppingBag size={16} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      2. Itens Solicitados ({itemsList.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">
                    Adicione quantos itens forem necessários
                  </span>
                </div>

                {/* List of items */}
                <div className="space-y-3.5">
                  {itemsList.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3 relative transition-all shadow-inner"
                    >
                      {/* Item Card Header */}
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          Item #{index + 1}
                        </span>

                        {itemsList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveItem(item.id, e)}
                            className="text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            title="Remover este item"
                          >
                            <Trash2 size={12} /> Remover Item
                          </button>
                        )}
                      </div>

                      {/* Item Name */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Nome do Item / Material <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          placeholder="Ex: Sensor Ultrassônico HC-SR04 / Livro Didático / Cabo HDMI"
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold placeholder-slate-500 focus:border-amber-400 outline-none text-xs transition-all"
                        />
                      </div>

                      {/* Quantity & Unit & Estimated Price (Clean 2-Column Responsive Layout) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Quantidade & Unidade */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Quantidade & Unidade <span className="text-rose-400">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            {/* Stepper with explicit sizing and min-w-0 */}
                            <div className="flex items-center h-10 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0 w-28">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUpdateItem(item.id, 'quantity', Math.max(1, item.quantity - 1));
                                }}
                                className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-90"
                              >
                                <Minus size={13} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full min-w-0 bg-transparent text-center font-black text-xs text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUpdateItem(item.id, 'quantity', item.quantity + 1);
                                }}
                                className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-90"
                              >
                                <Plus size={13} />
                              </button>
                            </div>

                            {/* Unit */}
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                              className="flex-1 min-w-0 h-10 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none cursor-pointer hover:border-slate-600 transition-colors"
                            >
                              <option value="un">Unidades (un)</option>
                              <option value="cx">Caixas (cx)</option>
                              <option value="pct">Pacotes (pct)</option>
                              <option value="kit">Kits (kit)</option>
                              <option value="m">Metros (m)</option>
                              <option value="par">Pares (par)</option>
                              <option value="rolo">Rolos (rolo)</option>
                            </select>
                          </div>
                        </div>

                        {/* Estimated Price */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Valor Estimado Unitário (R$ - Opcional)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                              R$
                            </span>
                            <input
                              type="text"
                              value={item.estimated_price}
                              onChange={(e) => handleUpdateItem(item.id, 'estimated_price', e.target.value)}
                              placeholder="0,00"
                              className="w-full h-10 pl-9 pr-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold placeholder-slate-500 focus:border-amber-400 outline-none text-xs transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Reference Link */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <Link2 size={11} /> Link de Referência / Produto <span className="text-rose-400">*</span>
                          </label>
                          {item.reference_link.trim() && (
                            <button
                              type="button"
                              onClick={(e) => handleTestLink(item.reference_link, e)}
                              className="text-[10px] font-black text-amber-400 hover:underline uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                            >
                              <ExternalLink size={10} /> Testar Link
                            </button>
                          )}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="url"
                            required
                            value={item.reference_link}
                            onChange={(e) => handleUpdateItem(item.id, 'reference_link', e.target.value)}
                            placeholder="https://www.mercadolivre.com.br/... ou amazon / kalunga"
                            className="w-full h-10 pl-3 pr-20 bg-slate-900 border border-blue-500/40 rounded-xl text-white font-bold placeholder-slate-500 focus:border-blue-400 outline-none text-xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleTestLink(item.reference_link, e)}
                            className="absolute right-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                          >
                            <ExternalLink size={10} /> Abrir
                          </button>
                        </div>
                      </div>

                      {/* Justification PER ITEM (Mandatory) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                          Justificativa deste Item <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={item.justification}
                          onChange={(e) => handleUpdateItem(item.id, 'justification', e.target.value)}
                          placeholder="Por que este item específico é necessário para as aulas, atividades pedagógicas ou reposição?"
                          className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:border-emerald-400 outline-none text-xs resize-none transition-all"
                        />
                      </div>

                      {/* Technical Specs Toggle & Field */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <label className="flex items-center gap-2 cursor-pointer py-0.5 select-none">
                          <input
                            type="checkbox"
                            checked={item.has_technical_specs}
                            onChange={(e) => handleUpdateItem(item.id, 'has_technical_specs', e.target.checked)}
                            className="size-4 rounded accent-amber-400 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-300">
                            Necessita de Especificação Técnica? (Opcional)
                          </span>
                        </label>

                        {/* Recommendation Message & Technical Specs Textarea */}
                        {item.has_technical_specs && (
                          <div className="space-y-2 mt-2 pt-2 border-t border-slate-800 transition-all">
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-amber-300/90 text-[10px] leading-relaxed font-medium">
                              <Info size={15} className="shrink-0 mt-0.5 text-amber-400" />
                              <span>
                                <strong>Recomendação:</strong> As especificações técnicas são recomendadas para itens que necessitam de alta precisão (como voltagem 110V/220V, pinagens específicas, medidas milimétricas, modelos de componentes ou compatibilidade estrita com os computadores e equipamentos da monitoria) para evitar compras incompatíveis.
                              </span>
                            </div>

                            <textarea
                              rows={2}
                              value={item.technical_specs}
                              onChange={(e) => handleUpdateItem(item.id, 'technical_specs', e.target.value)}
                              placeholder="Ex: Voltagem 110V, conector USB-C macho, tamanho 2 metros, compatível com notebook Lenovo..."
                              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:border-amber-400 outline-none text-xs resize-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add item button */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 border border-dashed border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                >
                  <Plus size={16} className="text-amber-400" />
                  Adicionar Outro Item a esta Solicitação
                </button>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-bold animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="size-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={15} />
                    ENVIAR SOLICITAÇÃO ({itemsList.length} ITEM{itemsList.length > 1 ? 'S' : ''})
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
