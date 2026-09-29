import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { PurchaseRequest, PurchaseItem, PurchaseStatus } from '../types';
import { formatDate, formatTime } from './utils';

const LOCAL_STORAGE_KEY = 'sesi_purchases';

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
    id: raw.id,
    requester_name: raw.requester_name || 'Anônimo',
    requester_department: raw.requester_department || 'Geral',
    requester_contact: raw.requester_contact || '',
    justification: raw.justification || primaryItem.justification || '',
    priority: raw.priority || 'normal',
    items: items,
    // Convenience single-item access
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

// Helper to get local purchases cache
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

// Helper to save local purchases cache
function saveLocalPurchases(list: PurchaseRequest[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving local purchases:', err);
  }
}

/**
 * Fetch all purchase requests from Supabase with localStorage sync fallback
 */
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

/**
 * Create a new multi-item purchase request
 */
export async function createPurchaseRequest(
  payload: Omit<PurchaseRequest, 'id' | 'status' | 'created_at'>
): Promise<PurchaseRequest> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);

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

  // Try inserting into Supabase
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
        items: newRequest.items, // JSON array with per-item justification & specs
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

  // Local fallback
  const local = getLocalPurchases();
  const updated = [newRequest, ...local.filter(i => i.id !== newRequest.id)];
  saveLocalPurchases(updated);
  return newRequest;
}

/**
 * Update purchase request status (Approve, Reject, or Reset to Pending)
 */
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

  // Update local storage
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

/**
 * Delete a purchase request permanently
 */
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

/**
 * Delete multiple purchase requests (e.g. all rejected)
 */
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

/**
 * Generate structured multi-item Purchase Authorization PDF with clickable reference links & per-item justifications
 */
