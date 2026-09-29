import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { PurchaseRequest, PurchaseStatus } from '../types';
import { formatDate, formatTime } from './utils';

const LOCAL_STORAGE_KEY = 'sesi_purchases';

// Helper to get local purchases cache
function getLocalPurchases(): PurchaseRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
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
      const formatted: PurchaseRequest[] = data.map((item: any) => ({
        id: item.id,
        requester_name: item.requester_name || 'Anônimo',
        requester_department: item.requester_department || '',
        requester_contact: item.requester_contact || '',
        item_name: item.item_name || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'un',
        reference_link: item.reference_link || '',
        justification: item.justification || '',
        technical_specs: item.technical_specs || '',
        estimated_price: item.estimated_price ? Number(item.estimated_price) : undefined,
        priority: item.priority || 'normal',
        status: (item.status as PurchaseStatus) || 'pending',
        rejection_reason: item.rejection_reason || '',
        approval_notes: item.approval_notes || '',
        approved_by: item.approved_by || '',
        approved_at: item.approved_at || undefined,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || undefined
      }));

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
 * Create a new purchase request
 */
export async function createPurchaseRequest(
  payload: Omit<PurchaseRequest, 'id' | 'status' | 'created_at'>
): Promise<PurchaseRequest> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);

  const newRequest: PurchaseRequest = {
    ...payload,
    id: newId,
    status: 'pending',
    created_at: new Date().toISOString(),
    quantity: Number(payload.quantity) || 1,
    unit: payload.unit || 'un',
    priority: payload.priority || 'normal'
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
    // Reset to pending
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
 * Generate official Purchase Authorization PDF with clickable reference link
 */
export function generatePurchasePDF(req: PurchaseRequest) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(15, 76, 129); // SESI Deep Blue
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Yellow Accent Line
  doc.setFillColor(245, 158, 11); // SESI Yellow
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SESI - SERVIÇO SOCIAL DA INDÚSTRIA', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('MONITORIA & GESTÃO DE ATIVOS • CONTROLE DE AQUISIÇÕES', margin, 18);

  // Status Badge in Header
  const statusLabel = req.status === 'approved' 
    ? 'APROVADO' 
    : req.status === 'rejected' 
      ? 'REPROVADO' 
      : 'EM ESPERA';
  
  const statusBgColor = req.status === 'approved' 
    ? [16, 185, 129] // Emerald
    : req.status === 'rejected' 
      ? [239, 68, 68] // Rose
      : [245, 158, 11]; // Amber

  doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
  doc.roundedRect(pageWidth - margin - 35, 8, 35, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(statusLabel, pageWidth - margin - 17.5, 15.5, { align: 'center' });

  // Title
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  let currentY = 40;
  doc.text('SOLICITAÇÃO DE COMPRA DE MATERIAL', margin, currentY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  currentY += 6;
  doc.text(`Protocolo: #${req.id.slice(0, 12).toUpperCase()} • Emitido em: ${formatDate(new Date())} às ${formatTime(new Date())}`, margin, currentY);

  // Solicitante Information Table
  currentY += 6;
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 8.5,
      cellPadding: 3.5
    },
    head: [['Dados do Solicitante', 'Detalhes do Pedido']],
    body: [
      [
        `Nome: ${req.requester_name || 'N/A'}\nSetor/Depto: ${req.requester_department || 'Não informado'}\nContato: ${req.requester_contact || 'Não informado'}`,
        `Data da Solicitação: ${formatDate(req.created_at)} (${formatTime(req.created_at)})\nPrioridade: ${(req.priority || 'Normal').toUpperCase()}\nValor Estimado: ${req.estimated_price ? `R$ ${Number(req.estimated_price).toFixed(2).replace('.', ',')}` : 'A cotar'}`
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Item Details Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59]
    },
    head: [['Item / Equipamento / Material', 'Quantidade', 'Unidade', 'Prioridade']],
    body: [
      [
        req.item_name,
        req.quantity.toString(),
        req.unit || 'un',
        (req.priority || 'Normal').toUpperCase()
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Justification Section Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'FD');

  doc.setTextColor(15, 76, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('JUSTIFICATIVA DA NECESSIDADE:', margin + 4, currentY + 6);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitJustification = doc.splitTextToSize(req.justification || 'Nenhuma justificativa informada.', contentWidth - 8);
  doc.text(splitJustification, margin + 4, currentY + 12);

  currentY += 32;

  // Technical Specs Box
  if (req.technical_specs && req.technical_specs.trim()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

    doc.setTextColor(15, 76, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OBSERVAÇÕES E ESPECIFICAÇÕES TÉCNICAS:', margin + 4, currentY + 6);

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const splitSpecs = doc.splitTextToSize(req.technical_specs, contentWidth - 8);
    doc.text(splitSpecs, margin + 4, currentY + 12);

    currentY += 30;
  }

  // Reference Link Section (Interactive Clickable Link)
  doc.setFillColor(239, 246, 255); // Light Blue BG
  doc.setDrawColor(191, 219, 254); // Blue border
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('LINK DE REFERÊNCIA / PRODUTO (CLIQUE PARA ABRIR):', margin + 4, currentY + 6);

  const cleanUrl = req.reference_link || 'https://';
  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  
  // Truncate or split long url visually but keep link functional
  const displayUrl = cleanUrl.length > 90 ? cleanUrl.substring(0, 87) + '...' : cleanUrl;
  doc.textWithLink(displayUrl, margin + 4, currentY + 14, { url: cleanUrl });
  
  // Underline
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.2);
  const textWidth = Math.min(doc.getTextWidth(displayUrl), contentWidth - 8);
  doc.line(margin + 4, currentY + 15, margin + 4 + textWidth, currentY + 15);

  currentY += 32;

  // Approval / Signature Section
  if (req.status === 'approved') {
    doc.setFillColor(236, 253, 245); // Emerald bg
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'FD');

    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('AUTORIZAÇÃO DA ADMINISTRAÇÃO SESI', margin + 4, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    const approvedDateStr = req.approved_at ? `${formatDate(req.approved_at)} às ${formatTime(req.approved_at)}` : formatDate(new Date());
    doc.text(`Aprovado por: ${req.approved_by || 'Administrador'} em ${approvedDateStr}`, margin + 4, currentY + 14);
    if (req.approval_notes) {
      doc.text(`Observações do Administrador: "${req.approval_notes}"`, margin + 4, currentY + 20);
    }

    currentY += 34;
  } else if (req.status === 'rejected') {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('SOLICITAÇÃO REPROVADA PELA ADMINISTRAÇÃO', margin + 4, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`Motivo da Rejeição: ${req.rejection_reason || 'Item não aprovado para compra no momento.'}`, margin + 4, currentY + 14);

    currentY += 28;
  }

  // Signature lines at bottom
  const signatureY = pageHeight - 34;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  // Left signature (Solicitante)
  doc.line(margin + 10, signatureY, margin + 70, signatureY);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(req.requester_name || 'Assinatura do Solicitante', margin + 40, signatureY + 4, { align: 'center' });

  // Right signature (Administrador)
  doc.line(pageWidth - margin - 70, signatureY, pageWidth - margin - 10, signatureY);
  doc.text('Assinatura da Monitoria / Gestão', pageWidth - margin - 40, signatureY + 4, { align: 'center' });

  // Footer text
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Sistema de Monitoria SESI • Gestão de Ativos e Suprimentos • Documento gerado automaticamente', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Download PDF
  const sanitizedItem = (req.item_name || 'item').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  doc.save(`solicitacao_compra_sesi_${sanitizedItem}_${req.id.slice(0, 6)}.pdf`);
}

/**
 * Generate and download Word Document (.doc / HTML compatible) with reference link
 */
export function generatePurchaseDoc(req: PurchaseRequest) {
  const statusLabel = req.status === 'approved' ? 'APROVADO' : req.status === 'rejected' ? 'REPROVADO' : 'EM ESPERA';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Solicitação de Compra - SESI Monitoria</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
        .header { background: #0f4c81; color: white; padding: 20px; border-radius: 8px; }
        .badge { display: inline-block; padding: 4px 12px; background: #f59e0b; color: white; font-weight: bold; border-radius: 4px; }
        .badge-approved { background: #10b981; }
        .badge-rejected { background: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
        th { background: #f1f5f9; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
        .link-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; }
        a { color: #2563eb; font-weight: bold; word-break: break-all; }
        .signature-table { margin-top: 50px; border: none; }
        .signature-table td { border: none; text-align: center; padding-top: 40px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>SESI - SERVIÇO SOCIAL DA INDÚSTRIA</h2>
        <p>MONITORIA & GESTÃO DE ATIVOS • SOLICITAÇÃO DE COMPRA</p>
      </div>

      <p style="margin-top: 20px;">
        <strong>Protocolo:</strong> #${req.id.slice(0, 10).toUpperCase()} | 
        <strong>Status:</strong> <span class="badge ${req.status === 'approved' ? 'badge-approved' : req.status === 'rejected' ? 'badge-rejected' : ''}">${statusLabel}</span> |
        <strong>Data:</strong> ${formatDate(req.created_at)}
      </p>

      <table>
        <tr>
          <th>Solicitante</th>
          <td>${req.requester_name || 'N/A'}</td>
          <th>Setor / Depto</th>
          <td>${req.requester_department || 'Não informado'}</td>
        </tr>
        <tr>
          <th>Item Solicitado</th>
          <td><strong>${req.item_name}</strong></td>
          <th>Quantidade</th>
          <td>${req.quantity} ${req.unit || 'un'}</td>
        </tr>
        <tr>
          <th>Prioridade</th>
          <td>${(req.priority || 'Normal').toUpperCase()}</td>
          <th>Valor Estimado</th>
          <td>${req.estimated_price ? `R$ ${Number(req.estimated_price).toFixed(2).replace('.', ',')}` : 'A cotar'}</td>
        </tr>
      </table>

      <div class="box">
        <strong>Justificativa da Necessidade:</strong>
        <p>${req.justification || 'N/A'}</p>
      </div>

      ${req.technical_specs ? `
      <div class="box">
        <strong>Observações / Especificações Técnicas:</strong>
        <p>${req.technical_specs}</p>
      </div>` : ''}

      <div class="link-box">
        <strong>Link de Referência do Produto:</strong><br>
        <a href="${req.reference_link}" target="_blank">${req.reference_link}</a>
      </div>

      ${req.status === 'approved' ? `
      <div class="box" style="background: #ecfdf5; border-color: #a7f3d0; margin-top: 15px;">
        <strong style="color: #065f46;">Autorização da Administração SESI:</strong>
        <p style="color: #047857;">Aprovado por: ${req.approved_by || 'Admin'} em ${req.approved_at ? formatDate(req.approved_at) : formatDate(new Date())}</p>
        ${req.approval_notes ? `<p style="color: #047857;">Obs: ${req.approval_notes}</p>` : ''}
      </div>` : ''}

      <table class="signature-table">
        <tr>
          <td>________________________________________<br><strong>${req.requester_name}</strong><br>Solicitante</td>
          <td>________________________________________<br><strong>Administração / Monitoria SESI</strong><br>Aprovador Responsável</td>
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
  const sanitizedItem = (req.item_name || 'item').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  a.href = url;
  a.download = `solicitacao_compra_sesi_${sanitizedItem}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export purchases to Excel (XLSX)
 */
export function exportPurchasesToExcel(purchases: PurchaseRequest[]) {
  const exportData = purchases.map(p => ({
    'Protocolo': p.id.slice(0, 10).toUpperCase(),
    'Solicitante': p.requester_name,
    'Setor/Depto': p.requester_department || '',
    'Contato': p.requester_contact || '',
    'Item': p.item_name,
    'Quantidade': p.quantity,
    'Unidade': p.unit || 'un',
    'Prioridade': (p.priority || 'Normal').toUpperCase(),
    'Valor Estimado (R$)': p.estimated_price || 0,
    'Status': p.status === 'approved' ? 'Aprovado' : p.status === 'rejected' ? 'Reprovado' : 'Em Espera',
    'Link de Referência': p.reference_link,
    'Justificativa': p.justification,
    'Especificações': p.technical_specs || '',
    'Data Solicitação': formatDate(p.created_at) + ' ' + formatTime(p.created_at),
    'Aprovado Por': p.approved_by || '',
    'Data Aprovação': p.approved_at ? formatDate(p.approved_at) : '',
    'Motivo Rejeição': p.rejection_reason || ''
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitações de Compras');
  XLSX.writeFile(wb, `compras_sesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
