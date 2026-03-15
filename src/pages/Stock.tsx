import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileUp, 
  FileDown, 
  Tag, 
  Search, 
  Edit2, 
  Trash2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { Product, Beneficiary } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Stock() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const isAdmin = user?.role === 'admin';
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchBeneficiaries();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) {
      setProducts(data.map(p => ({
        ...p,
        minQuantity: p.min_quantity
      })));
    }
  };

  const fetchBeneficiaries = async () => {
    const { data } = await supabase.from('professors').select('*');
    if (data) {
      setBeneficiaries(data);
    }
  };

  const handleExportExcel = () => {
    try {
      // Prepare data for export with proper headers
      const exportData = products.map(p => ({
        'Nome': p.name,
        'Categoria': p.category,
        'Código': p.code,
        'Quantidade': p.quantity,
        'Unidade': p.unit,
        'Mínimo': p.minQuantity
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Estoque");
      
      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `estoque_sesi_${date}.xlsx`);
    } catch (err) {
      alert('Erro ao exportar Excel: Verifique se os dados estão carregados corretamente.');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Estoque - Monitoria SESI", 14, 15);
    (doc as any).autoTable({
      head: [['Nome', 'Categoria', 'Código', 'Qtd', 'Mín']],
      body: products.map(p => [p.name, p.category, p.code, p.quantity, p.minQuantity]),
      startY: 20,
    });
    doc.save("estoque_sesi.pdf");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const mappedData = data.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name,
        category: p.category,
        code: p.code,
        quantity: Number(p.quantity),
        min_quantity: Number(p.minQuantity),
        unit: p.unit
      }));
      
      await supabase.from('products').insert(mappedData);
      fetchProducts();
    };
    reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => {
    const name = p.name || '';
    const code = p.code || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    const matchesStatus = !statusFilter || 
                         (statusFilter === 'low' && p.quantity <= (p.minQuantity ?? 0)) ||
                         (statusFilter === 'normal' && p.quantity > (p.minQuantity ?? 0));
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Estoque de Produtos</h2>
          <p className="text-slate-500 mt-1">Gerencie a disponibilidade de itens e níveis críticos em tempo real.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <>
              <button 
                onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 bg-sesi-yellow text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-400 transition-all"
              >
                <Plus size={18} />
                Adicionar produto
              </button>
              <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer">
                <FileUp size={18} />
                Importar Excel
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
              </label>
            </>
          )}
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
          >
            <FileDown size={18} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm) {
                // If BIP scans a code, we can auto-select if unique
                const match = products.find(p => p.code === searchTerm);
                if (match) {
                  setEditingProduct(match);
                  setMovementType('out');
                  setIsMovementModalOpen(true);
                  setSearchTerm('');
                }
              }
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm"
          />
        </div>
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm text-slate-600"
        >
          <option value="">Todas as Categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-sesi-blue/20 text-sm text-slate-600 font-medium"
        >
          <option value="">Status do Estoque</option>
          <option value="low" className="text-red-500">Estoque Baixo</option>
          <option value="normal" className="text-green-500">Normal</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Produto</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Quantidade</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Mínima</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.tr 
                  key={product.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <Tag size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900 leading-tight">{product.name}</p>
                      <p className="text-xs text-slate-500">REF: {product.code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{product.category}</td>
                <td className={cn(
                  "px-6 py-4 text-sm font-bold text-center",
                  product.quantity <= product.minQuantity ? "text-red-600" : "text-slate-900"
                )}>
                  {product.quantity} {product.unit}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 text-center">{product.minQuantity}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                    product.quantity <= product.minQuantity 
                      ? "bg-red-50 text-red-600" 
                      : "bg-emerald-50 text-emerald-600"
                  )}>
                    {product.quantity <= product.minQuantity ? 'Baixo' : 'Normal'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => { 
                        setEditingProduct(product);
                        setMovementType('in');
                        setIsMovementModalOpen(true); 
                      }}
                      className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Dar Entrada"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={() => { 
                        setEditingProduct(product); 
                        setMovementType('out');
                        setIsMovementModalOpen(true); 
                      }}
                      className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                      title="Dar Saída"
                    >
                      <X size={16} />
                    </button>
                    {isAdmin && (
                      <div className="flex gap-1 border-l border-slate-100 pl-2 ml-1">
                        <button 
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(`
                                <html>
                                  <head><title>Etiqueta ${product.code}</title></head>
                                  <body style="display:flex;flex-direction:column;align-items:center;justify-center;font-family:sans-serif;padding:20px;">
                                    <div style="border:2px solid black;padding:20px;text-align:center;">
                                      <h2 style="margin:0 0 10px 0;font-size:24px;">SESI MONITORIA</h2>
                                      <div id="qrcode"></div>
                                      <p style="font-weight:bold;margin:10px 0 0 0;font-size:18px;">${product.name}</p>
                                      <p style="margin:5px 0 0 0;font-family:monospace;font-size:14px;">${product.code}</p>
                                    </div>
                                    <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
                                    <script>
                                      var qr = qrcode(0, 'M');
                                      qr.addData('${product.code}');
                                      qr.make();
                                      document.getElementById('qrcode').innerHTML = qr.createImgTag(5);
                                      setTimeout(() => window.print(), 500);
                                    </script>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-sesi-yellow transition-colors"
                          title="Imprimir Etiqueta"
                        >
                          <FileUp size={16} />
                        </button>
                        <button 
                          onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-sesi-blue transition-colors"
                          title="Editar Produto"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm(`Deseja excluir o produto ${product.name}?`)) {
                              try {
                                const { error } = await supabase.from('products').delete().eq('id', product.id);
                                if (error) {
                                  if (error.code === '23503') {
                                    alert('Não é possível excluir este produto pois existem movimentações vinculadas a ele.');
                                  } else {
                                    alert('Erro ao excluir: ' + error.message);
                                  }
                                  return;
                                }
                                fetchProducts();
                              } catch (err) {
                                alert('Erro inesperado ao excluir.');
                              }
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Exibindo {filteredProducts.length} produtos</p>
        </div>
      </div>

      {/* Modal for Stock Movement */}
      {isMovementModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className={cn(
              "p-6 border-b border-slate-100 flex items-center justify-between",
              movementType === 'in' ? "bg-emerald-50" : "bg-orange-50"
            )}>
              <div>
                <h3 className={cn(
                  "text-xl font-black",
                  movementType === 'in' ? "text-emerald-700" : "text-orange-700"
                )}>
                  {movementType === 'in' ? 'Entrada de Estoque' : 'Saída de Estoque'}
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{editingProduct.name}</p>
              </div>
              <button onClick={() => setIsMovementModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const quantity = Number(formData.get('quantity'));
              const beneficiaryId = formData.get('beneficiaryId') as string;
              
              const newQuantity = movementType === 'in' 
                ? editingProduct.quantity + quantity 
                : editingProduct.quantity - quantity;

              if (newQuantity < 0) {
                alert('Quantidade insuficiente em estoque!');
                return;
              }

              const beneficiary = beneficiaries.find(b => b.id === beneficiaryId);

              await supabase.from('products')
                .update({ quantity: newQuantity })
                .eq('id', editingProduct.id);

              // Log movement
              await supabase.from('stock_movements').insert({
                id: Date.now().toString(),
                product_id: editingProduct.id,
                product_name: editingProduct.name,
                type: movementType,
                quantity: quantity,
                date: new Date().toISOString(),
                operator_name: user?.name || 'Monitor',
                // beneficiaryId is not in stock_movements table yet, but we have product_id
              });
              
              setIsMovementModalOpen(false);
              setSelectedBeneficiaryId('');
              fetchProducts();
            }}>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Quantidade ({editingProduct.unit})</label>
                <input 
                  name="quantity" 
                  type="number" 
                  min="1"
                  required 
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  className="w-full h-14 px-4 bg-slate-50 border-slate-100 rounded-2xl focus:ring-2 focus:ring-sesi-blue/20 outline-none text-2xl font-black text-center" 
                />
                <p className="text-center text-xs text-slate-400">Estoque atual: <span className="font-bold">{editingProduct.quantity}</span></p>
              </div>

              {movementType === 'out' && (
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Destino (Pessoa ou Local)</label>
                  <select 
                    name="beneficiaryId"
                    value={selectedBeneficiaryId}
                    onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                    required
                    className="w-full h-12 px-4 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none text-sm font-bold text-slate-700"
                  >
                    <option value="">Selecione o destino...</option>
                    {beneficiaries.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsMovementModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={cn(
                    "flex-1 py-4 text-white font-black rounded-2xl transition-all shadow-lg",
                    movementType === 'in' 
                      ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                      : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
                  )}
                >
                  Confirmar {movementType === 'in' ? 'Entrada' : 'Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              const pId = editingProduct ? editingProduct.id : Date.now().toString();
              const sbPayload = {
                id: pId,
                name: data.name as string,
                category: data.category as string,
                code: data.code as string,
                quantity: Number(data.quantity),
                min_quantity: Number(data.minQuantity),
                unit: data.unit as string
              };

              if (editingProduct) {
                await supabase.from('products').update(sbPayload).eq('id', pId);
              } else {
                await supabase.from('products').insert(sbPayload);
              }
              
              setIsModalOpen(false);
              fetchProducts();
            }}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nome do Produto</label>
                <input name="name" defaultValue={editingProduct?.name} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Categoria</label>
                  <input name="category" defaultValue={editingProduct?.category} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Código</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const randomCode = 'P' + Math.floor(1000 + Math.random() * 9000);
                        const codeInput = document.getElementsByName('code')[0] as HTMLInputElement;
                        if (codeInput) codeInput.value = randomCode;
                      }}
                      className="text-[10px] font-black text-sesi-blue hover:underline uppercase tracking-widest"
                    >
                      Gerar Código
                    </button>
                  </div>
                  <input name="code" defaultValue={editingProduct?.code} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" placeholder="Bip o código ou gere um..." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Qtd Atual</label>
                  <input name="quantity" type="number" defaultValue={editingProduct?.quantity} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Qtd Mínima</label>
                  <input name="minQuantity" type="number" defaultValue={editingProduct?.minQuantity} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Unidade</label>
                  <input name="unit" defaultValue={editingProduct?.unit || 'un'} required className="w-full px-4 py-2 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-sesi-blue/20 outline-none" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-sesi-yellow text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20">
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