export function generatePurchasePDF(req: PurchaseRequest) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const normalized = normalizePurchaseRequest(req);
  const items = normalized.items;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(15, 76, 129); // SESI Deep Blue
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Gold Accent Line
  doc.setFillColor(245, 158, 11); // SESI Yellow
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SESI - SERVIÇO SOCIAL DA INDÚSTRIA', margin, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('MONITORIA & GESTÃO DE ATIVOS • REQUISIÇÃO OFICIAL DE COMPRAS', margin, 16);

  // Status Badge in Header
  const statusLabel = normalized.status === 'approved' 
    ? 'APROVADO' 
    : normalized.status === 'rejected' 
      ? 'REPROVADO' 
      : 'EM ESPERA';
  
  const statusBgColor = normalized.status === 'approved' 
    ? [16, 185, 129] // Emerald
    : normalized.status === 'rejected' 
      ? [239, 68, 68] // Rose
      : [245, 158, 11]; // Amber

  doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
  doc.roundedRect(pageWidth - margin - 32, 6, 32, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(statusLabel, pageWidth - margin - 16, 12.5, { align: 'center' });

  // Title
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  let currentY = 33;
  doc.text('REQUISIÇÃO DE COMPRA DE MATERIAIS & EQUIPAMENTOS', margin, currentY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  currentY += 4.5;
  doc.text(`Protocolo: #${normalized.id.slice(0, 12).toUpperCase()} • Solicitado em: ${formatDate(normalized.created_at)} às ${formatTime(normalized.created_at)}`, margin, currentY);

  // Solicitante & Department Information Table
  currentY += 4.5;
  const totalEstimatedCost = items.reduce((acc, it) => acc + ((it.estimated_price || 0) * (it.quantity || 1)), 0);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 7.5,
      cellPadding: 2.5
    },
    head: [['Origem da Solicitação', 'Resumo do Pedido']],
    body: [
      [
        `Solicitante: ${normalized.requester_name || 'N/A'}\nDepartamento/Setor: ${normalized.requester_department || 'Geral'}\nContato: ${normalized.requester_contact || 'Não informado'}`,
        `Qtd. de Itens: ${items.length} item(ns)\nPrioridade: ${(normalized.priority || 'Normal').toUpperCase()}\nTotal Estimado: ${totalEstimatedCost > 0 ? `R$ ${totalEstimatedCost.toFixed(2).replace('.', ',')}` : 'A cotar'}`
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Table of Items with per-item Justification and clickable Links
  const tableData = items.map((it, idx) => {
    const priceStr = it.estimated_price 
      ? `R$ ${Number(it.estimated_price).toFixed(2).replace('.', ',')}` 
      : '-';
    
    let detailsText = `Justificativa: ${it.justification || 'Conforme necessidade da disciplina/setor'}`;
    if (it.technical_specs && it.technical_specs.trim()) {
      detailsText += `\nEspecificação: ${it.technical_specs.trim()}`;
    }

    return [
      (idx + 1).toString(),
      it.name,
      `${it.quantity} ${it.unit || 'un'}`,
      priceStr,
      it.reference_link || '-',
      detailsText
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 42 },
      5: { cellWidth: 'auto' }
    },
    head: [['#', 'Item / Material', 'Qtd', 'Valor Est.', 'Link do Produto (Clique)', 'Justificativa & Detalhes Técnicos']],
    body: tableData,
    didDrawCell: (data) => {
      // Hyperlink on Column 4 (Link do Produto)
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

  // Check page overflow for signatures
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 18;
  }

  // Approval section
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
    const approvedDateStr = normalized.approved_at ? `${formatDate(normalized.approved_at)} às ${formatTime(normalized.approved_at)}` : formatDate(new Date());
    doc.text(`Aprovado por: ${normalized.approved_by || 'Administrador'} em ${approvedDateStr}`, margin + 3, currentY + 10);
    if (normalized.approval_notes) {
      doc.text(`Orientações: "${normalized.approval_notes}"`, margin + 3, currentY + 14.5);
    }

    currentY += 23;
  } else if (normalized.status === 'rejected') {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'FD');

    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SOLICITAÇÃO REPROVADA PELA ADMINISTRAÇÃO', margin + 3, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.text(`Motivo da Reprovação: ${normalized.rejection_reason || 'Item não autorizado para aquisição.'}`, margin + 3, currentY + 10);

    currentY += 21;
  }

  // Signature lines at bottom
  const signatureY = pageHeight - 26;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  // Left signature (Solicitante)
  doc.line(margin + 10, signatureY, margin + 70, signatureY);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(normalized.requester_name || 'Assinatura do Solicitante', margin + 40, signatureY + 3.5, { align: 'center' });

  // Right signature (Administrador)
  doc.line(pageWidth - margin - 70, signatureY, pageWidth - margin - 10, signatureY);
  doc.text('Assinatura da Monitoria / Gestão', pageWidth - margin - 40, signatureY + 3.5, { align: 'center' });

  // Footer text
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Sistema de Monitoria SESI • Gestão de Ativos e Suprimentos • Documento gerado automaticamente', pageWidth / 2, pageHeight - 6, { align: 'center' });

  // Download PDF
  const sanitizedName = (items[0]?.name || 'itens').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  doc.save(`solicitacao_compra_sesi_${sanitizedName}_${normalized.id.slice(0, 6)}.pdf`);
}

/**
 * Generate Word Document (.doc / HTML compatible) with per-item justifications
 */
export function generatePurchaseDoc(req: PurchaseRequest) {
  const normalized = normalizePurchaseRequest(req);
  const items = normalized.items;
  const statusLabel = normalized.status === 'approved' ? 'APROVADO' : normalized.status === 'rejected' ? 'REPROVADO' : 'EM ESPERA';
  
  const itemsRows = items.map((it, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
      <td><strong>${it.name}</strong></td>
      <td style="text-align: center;">${it.quantity} ${it.unit || 'un'}</td>
      <td style="text-align: right;">${it.estimated_price ? `R$ ${Number(it.estimated_price).toFixed(2).replace('.', ',')}` : '-'}</td>
      <td><a href="${it.reference_link}" target="_blank">${it.reference_link}</a></td>
      <td>
        <strong>Justificativa:</strong> ${it.justification || 'N/A'}<br>
        ${it.technical_specs ? `<strong>Especificação:</strong> ${it.technical_specs}` : ''}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Solicitação de Compra - SESI Monitoria</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #1e293b; }
        .header { background: #0f4c81; color: white; padding: 15px; border-radius: 6px; }
        .badge { display: inline-block; padding: 3px 8px; background: #f59e0b; color: white; font-weight: bold; border-radius: 4px; font-size: 11px; }
        .badge-approved { background: #10b981; }
        .badge-rejected { background: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #cbd5e1; padding: 7px; font-size: 12px; text-align: left; }
        th { background: #f1f5f9; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 12px; }
        a { color: #2563eb; font-weight: bold; word-break: break-all; }
        .signature-table { margin-top: 35px; border: none; }
        .signature-table td { border: none; text-align: center; padding-top: 25px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2 style="margin: 0; font-size: 18px;">SESI - SERVIÇO SOCIAL DA INDÚSTRIA</h2>
        <p style="margin: 3px 0 0 0; font-size: 12px;">MONITORIA & GESTÃO DE ATIVOS • REQUISIÇÃO DE COMPRAS</p>
      </div>

      <p style="margin-top: 15px; font-size: 12px;">
        <strong>Protocolo:</strong> #${normalized.id.slice(0, 10).toUpperCase()} | 
        <strong>Status:</strong> <span class="badge ${normalized.status === 'approved' ? 'badge-approved' : normalized.status === 'rejected' ? 'badge-rejected' : ''}">${statusLabel}</span> |
        <strong>Data:</strong> ${formatDate(normalized.created_at)} |
        <strong>Solicitante:</strong> ${normalized.requester_name} |
        <strong>Setor:</strong> ${normalized.requester_department || 'Geral'}
      </p>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Qtd</th>
            <th>Valor Est.</th>
            <th>Link de Referência</th>
            <th>Justificativa & Especificação Técnica</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      ${normalized.status === 'approved' ? `
      <div class="box" style="background: #ecfdf5; border-color: #a7f3d0;">
        <strong style="color: #065f46;">Autorização da Administração SESI:</strong>
        <p style="color: #047857; margin: 3px 0 0 0; font-size: 12px;">
          Aprovado por: ${normalized.approved_by || 'Admin'} em ${normalized.approved_at ? formatDate(normalized.approved_at) : formatDate(new Date())}
          ${normalized.approval_notes ? `<br>Obs: ${normalized.approval_notes}` : ''}
        </p>
      </div>` : ''}

      <table class="signature-table">
        <tr>
          <td>________________________________________<br><strong>${normalized.requester_name}</strong><br>Solicitante</td>
          <td>________________________________________<br><strong>Administração SESI</strong><br>Aprovador Responsável</td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + htmlContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const sanitizedItem = (items[0]?.name || 'itens').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  a.href = url;
  a.download = `solicitacao_compra_sesi_${sanitizedItem}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export ONLY the 4 requested columns to Excel with clickable hyperlinks:
 * 1. Item
 * 2. Quantidade
 * 3. Valor Estimado
 * 4. Link de Referência (Clickable hyperlink in Excel)
 */
export function exportPurchasesToExcel(purchases: PurchaseRequest[]) {
  const rows: Array<{
    item: string;
    quantidade: string;
    valorEstimado: string;
    link: string;
  }> = [];

  purchases.forEach(req => {
    const normalized = normalizePurchaseRequest(req);
    normalized.items.forEach(it => {
      rows.push({
        item: it.name,
        quantidade: `${it.quantity} ${it.unit || 'un'}`,
        valorEstimado: it.estimated_price ? `R$ ${Number(it.estimated_price).toFixed(2).replace('.', ',')}` : 'A cotar',
        link: it.reference_link || ''
      });
    });
  });

  if (rows.length === 0) {
    alert('Nenhum item disponível para exportar.');
    return;
  }

  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [
    ['Item', 'Quantidade', 'Valor Estimado', 'Link de Referência']
  ];

  rows.forEach(r => {
    wsData.push([r.item, r.quantidade, r.valorEstimado, r.link]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set clickable hyperlinks for column D (Link de Referência)
  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const cellRef = `D${rowNum}`;
    if (r.link && /^https?:\/\//i.test(r.link)) {
      if (ws[cellRef]) {
        ws[cellRef].l = { Target: r.link, Tooltip: 'Abrir link de compra' };
      }
    }
  });

  ws['!cols'] = [
    { wch: 35 },
    { wch: 15 },
    { wch: 18 },
    { wch: 65 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Lista de Compras');
  XLSX.writeFile(wb, `lista_de_compras_sesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
