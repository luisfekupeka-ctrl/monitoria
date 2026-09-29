import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { PurchaseRequest, PurchaseItem, PurchaseStatus } from '../types';
import { formatDate, formatTime } from './utils';

const LOCAL_STORAGE_KEY = 'sesi_purchases';
const NOTIFICATION_EMAIL_KEY = 'sesi_purchase_notification_email';
export const DEFAULT_NOTIFICATION_EMAIL = 'compras@sesi.org.br';

export function getNotificationEmail(): string {
  try {
    return localStorage.getItem(NOTIFICATION_EMAIL_KEY) || DEFAULT_NOTIFICATION_EMAIL;
  } catch {
    return DEFAULT_NOTIFICATION_EMAIL;
  }
}

export function setNotificationEmail(email: string) {
  try {
    localStorage.setItem(NOTIFICATION_EMAIL_KEY, email.trim());
  } catch (e) {
    console.error('Error saving notification email:', e);
  }
}

// Normalize any purchase request to ensure items array is properly structured
export function normalizePurchaseRequest(raw: any): PurchaseRequest {
  let items: PurchaseItem[] = [];

  if (raw.items) {
    if (typeof raw.items === 'string') {
      try {
        items = JSON.parse(raw.items);
      } catch {
        items = [];
      }
    } else if (Array.isArray(raw.items)) {
      items = raw.items;
    }
  }

  // Fallback for legacy single-item format
  if (!items || items.length === 0) {
    if (raw.item_name) {
      items = [{
        id: 'item-1',
        name: raw.item_name,
        quantity: Number(raw.quantity) || 1,
        unit: raw.unit || 'un',
        reference_link: raw.reference_link || '',
        justification: raw.justification || '',
        estimated_price: raw.estimated_price ? Number(raw.estimated_price) : undefined,
        has_technical_specs: !!(raw.technical_specs && raw.technical_specs.trim()),
        technical_specs: raw.technical_specs || ''
      }];
    }
  }

  // Ensure each item has a justification string
  items = items.map((it, idx) => ({
    id: it.id || `it-${idx + 1}`,
    name: it.name || 'Item',
    quantity: Number(it.quantity) || 1,
    unit: it.unit || 'un',
    reference_link: it.reference_link || '',
    justification: it.justification || raw.justification || '',
    estimated_price: it.estimated_price ? Number(it.estimated_price) : undefined,
    has_technical_specs: !!it.has_technical_specs || !!(it.technical_specs && it.technical_specs.trim()),
    technical_specs: it.technical_specs || ''
  }));

  const primaryItem = items[0] || { name: 'Item', quantity: 1, unit: 'un', reference_link: '', justification: '' };

  return {
    id: raw.id || ('req_' + Date.now()),
    requester_name: raw.requester_name || 'Anônimo',
    requester_department: raw.requester_department || 'Geral',
    requester_contact: raw.requester_contact || '',
    justification: raw.justification || primaryItem.justification || '',
    priority: raw.priority || 'normal',
    items: items,
    item_name: primaryItem.name,
    quantity: primaryItem.quantity,
    unit: primaryItem.unit,
    reference_link: primaryItem.reference_link,
    technical_specs: primaryItem.technical_specs,
    estimated_price: primaryItem.estimated_price,
    status: (raw.status as PurchaseStatus) || 'pending',
    rejection_reason: raw.rejection_reason || '',
    approval_notes: raw.approval_notes || '',
    approved_by: raw.approved_by || '',
    approved_at: raw.approved_at || undefined,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || undefined
  };
}

function getLocalPurchases(): PurchaseRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePurchaseRequest);
  } catch (err) {
    console.error('Error reading local purchases:', err);
    return [];
  }
}

function saveLocalPurchases(list: PurchaseRequest[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving local purchases:', err);
  }
}

export async function fetchPurchaseRequests(): Promise<PurchaseRequest[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase purchase_requests query warning, using local cache:', error.message);
      return getLocalPurchases();
    }

    if (data && Array.isArray(data)) {
      const formatted = data.map(normalizePurchaseRequest);
      saveLocalPurchases(formatted);
      return formatted;
    }
    return getLocalPurchases();
  } catch (err) {
    console.warn('Fetch purchase requests error, falling back to local storage:', err);
    return getLocalPurchases();
  }
}

