
import React, { useEffect, useState, useRef } from 'react';
import { getDB } from '../services/db';
import { Product, UnitConversion } from '../types';
import { 
  Plus, Edit, Trash, Search, Image as ImageIcon, 
  Camera, X, Layers, PlusCircle, Download, Upload, 
  FileSpreadsheet, Loader2, Package, Tag, Layers3,
  FileDown
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

  // --- Logika Download Template ---
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Barcode': '899123456789',
        'Nama Produk': 'Indomie Goreng Original',
        'Kategori': 'Mie Instan',
        'Satuan': 'pcs',
        'Stok': 100,
        'Modal': 2500,
        'Jual': 3000,
        'Grosir (Unit:Isi:Harga;...)': 'Renceng:10:28000;Dus:40:105000'
      },
      {
        'Barcode': '8999999112233',
        'Nama Produk': 'Kopi Kapal Api Mix',
        'Kategori': 'Minuman',
        'Satuan': 'sachet',
        'Stok': 200,
        'Modal': 1200,
        'Jual': 1500,
        'Grosir (Unit:Isi:Harga;...)': 'Renceng:10:13500;Dus:120:155000'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Import");
    
    // Auto-width columns
    ws['!cols'] = [
      { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 10 }, 
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 45 }
    ];

    XLSX.writeFile(wb, "Template_Import_Produk_LocalPOS.xlsx");
  };

  const handleExport = () => {
    if (products.length === 0) return alert("Tidak ada data untuk di-export.");
    const data = products.map(p => ({
      'Barcode': p.barcode, 
      'Nama Produk': p.name, 
      'Kategori': p.category,
      'Satuan': p.unit, 
      'Stok': p.stock, 
      'Modal': p.costPrice, 
      'Jual': p.sellPrice,
      'Grosir (Unit:Isi:Harga;...)': p.conversions?.map(c => `${c.unitName}:${c.conversionFactor}:${c.sellPrice}`).join(';') || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar_Produk");
    XLSX.writeFile(wb, `Stok_LocalPOS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- Logika Import yang Diperbarui agar lebih stabil ---
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
        
        if (!jsonData || jsonData.length === 0) {
          throw new Error("File kosong atau format tidak sesuai.");
        }

        const db = await getDB();
        // Gunakan transaksi tunggal untuk kecepatan dan konsistensi
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');

        // Ambil data lama untuk pengecekan duplikasi barcode
        const existingRaw = (await store.getAll()) as Product[];
        const existingMap = new Map<string, Product>(existingRaw.map(p => [String(p.barcode).trim(), p]));

        let successCount = 0;

        for (const row of jsonData) {
          const rawBarcode = String(row['Barcode'] || '').trim();
          const name = String(row['Nama Produk'] || '').trim();
          
          // Skip baris jika Barcode atau Nama kosong
          if (!rawBarcode || !name) continue;

          const existing = existingMap.get(rawBarcode);
          
          // Parse Grosir Multi-Level
          const convStr = String(row['Grosir (Unit:Isi:Harga;...)'] || '');
          const conversions: UnitConversion[] = [];
          
          if (convStr && convStr !== 'undefined' && convStr !== 'null' && convStr.includes(':')) {
            convStr.split(';').forEach(part => {
              const segments = part.split(':');
              if (segments.length >= 3) {
                const uName = segments[0].trim();
                const uFactor = parseFloat(segments[1]);
                const uPrice = parseFloat(segments[2]);
                
                if (uName && !isNaN(uFactor) && !isNaN(uPrice)) {
                  conversions.push({
                    id: uuidv4(),
                    unitName: uName,
                    conversionFactor: uFactor,
                    sellPrice: uPrice
                  });
                }
              }
            });
          }

          const product: Product = {
            id: existing ? existing.id : uuidv4(),
            createdAt: existing ? existing.createdAt : new Date().toISOString(),
            name: name,
            category: String(row['Kategori'] || 'Umum').trim(),
            barcode: rawBarcode,
            unit: String(row['Satuan'] || 'pcs').trim(),
            stock: Number(row['Stok'] || 0),
            costPrice: Number(row['Modal'] || 0),
            sellPrice: Number(row['Jual'] || 0),
            conversions: conversions,
            imageUrl: existing?.imageUrl
          };

          await store.put(product);
          successCount++;
        }
        
        await tx.done;
        await fetchProducts();
        alert(`Berhasil mengimport ${successCount} dari ${jsonData.length} baris data.`);
      } catch (err: any) { 
        console.error("Import Error:", err);
        alert(`Gagal import: ${err.message || 'Format file salah atau rusak.'}`); 
      } finally { 
        setIsImporting(false); 
        if (importInputRef.current) importInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      alert("Gagal membaca file.");
      setIsImporting(false);
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
    if (confirm('Hapus produk ini secara permanen?')) {
      const db = await getDB();
      await db.delete('products', id);
      fetchProducts();
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Katalog Produk</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kelola Stok & Harga Grosir</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={handleDownloadTemplate} 
            className="flex-1 md:flex-none bg-amber-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-amber-600 transition"
          >
            <FileDown size={16}/> Template Import
          </button>
          <button 
            onClick={handleExport} 
            className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition"
          >
            <Download size={16}/> Export Data
          </button>
          <button 
            onClick={() => importInputRef.current?.click()} 
            disabled={isImporting}
            className="flex-1 md:flex-none bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>}
            {isImporting ? 'Memproses...' : 'Import Excel'}
          </button>
          <button 
            onClick={() => { setEditingProduct(null); setFormData(emptyForm); setIsModalOpen(true); }} 
            className="w-full md:w-auto bg-primary text-secondary px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl shadow-amber-100 hover:bg-amber-400 transition"
          >
            <Plus size={18}/> Tambah Manual
          </button>
        </div>
      </div>

      <input type="file" ref={importInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />

      {/* Search Sticky */}
      <div className="relative sticky top-0 z-30 bg-bg py-2">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
         <input 
            type="text" 
            placeholder="Cari nama produk atau barcode..." 
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm outline-none focus:border-primary text-sm font-bold" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
      </div>

      {/* Tampilan Daftar Produk (Sama seperti sebelumnya namun dengan filter dan data yang sudah divalidasi) */}
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
                    <button onClick={() => { setEditingProduct(p); setFormData({...p, imageUrl: p.imageUrl || '', conversions: p.conversions || []}); setIsModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash size={16}/></button>
                  </div>
               </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-400 italic bg-white rounded-3xl border-2 border-dashed border-slate-100">
            {products.length === 0 ? "Belum ada produk. Gunakan tombol Import atau Tambah Manual." : "Produk tidak ditemukan."}
          </div>
        )}
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
                  <div className="flex gap-1 flex-wrap max-w-xs">
                    {p.conversions && p.conversions.map(c => (
                      <span key={c.id} className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                        {c.unitName} (x{c.conversionFactor}): {formatIDR(c.sellPrice)}
                      </span>
                    ))}
                    {(!p.conversions || p.conversions.length === 0) && <span className="text-slate-300 italic text-[10px]">No wholesale</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{p.stock} {p.unit}</span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                   <button onClick={() => { setEditingProduct(p); setFormData({...p, imageUrl: p.imageUrl || '', conversions: p.conversions || []}); setIsModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition"><Edit size={18}/></button>
                   <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[200] flex items-center justify-center p-2">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-300">
             <div className="p-5 bg-secondary text-white flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-tight">{editingProduct ? 'Edit Barang' : 'Barang Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
             </div>
             <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Form manual sama seperti sebelumnya untuk melengkapi fitur edit */}
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
                          <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" placeholder="pcs/sachet"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stok Dasar</label>
                          <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Modal Dasar</label>
                         <input type="number" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-primary font-bold" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Jual Dasar</label>
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
                            <input type="text" value={c.unitName} onChange={e => setFormData({...formData, conversions: formData.conversions.map(x => x.id === c.id ? {...x, unitName: e.target.value} : x)})} className="w-full p-2 text-xs border rounded-lg font-bold" placeholder="Dus"/>
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
                    {formData.conversions.length === 0 && <div className="text-center py-6 text-slate-300 italic text-xs">Aktifkan grosir untuk harga bertingkat (misal: Renceng, Dus)</div>}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t sticky bottom-0 bg-white">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 uppercase text-xs tracking-widest bg-slate-50 rounded-2xl">Batal</button>
                   <button type="submit" className="flex-1 py-4 bg-secondary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all">Simpan Perubahan</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
