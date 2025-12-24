
import React, { useEffect, useState, useRef } from 'react';
import { getDB } from '../services/db';
import { Product, UnitConversion } from '../types';
import { 
  Plus, Edit, Trash, Search, Image as ImageIcon, 
  Camera, X, Layers, PlusCircle, Download, Upload, 
  FileSpreadsheet, Loader2, Package, Tag, Layers3
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Add formatIDR helper function
  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const emptyForm = {
    name: '', category: '', barcode: '', costPrice: 0, sellPrice: 0, stock: 0, 
    unit: 'pcs', imageUrl: '', conversions: [] as UnitConversion[]
  };
  const [formData, setFormData] = useState(emptyForm);

  const fetchProducts = async () => {
    const db = await getDB();
    const data = await db.getAll('products');
    setProducts(data);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleExport = () => {
    if (products.length === 0) return alert("Tidak ada data.");
    const data = products.map(p => ({
      'Barcode': p.barcode, 'Nama Produk': p.name, 'Kategori': p.category,
      'Satuan': p.unit, 'Stok': p.stock, 'Modal': p.costPrice, 'Jual': p.sellPrice
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produk");
    XLSX.writeFile(wb, `Stok_LocalPOS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        const db = await getDB();
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        for (const row of jsonData) {
          const product: Product = {
            id: uuidv4(), name: String(row['Nama Produk']), category: String(row['Kategori']),
            barcode: String(row['Barcode']), unit: String(row['Satuan']), stock: Number(row['Stok']),
            costPrice: Number(row['Modal']), sellPrice: Number(row['Jual']), conversions: [],
            createdAt: new Date().toISOString()
          };
          await store.put(product);
        }
        await tx.done;
        fetchProducts();
        alert('Import Berhasil!');
      } catch (err) { alert("Gagal import"); } finally { setIsImporting(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDB();
    const payload: Product = {
      id: editingProduct ? editingProduct.id : uuidv4(),
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      ...formData,
      costPrice: Number(formData.costPrice),
      sellPrice: Number(formData.sellPrice),
      stock: Number(formData.stock),
      imageUrl: formData.imageUrl || undefined
    };
    await db.put('products', payload);
    setIsModalOpen(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus produk?')) {
      const db = await getDB();
      await db.delete('products', id);
      fetchProducts();
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Katalog Produk</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Stok & Harga Satuan</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button onClick={handleExport} className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg"><Download size={16}/> Export</button>
          <button onClick={() => importInputRef.current?.click()} className="flex-1 md:flex-none bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg"><Upload size={16}/> Import</button>
          <button onClick={() => { setEditingProduct(null); setFormData(emptyForm); setIsModalOpen(true); }} className="w-full md:w-auto bg-primary text-secondary px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl shadow-amber-100"><Plus size={18}/> Tambah</button>
        </div>
      </div>

      <input type="file" ref={importInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />

      {/* Search Sticky */}
      <div className="relative sticky top-0 z-30 bg-bg py-2">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
         <input type="text" placeholder="Cari nama atau barcode..." className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm outline-none focus:border-primary text-sm font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.map(p => (
          <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border-2 border-slate-50 flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
               {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Package className="m-auto mt-6 text-slate-300" size={32} />}
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>Stok: {p.stock}</div>
               </div>
               <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.barcode}</p>
               <div className="mt-2 flex items-center justify-between">
                  <span className="text-secondary font-black text-sm">{formatIDR(p.sellPrice)} <span className="text-[10px] text-slate-400 font-normal">/ {p.unit}</span></span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingProduct(p); setFormData({...p, imageUrl: p.imageUrl || ''}); setIsModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash size={16}/></button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Produk</th>
              <th className="px-6 py-4">Harga Jual</th>
              <th className="px-6 py-4">Grosir</th>
              <th className="px-6 py-4">Stok</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                    {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Package size={16} className="m-auto mt-3 text-slate-300"/>}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase">{p.barcode}</div>
                  </div>
                </td>
                <td className="px-6 py-4 font-black text-secondary">{formatIDR(p.sellPrice)} <span className="text-[9px] font-bold text-slate-400">/{p.unit}</span></td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {p.conversions.map(c => (
                      <span key={c.id} className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{c.unitName}</span>
                    ))}
                    {p.conversions.length === 0 && <span className="text-slate-300 italic text-[10px]">No wholesale</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{p.stock} {p.unit}</span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                   <button onClick={() => { setEditingProduct(p); setFormData({...p, imageUrl: p.imageUrl || ''}); setIsModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition"><Edit size={18}/></button>
                   <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[200] flex items-center justify-center p-2">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-300">
             <div className="p-5 bg-secondary text-white flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-tight">{editingProduct ? 'Edit Barang' : 'Barang Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
             </div>
             <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="flex flex-col items-center">
                        <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl flex items-center justify-center cursor-pointer hover:border-primary overflow-hidden relative group">
                            {formData.imageUrl ? <img src={formData.imageUrl} className="w-full h-full object-cover" /> : <div className="text-center text-slate-300 font-black text-[10px] uppercase"><Camera size={32} className="mx-auto mb-2 opacity-50"/> Foto Produk</div>}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase">Ubah</div>
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => setFormData({...formData, imageUrl: ev.target?.result as string});
                            reader.readAsDataURL(file);
                          }
                        }} className="hidden" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Barang</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Barcode</label>
                           <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori</label>
                           <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                         </div>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Satuan Dasar</label>
                          <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" placeholder="pcs/dus"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stok Saat Ini</label>
                          <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modal Satuan (COGS)</label>
                         <input type="number" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Jual Satuan</label>
                         <input type="number" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: Number(e.target.value)})} className="w-full p-3 bg-primary/10 border-2 border-primary/20 rounded-xl outline-none focus:border-primary font-black text-secondary" />
                      </div>
                   </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-secondary text-xs uppercase tracking-widest flex items-center gap-2"><Layers3 size={18} className="text-primary"/> Satuan Grosir Multi-Level</h4>
                    <button type="button" onClick={() => setFormData({...formData, conversions: [...formData.conversions, { id: uuidv4(), unitName: '', conversionFactor: 1, sellPrice: 0 }]})} className="text-primary font-black text-[10px] uppercase flex items-center gap-1 hover:scale-105 transition-transform"><PlusCircle size={16}/> Tambah Level</button>
                  </div>
                  <div className="space-y-3">
                    {formData.conversions.map(c => (
                      <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-12 gap-3 items-end relative">
                         <button type="button" onClick={() => setFormData({...formData, conversions: formData.conversions.filter(x => x.id !== c.id)})} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110"><X size={12}/></button>
                         <div className="col-span-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nama Unit</label>
                            <input type="text" value={c.unitName} onChange={e => setFormData({...formData, conversions: formData.conversions.map(x => x.id === c.id ? {...x, unitName: e.target.value} : x)})} className="w-full p-2 text-xs border rounded-lg font-bold" placeholder="Contoh: Dus"/>
                         </div>
                         <div className="col-span-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Isi per Unit</label>
                            <input type="number" value={c.conversionFactor} onChange={e => setFormData({...formData, conversions: formData.conversions.map(x => x.id === c.id ? {...x, conversionFactor: Number(e.target.value)} : x)})} className="w-full p-2 text-xs border rounded-lg font-bold" />
                         </div>
                         <div className="col-span-5">
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Harga Jual Unit</label>
                            <input type="number" value={c.sellPrice} onChange={e => setFormData({...formData, conversions: formData.conversions.map(x => x.id === c.id ? {...x, sellPrice: Number(e.target.value)} : x)})} className="w-full p-2 text-xs border rounded-lg font-black text-blue-600" />
                         </div>
                      </div>
                    ))}
                    {formData.conversions.length === 0 && <div className="text-center py-6 text-slate-300 italic text-xs">Klik "Tambah Level" untuk harga grosir bertingkat</div>}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t sticky bottom-0 bg-white">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 uppercase text-xs tracking-widest bg-slate-50 rounded-2xl">Batal</button>
                   <button type="submit" className="flex-1 py-4 bg-secondary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all">Simpan Katalog</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