export async function createPurchaseRequest(
  payload: Omit<PurchaseRequest, 'id' | 'status' | 'created_at'>
): Promise<PurchaseRequest> {
  const newId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  const primaryItem = payload.items?.[0] || {
    id: 'item-1',
    name: payload.item_name || 'Material',
    quantity: payload.quantity || 1,
    unit: payload.unit || 'un',
    reference_link: payload.reference_link || '',
    justification: payload.justification || ''
  };

  const newRequest: PurchaseRequest = {
    ...payload,
    id: newId,
    status: 'pending',
    created_at: new Date().toISOString(),
    priority: payload.priority || 'normal',
    items: payload.items && payload.items.length > 0 ? payload.items : [primaryItem],
    item_name: primaryItem.name,
    quantity: primaryItem.quantity,
    unit: primaryItem.unit,
    reference_link: primaryItem.reference_link,
    justification: primaryItem.justification || payload.justification || '',
    technical_specs: primaryItem.technical_specs,
    estimated_price: primaryItem.estimated_price
  };

  try {
    const { data, error } = await supabase
      .from('purchase_requests')
      .insert([{
        id: newRequest.id,
        requester_name: newRequest.requester_name,
        requester_department: newRequest.requester_department || null,
        requester_contact: newRequest.requester_contact || null,
        item_name: newRequest.item_name,
        quantity: newRequest.quantity,
        unit: newRequest.unit,
        reference_link: newRequest.reference_link,
        justification: newRequest.justification,
        technical_specs: newRequest.technical_specs || null,
        estimated_price: newRequest.estimated_price || null,
        priority: newRequest.priority,
        items: newRequest.items,
        status: 'pending',
        created_at: newRequest.created_at
      }])
      .select()
      .single();

    if (!error && data) {
      const local = getLocalPurchases();
      saveLocalPurchases([newRequest, ...local.filter(i => i.id !== newRequest.id)]);
      return newRequest;
    }
  } catch (err) {
    console.warn('Could not insert to Supabase directly, saving locally:', err);
  }

  const local = getLocalPurchases();
  const updated = [newRequest, ...local.filter(i => i.id !== newRequest.id)];
  saveLocalPurchases(updated);
  return newRequest;
}

export async function updatePurchaseStatus(
  id: string,
  status: PurchaseStatus,
  options?: {
    rejection_reason?: string;
    approval_notes?: string;
    approved_by?: string;
  }
): Promise<PurchaseRequest | null> {
  const now = new Date().toISOString();
  const updatePayload: any = {
    status,
    updated_at: now
  };

  if (status === 'approved') {
    updatePayload.approved_at = now;
    updatePayload.approved_by = options?.approved_by || 'Admin';
    updatePayload.approval_notes = options?.approval_notes || null;
    updatePayload.rejection_reason = null;
  } else if (status === 'rejected') {
    updatePayload.rejection_reason = options?.rejection_reason || 'Não informado';
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
  } else {
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
    updatePayload.rejection_reason = null;
    updatePayload.approval_notes = null;
  }

  try {
    const { error } = await supabase
      .from('purchase_requests')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.warn('Supabase update status failed, updating locally:', error.message);
    }
  } catch (err) {
    console.warn('Supabase update status exception:', err);
  }

  const local = getLocalPurchases();
  let updatedItem: PurchaseRequest | null = null;
  const nextList = local.map(item => {
    if (item.id === id) {
      updatedItem = {
        ...item,
        ...updatePayload,
        status
      };
      return updatedItem;
    }
    return item;
  });

  saveLocalPurchases(nextList);
  return updatedItem;
}

export async function deletePurchaseRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchase_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete error:', error.message);
    }
  } catch (err) {
    console.warn('Supabase delete exception:', err);
  }

  const local = getLocalPurchases();
  saveLocalPurchases(local.filter(i => i.id !== id));
  return true;
}

export async function deleteMultiplePurchaseRequests(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    await supabase
      .from('purchase_requests')
      .delete()
      .in('id', ids);
  } catch (err) {
    console.warn('Supabase bulk delete error:', err);
  }

  const local = getLocalPurchases();
  saveLocalPurchases(local.filter(i => !ids.includes(i.id)));
  return true;
}

