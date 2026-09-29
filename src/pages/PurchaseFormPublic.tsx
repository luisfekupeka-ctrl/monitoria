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
  ArrowLeft,
  Link2,
  HelpCircle,
  Clock,
  User,
  Building,
  Phone,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPurchaseRequest, generatePurchasePDF, generatePurchaseDoc } from '../lib/purchasesService';
import { PurchasePriority, PurchaseRequest } from '../types';

export default function PurchaseFormPublic() {
  const [requesterName, setRequesterName] = useState('');
  const [requesterDepartment, setRequesterDepartment] = useState('');
  const [requesterContact, setRequesterContact] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('un');
  const [referenceLink, setReferenceLink] = useState('');
  const [justification, setJustification] = useState('');
  const [technicalSpecs, setTechnicalSpecs] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<string>('');
  const [priority, setPriority] = useState<PurchasePriority>('normal');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<PurchaseRequest | null>(null);

  const handleTestLink = () => {
    if (!referenceLink.trim()) {
      alert('Por favor, informe o link antes de testar.');
      return;
    }
    let url = referenceLink.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validations
    if (!requesterName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    if (!itemName.trim()) {
      setErrorMessage('Por favor, informe o nome ou descrição do item solicitado.');
      return;
    }

    if (quantity < 1) {
      setErrorMessage('A quantidade mínima solicitada deve ser 1.');
      return;
    }

    if (!referenceLink.trim()) {
      setErrorMessage('O link de referência do produto é obrigatório.');
      return;
    }

    let formattedUrl = referenceLink.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    if (!justification.trim() || justification.trim().length < 10) {
      setErrorMessage('Por favor, apresente uma justificativa detalhada (mínimo 10 caracteres).');
      return;
    }

    setIsLoading(true);

    try {
      const created = await createPurchaseRequest({
        requester_name: requesterName.trim(),
        requester_department: requesterDepartment.trim() || undefined,
        requester_contact: requesterContact.trim() || undefined,
        item_name: itemName.trim(),
        quantity: Number(quantity),
        unit: unit.trim() || 'un',
        reference_link: formattedUrl,
        justification: justification.trim(),
        technical_specs: technicalSpecs.trim() || undefined,
        estimated_price: estimatedPrice ? parseFloat(estimatedPrice.replace(',', '.')) : undefined,
        priority: priority
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
    setItemName('');
    setQuantity(1);
    setReferenceLink('');
    setJustification('');
    setTechnicalSpecs('');
    setEstimatedPrice('');
    setPriority('normal');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white font-sans selection:bg-amber-400 selection:text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight leading-tight">Monitoria SESI</h1>
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Portal de Requisição de Compras</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Online
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          {submittedRequest ? (
            /* Success State */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-800/90 border border-emerald-500/30 rounded-[2.5rem] p-8 md:p-12 shadow-2xl backdrop-blur-xl relative overflow-hidden text-center"
            >
              <div className="size-24 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={48} />
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-widest mb-3">
                <Clock size={14} />
                Em Espera (Aguardando Aprovação)
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Solicitação Enviada com Sucesso!</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 font-medium">
                Seu pedido foi registrado e encaminhado diretamente para a avaliação do administrador da Monitoria.
              </p>

              <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 text-left space-y-4 mb-8">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocolo</span>
                  <span className="text-xs font-mono font-black text-emerald-400">#{submittedRequest.id.slice(0, 10).toUpperCase()}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Solicitante</span>
                    <span className="text-sm font-bold text-slate-200">{submittedRequest.requester_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Item</span>
                    <span className="text-sm font-bold text-slate-200">{submittedRequest.item_name} ({submittedRequest.quantity} {submittedRequest.unit || 'un'})</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Justificativa</span>
                  <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-white/5 italic">
                    "{submittedRequest.justification}"
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Link de Referência</span>
                  <a 
                    href={submittedRequest.reference_link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 break-all underline"
                  >
                    <Link2 size={14} className="shrink-0" />
                    {submittedRequest.reference_link}
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => generatePurchasePDF(submittedRequest)}
                  className="py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Download size={16} />
                  Baixar Comprovante PDF
                </button>

                <button
                  type="button"
                  onClick={() => generatePurchaseDoc(submittedRequest)}
                  className="py-4 px-6 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <FileText size={16} />
                  Baixar em Word (.doc)
                </button>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="mt-6 text-xs font-black text-slate-400 hover:text-amber-400 uppercase tracking-widest transition-colors inline-block"
              >
                + Fazer Outra Solicitação de Compra
              </button>
            </motion.div>
          ) : (
            /* Purchase Request Form */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center md:text-left mb-6">
                <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 mb-2">
                  <Sparkles size={12} /> Formulário de Aquisições
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Solicitar Novo Material / Equipamento</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Preencha os dados do item com link de referência e justificativa. O pedido será encaminhado para aprovação da administração.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Solicitante Section */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-[2rem] p-6 md:p-8 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-blue-400">
                    <User size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">1. Identificação do Solicitante</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Seu Nome Completo <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Ex: Prof. Carlos Eduardo"
                      className="w-full h-14 px-5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Setor / Disciplina / Departamento
                      </label>
                      <input
                        type="text"
                        value={requesterDepartment}
                        onChange={(e) => setRequesterDepartment(e.target.value)}
                        placeholder="Ex: Robótica / Laboratório / TI"
                        className="w-full h-14 px-5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Telefone / WhatsApp / E-mail
                      </label>
                      <input
                        type="text"
                        value={requesterContact}
                        onChange={(e) => setRequesterContact(e.target.value)}
                        placeholder="(11) 99999-9999 ou email"
                        className="w-full h-14 px-5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Item Details Section */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-[2rem] p-6 md:p-8 space-y-5 shadow-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-amber-400">
                    <ShoppingBag size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">2. Detalhes do Item Solicitado</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nome do Item / Material / Equipamento <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Ex: Cabo HDMI 5m / Kit Sensores Arduino / Caneta para Mesa Digitalizadora"
                      className="w-full h-14 px-5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-amber-400 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Quantity with +/- */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Quantidade <span className="text-rose-400">*</span>
                      </label>
                      <div className="flex items-center h-14 bg-slate-900/90 border-2 border-slate-700 rounded-2xl p-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="size-11 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Minus size={18} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 bg-transparent text-center font-black text-lg text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(quantity + 1)}
                          className="size-11 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Unit */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Unidade
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full h-14 px-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold focus:border-amber-400 outline-none text-sm cursor-pointer"
                      >
                        <option value="un">Unidades (un)</option>
                        <option value="cx">Caixas (cx)</option>
                        <option value="pct">Pacotes (pct)</option>
                        <option value="kit">Kit</option>
                        <option value="m">Metros (m)</option>
                        <option value="par">Pares</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Prioridade / Urgência
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as PurchasePriority)}
                        className="w-full h-14 px-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold focus:border-amber-400 outline-none text-sm cursor-pointer"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">🚨 Urgente</option>
                      </select>
                    </div>
                  </div>

                  {/* Reference Link */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-blue-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Link2 size={14} /> Link de Referência (Obrigatório) <span className="text-rose-400">*</span>
                      </label>
                      {referenceLink.trim() && (
                        <button
                          type="button"
                          onClick={handleTestLink}
                          className="text-[10px] font-black text-amber-400 hover:underline uppercase tracking-wider flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Testar Link
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="url"
                        required
                        value={referenceLink}
                        onChange={(e) => setReferenceLink(e.target.value)}
                        placeholder="https://www.mercadolivre.com.br/... ou amazon / kalunga..."
                        className="w-full h-14 pl-5 pr-28 bg-slate-900/90 border-2 border-blue-500/40 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-blue-400 outline-none transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleTestLink}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-xl text-xs font-black transition-colors flex items-center gap-1"
                      >
                        <ExternalLink size={14} /> Abrir
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 ml-1">
                      Cole o link do anúncio, loja online ou catálogo onde o produto pode ser cotado ou comprado.
                    </p>
                  </div>

                  {/* Estimated Price (Optional) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Valor Unitário Estimado (R$ - Opcional)
                    </label>
                    <input
                      type="text"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(e.target.value)}
                      placeholder="Ex: 49,90"
                      className="w-full h-14 px-5 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-bold placeholder-slate-500 focus:border-amber-400 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Justification & Specs Section */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-[2rem] p-6 md:p-8 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-emerald-400">
                    <FileText size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">3. Justificativa & Especificações</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Justificativa da Necessidade <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="Explique por que este item é necessário para as aulas, atividades pedagógicas ou manutenção dos equipamentos..."
                      className="w-full p-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-medium placeholder-slate-500 focus:border-emerald-400 outline-none transition-all text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Observações / Especificação Técnica (Caso Necessite)
                    </label>
                    <textarea
                      rows={3}
                      value={technicalSpecs}
                      onChange={(e) => setTechnicalSpecs(e.target.value)}
                      placeholder="Ex: Voltagem 110V/220V, conector USB-C, modelo compatível com notebook Lenovo, cor preta, tamanho específico..."
                      className="w-full p-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl text-white font-medium placeholder-slate-500 focus:border-emerald-400 outline-none transition-all text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-bold"
                  >
                    <AlertCircle size={18} className="shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="size-6 border-3 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      ENVIAR SOLICITAÇÃO PARA APROVAÇÃO
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-500 font-medium">
                  Após o envio, a solicitação entrará no status <strong>"Em Espera"</strong> para aprovação pelo administrador.
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