export function generatePurchaseEmailData(req: PurchaseRequest, targetEmail?: string) {
  const normalized = normalizePurchaseRequest(req);
  const items = normalized.items;
  const destination = targetEmail || getNotificationEmail();

  const totalEstimatedCost = items.reduce(
    (acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 
    0
  );

  const subject = `[SOLICITAÇÃO DE COMPRAS SESI] Protocolo #${normalized.id.slice(0, 10).toUpperCase()} - ${normalized.requester_department} (${normalized.requester_name})`;

  const bodyLines = [
    `Prezados(as) / Setor Administrativo e de Compras,`,
    ``,
    `Uma nova solicitação de compra de materiais foi registrada no Portal de Monitoria SESI:`,
    ``,
    `========================================`,
    `📋 DADOS DA REQUISIÇÃO`,
    `========================================`,
    `• Protocolo: #${normalized.id.slice(0, 10).toUpperCase()}`,
    `• Solicitante: ${normalized.requester_name}`,
    `• Departamento / Setor: ${normalized.requester_department}`,
    `• Contato / WhatsApp: ${normalized.requester_contact || 'Não informado'}`,
    `• Prioridade: ${(normalized.priority || 'normal').toUpperCase()}`,
    `• Data da Solicitação: ${formatDate(normalized.created_at)} às ${formatTime(normalized.created_at)}`,
    `• Status Atual: EM ESPERA (Aguardando homologação da administração)`,
    ``,
    `========================================`,
    `📦 ITENS SOLICITADOS (${items.length})`,
    `========================================`,
    ...items.map((it, idx) => [
      `ITEM #${idx + 1}: ${it.name}`,
      `   • Quantidade: ${it.quantity} ${it.unit || 'un'}`,
      `   • Valor Estimado Unitário: ${it.estimated_price ? 'R$ ' + Number(it.estimated_price).toFixed(2).replace('.', ',') : 'A cotar'}`,
      `   • Link do Produto: ${it.reference_link}`,
      `   • Justificativa: ${it.justification}`,
      it.technical_specs ? `   • Especificação Técnica: ${it.technical_specs}` : null,
      ``
    ].filter(Boolean).join('\n')),
    `========================================`,
    `💰 Total Estimado do Pedido: ${totalEstimatedCost > 0 ? 'R$ ' + totalEstimatedCost.toFixed(2).replace('.', ',') : 'A cotar'}`,
    `========================================`,
    ``,
    `O documento oficial em PDF desta solicitação foi gerado pelo sistema.`,
    `Para visualizar, aprovar ou homologar, acesse o painel da Monitoria SESI.`
  ];

  const body = bodyLines.join('\n');
  const mailtoUrl = `mailto:${encodeURIComponent(destination)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destination)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent('*SOLICITAÇÃO DE COMPRAS SESI*\nProtocolo: #' + normalized.id.slice(0, 10).toUpperCase() + '\nSolicitante: ' + normalized.requester_name + ' (' + normalized.requester_department + ')\nItens: ' + items.length + ' item(ns)\nTotal Est.: ' + (totalEstimatedCost > 0 ? 'R$ ' + totalEstimatedCost.toFixed(2).replace('.', ',') : 'A cotar') + '\n\nAcesse o painel para verificar os detalhes e aprovação.')}`;

  return { subject, body, destination, mailtoUrl, gmailUrl, whatsAppUrl };
}

export function generatePurchasePDF(req: PurchaseRequest) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const normalized = normalizePurchaseRequest(req);
  const items = normalized.items;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 24, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SESI - SERVIÇO SOCIAL DA INDÚSTRIA', margin, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('MONITORIA & GESTÃO DE ATIVOS • REQUISIÇÃO OFICIAL DE COMPRAS', margin, 16);

  const statusLabel = normalized.status === 'approved' ? 'APROVADO' : normalized.status === 'rejected' ? 'REPROVADO' : 'EM ESPERA';
  const statusBgColor = normalized.status === 'approved' ? [16, 185, 129] : normalized.status === 'rejected' ? [239, 68, 68] : [245, 158, 11];

  doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
  doc.roundedRect(pageWidth - margin - 32, 6, 32, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(statusLabel, pageWidth - margin - 16, 12.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  let currentY = 33;
  doc.text('REQUISIÇÃO DE COMPRA DE MATERIAIS & EQUIPAMENTOS', margin, currentY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  currentY += 4.5;
  doc.text(`Protocolo: #${normalized.id.slice(0, 12).toUpperCase()} • Solicitado em: ${formatDate(normalized.created_at)} às ${formatTime(normalized.created_at)}`, margin, currentY);

  currentY += 4.5;
  const totalEstimatedCost = items.reduce((acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 0);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    bodyStyles: { textColor: [15, 23, 42], fontSize: 7.5, cellPadding: 2.5 },
    head: [['Origem da Solicitação', 'Resumo do Pedido']],
    body: [
      [
        `Solicitante: ${normalized.requester_name || 'N/A'}\nDepartamento/Setor: ${normalized.requester_department || 'Geral'}\nContato: ${normalized.requester_contact || 'Não informado'}`,
        `Qtd. de Itens: ${items.length} item(ns)\nPrioridade: ${(normalized.priority || 'Normal').toUpperCase()}\nTotal Estimado: ${totalEstimatedCost > 0 ? 'R$ ' + totalEstimatedCost.toFixed(2).replace('.', ',') : 'A cotar'}`
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  const tableData = items.map((it, idx) => {
    const priceStr = it.estimated_price ? `R$ ${Number(it.estimated_price).toFixed(2).replace('.', ',')}` : '-';
    let detailsText = `Justificativa: ${it.justification || 'Conforme necessidade da disciplina/setor'}`;
    if (it.technical_specs && it.technical_specs.trim()) {
      detailsText += `\nEspecificação: ${it.technical_specs.trim()}`;
    }
    return [(idx + 1).toString(), it.name, `${it.quantity} ${it.unit || 'un'}`, priceStr, it.reference_link || '-', detailsText];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 38, fontStyle: 'bold' }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 18, halign: 'right' }, 4: { cellWidth: 42 }, 5: { cellWidth: 'auto' } },
    head: [['#', 'Item / Material', 'Qtd', 'Valor Est.', 'Link do Produto (Clique)', 'Justificativa & Detalhes Técnicos']],
    body: tableData,
    didDrawCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const itemIdx = data.row.index;
        const linkUrl = items[itemIdx]?.reference_link;
        if (linkUrl && /^https?:\/\//i.test(linkUrl)) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: linkUrl });
        }
      }
    },
    willDrawCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        doc.setTextColor(37, 99, 235);
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 18;
  }

  if (normalized.status === 'approved') {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, currentY, contentWidth, 18, 1.5, 1.5, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('AUTORIZAÇÃO DA ADMINISTRAÇÃO SESI', margin + 3, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.text(`Aprovado por: ${normalized.approved_by || 'Administrador'} em ${formatDate(normalized.approved_at || normalized.updated_at || new Date())}`, margin + 3, currentY + 10);
    if (normalized.approval_notes) {
      doc.text(`Parecer: ${normalized.approval_notes}`, margin + 3, currentY + 14);
    }
    currentY += 22;
  } else if (normalized.status === 'rejected') {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 18, 1.5, 1.5, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SOLICITAÇÃO REPROVADA / ARQUIVADA', margin + 3, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.text(`Motivo da recusa: ${normalized.rejection_reason || 'Não informado'}`, margin + 3, currentY + 10);
    currentY += 22;
  } else {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(margin, currentY, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('AGUARDANDO PARECER DA ADMINISTRAÇÃO / HOMOLOGAÇÃO', margin + 3, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Esta solicitação foi protocolada e aguarda avaliação formal da gestão para prosseguimento de cotação e compra.', margin + 3, currentY + 9);
    currentY += 16;
  }

  currentY = Math.max(currentY + 6, pageHeight - 28);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  doc.line(margin + 5, currentY, margin + 70, currentY);
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(normalized.requester_name || 'Solicitante Responsável', margin + 37.5, currentY + 4, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(normalized.requester_department || 'Setor Solicitante', margin + 37.5, currentY + 7.5, { align: 'center' });

  doc.line(pageWidth - margin - 70, currentY, pageWidth - margin - 5, currentY);
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(normalized.approved_by ? `${normalized.approved_by} (Aprovação)` : 'Coordenação / Gestão de Compras', pageWidth - margin - 37.5, currentY + 4, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('SESI Escola Internacional', pageWidth - margin - 37.5, currentY + 7.5, { align: 'center' });

  const cleanName = (normalized.requester_name || 'solicitacao').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`SESI_Solicitacao_Compra_${cleanName}_${normalized.id.slice(0, 8)}.pdf`);
}

export function generatePurchaseDoc(req: PurchaseRequest) {
  const normalized = normalizePurchaseRequest(req);
  const items = normalized.items;
  const totalCost = items.reduce((acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 0);

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Solicitação de Compras - SESI</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.4; }
        .header { background-color: #0F4C81; color: white; padding: 15px; border-radius: 4px; }
        .header h1 { margin: 0; font-size: 16pt; }
        .header p { margin: 4px 0 0 0; font-size: 9pt; }
        .badge { display: inline-block; padding: 4px 10px; background-color: #F59E0B; color: #000; font-weight: bold; border-radius: 4px; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background-color: #0F4C81; color: white; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 9.5pt; }
        td { border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; vertical-align: top; }
        .section-title { font-size: 12pt; font-weight: bold; color: #0F4C81; margin-top: 20px; border-bottom: 2px solid #0F4C81; padding-bottom: 4px; }
        .footer { margin-top: 30px; font-size: 9pt; color: #64748b; }
        a { color: #2563eb; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SESI - SERVIÇO SOCIAL DA INDÚSTRIA</h1>
        <p>MONITORIA & GESTÃO DE ATIVOS • REQUISIÇÃO DE COMPRAS</p>
      </div>

      <div style="margin-top: 15px;">
        <span class="badge">STATUS: ${(normalized.status || 'EM ESPERA').toUpperCase()}</span>
        <span style="float: right; font-size: 9pt; color: #64748b;">Protocolo: #${normalized.id.toUpperCase()}</span>
      </div>

      <div class="section-title">1. Dados do Solicitante & Origem</div>
      <table>
        <tr>
          <td><strong>Solicitante:</strong> ${normalized.requester_name}</td>
          <td><strong>Departamento / Setor:</strong> ${normalized.requester_department}</td>
        </tr>
        <tr>
          <td><strong>Contato / WhatsApp:</strong> ${normalized.requester_contact || 'Não informado'}</td>
          <td><strong>Prioridade:</strong> ${(normalized.priority || 'Normal').toUpperCase()}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Data da Solicitação:</strong> ${formatDate(normalized.created_at)} às ${formatTime(normalized.created_at)}</td>
        </tr>
      </table>

      <div class="section-title">2. Itens Solicitados (${items.length})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 30%;">Item / Material</th>
            <th style="width: 10%;">Qtd</th>
            <th style="width: 15%;">Valor Estimado</th>
            <th style="width: 40%;">Link & Justificativa</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td><strong>${it.name}</strong></td>
              <td style="text-align: center;">${it.quantity} ${it.unit || 'un'}</td>
              <td>${it.estimated_price ? 'R$ ' + Number(it.estimated_price).toFixed(2).replace('.', ',') : 'A cotar'}</td>
              <td>
                <a href="${it.reference_link}">${it.reference_link}</a><br/>
                <em>Justificativa:</em> ${it.justification}
                ${it.technical_specs ? '<br/><strong>Especificações Técnicas:</strong> ' + it.technical_specs : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="text-align: right; font-weight: bold; margin-top: 10px;">
        Total Estimado: ${totalCost > 0 ? 'R$ ' + totalCost.toFixed(2).replace('.', ',') : 'A cotar'}
      </p>

      <div class="footer">
        <br/><br/>
        <table style="border: none;">
          <tr>
            <td style="border: none; text-align: center; width: 50%;">
              ___________________________________________<br/>
              <strong>${normalized.requester_name}</strong><br/>
              ${normalized.requester_department}
            </td>
            <td style="border: none; text-align: center; width: 50%;">
              ___________________________________________<br/>
              <strong>Coordenação / Gestão de Compras</strong><br/>
              SESI Escola Internacional
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = (normalized.requester_name || 'solicitacao').replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `SESI_Solicitacao_${cleanName}_${normalized.id.slice(0, 8)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPurchasesToExcel(requests: PurchaseRequest[]) {
  const flattenedRows: any[] = [];
  requests.forEach(req => {
    const normalized = normalizePurchaseRequest(req);
    normalized.items.forEach(it => {
      flattenedRows.push({
        'Protocolo': '#' + normalized.id.slice(0, 8).toUpperCase(),
        'Data': formatDate(normalized.created_at),
        'Setor': normalized.requester_department,
        'Solicitante': normalized.requester_name,
        'Item': it.name,
        'Quantidade': it.quantity,
        'Unidade': it.unit || 'un',
        'Valor Estimado (R$)': it.estimated_price || '',
        'Link de Referência': it.reference_link,
        'Justificativa do Item': it.justification,
        'Especificação Técnica': it.technical_specs || '',
        'Status': normalized.status.toUpperCase(),
        'Prioridade': normalized.priority.toUpperCase()
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(flattenedRows);
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 45 }, { wch: 35 },
    { wch: 30 }, { wch: 14 }, { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Compras');
  XLSX.writeFile(workbook, `SESI_Relatorio_Compras_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
