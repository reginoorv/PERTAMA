
import React, { useState, useEffect, useRef } from 'react';
import { getDB, saveTransaction } from '../services/db';
import { Product, Customer, CartItem, Settings, SaleItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, Plus, Minus, Trash2, Save, ShoppingCart, 
  Package, UserCheck, X, Send, Printer, ArrowRight,
  ChevronRight, CreditCard
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const POS: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(''); 
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lastSale, setLastSale] = useState<{sale: any, items: any[], customerName?: string} | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  useEffect(() => {
    const initData = async () => {
      const db = await getDB();
      setProducts(await db.getAll('products'));
      setCustomers(await db.getAll('customers'));
      const s = await db.get('settings', 'config');
      setSettings(s || null);
    };
    initData();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Stok habis!");
    setCart(prev => {
      const exist = prev.find(item => item.id === product.id);
      if (exist) {
        if ((exist.qty + 1) * exist.selectedUnit.factor > product.stock) {
           alert(`Stok hanya tersedia ${product.stock}`);
           return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { 
        ...product, qty: 1, 
        selectedUnit: { unitName: product.unit, factor: 1, price: product.sellPrice } 
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        if (newQty * item.selectedUnit.factor > item.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const changeUnit = (itemId: string, unitName: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        let newUnit;
        if (unitName === item.unit) {
          newUnit = { unitName: item.unit, factor: 1, price: item.sellPrice };
        } else {
          const conv = item.conversions.find(c => c.unitName === unitName);
          if (conv) newUnit = { unitName: conv.unitName, factor: conv.conversionFactor, price: conv.sellPrice };
        }
        if (newUnit && item.qty * newUnit.factor <= item.stock) return { ...item, selectedUnit: newUnit };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.selectedUnit.price * item.qty), 0);
  const cashVal = parseInt(cashAmount.replace(/\D/g, '')) || 0;
  const change = cashVal - subtotal;
  
  const handleSave = async () => {
    if (cart.length === 0) return;
    if (paymentType === 'cash' && cashVal < subtotal) return alert('Uang kurang!');
    if (paymentType === 'debt' && !selectedCustomer) return alert('Pilih pelanggan!');

    setLoading(true);
    try {
      const saleId = uuidv4();
      const timestamp = new Date().toISOString();
      const saleItems: SaleItem[] = cart.map(item => ({
        id: uuidv4(), saleId, productId: item.id, productName: item.name, quantity: item.qty,
        unitName: item.selectedUnit.unitName, conversionFactor: item.selectedUnit.factor,
        unitPrice: item.selectedUnit.price, totalPrice: item.selectedUnit.price * item.qty,
        costPrice: item.costPrice * item.selectedUnit.factor
      }));

      const saleData = {
        id: saleId, dateTime: timestamp, customerId: selectedCustomer || undefined,
        cashierUserId: user?.id || 'unknown', totalAmount: subtotal, paymentType,
        paidAmount: paymentType === 'cash' ? cashVal : 0, changeAmount: paymentType === 'cash' ? change : 0, note
      };

      await saveTransaction(saleData, saleItems, paymentType === 'debt' ? {
        id: uuidv4(), customerId: selectedCustomer, saleId, amount: subtotal, createdAt: timestamp
      } : undefined);

      setLastSale({ sale: saleData, items: saleItems, customerName: selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : 'Umum' });
      setCart([]); setCashAmount(''); setNote(''); setPaymentType('cash');
      setShowCartDrawer(false);
      setShowReceiptModal(true);
    } catch (e) { alert('Gagal simpan!'); } finally { setLoading(false); }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery));

  return (
    <div className="relative h-full flex flex-col">
      {/* Header POS */}
      <div className="mb-4 space-y-3">
        <h2 className="text-xl font-bold text-secondary hidden md:block">Kasir Pintar</h2>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Cari produk atau scan barcode..." 
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-primary transition-all shadow-sm text-lg" 
          />
        </div>
      </div>

      {/* Grid Produk Adaptif */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {filteredProducts.map(p => (
            <div 
              key={p.id} 
              onClick={() => addToCart(p)} 
              className="bg-white rounded-2xl border-2 border-transparent hover:border-primary transition shadow-sm active:scale-95 cursor-pointer flex flex-col overflow-hidden"
            >
              <div className="aspect-square bg-slate-50 flex items-center justify-center relative">
                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Package className="text-slate-200" size={40} />}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${p.stock < 10 ? 'bg-red-500 text-white' : 'bg-success text-white'}`}>
                  Stok: {p.stock}
                </div>
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <h4 className="text-[11px] md:text-xs font-bold text-slate-700 leading-tight line-clamp-2">{p.name}</h4>
                <div className="mt-2 text-secondary font-black text-sm">{formatIDR(p.sellPrice)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Button (Mobile) & Fixed Panel (Desktop) */}
      <div className="fixed bottom-20 left-4 right-4 lg:static lg:mt-6 z-40">
        <button 
          onClick={() => setShowCartDrawer(true)}
          disabled={cart.length === 0}
          className="w-full bg-secondary text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
        >
          <div className="flex items-center gap-3">
             <div className="relative">
               <ShoppingCart size={24} className="text-primary" />
               <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black border-2 border-secondary">{cart.length}</span>
             </div>
             <div className="text-left hidden sm:block">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Cek Keranjang</p>
                <p className="text-lg font-black">{formatIDR(subtotal)}</p>
             </div>
             <div className="sm:hidden text-lg font-black">{formatIDR(subtotal)}</div>
          </div>
          <div className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
            Bayar Sekarang <ChevronRight size={20} />
          </div>
        </button>
      </div>

      {/* Cart Drawer / Modal Pembayaran */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-[100] flex flex-col lg:flex-row">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCartDrawer(false)} />
          
          <div className="relative mt-auto lg:mt-0 lg:ml-auto h-[90vh] lg:h-full w-full lg:max-w-2xl bg-white rounded-t-3xl lg:rounded-none flex flex-col shadow-2xl overflow-hidden">
             <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white z-10">
               <div>
                 <h3 className="text-xl font-black text-secondary uppercase tracking-tight">Rincian Pesanan</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">LocalPOS Grocery</p>
               </div>
               <button onClick={() => setShowCartDrawer(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={24}/></button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
               {cart.map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
                      {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <Package className="text-slate-300 m-auto mt-4" size={24}/>}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <select 
                          value={item.selectedUnit.unitName} 
                          onChange={(e) => changeUnit(item.id, e.target.value)}
                          className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border-none focus:ring-0"
                        >
                          <option value={item.unit}>{item.unit}</option>
                          {item.conversions?.map(c => <option key={c.id} value={c.unitName}>{c.unitName}</option>)}
                        </select>
                        <span className="text-xs font-bold text-slate-400">@ {formatIDR(item.selectedUnit.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Minus size={16}/></button>
                       <span className="font-black text-secondary w-6 text-center">{item.qty}</span>
                       <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-secondary shadow-md"><Plus size={16}/></button>
                    </div>
                    <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                 </div>
               ))}
             </div>

             <div className="p-6 bg-white border-t space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Pelanggan</label>
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-primary">
                      <option value="">Umum / Eceran</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Metode</label>
                    <div className="flex gap-2">
                      <button onClick={() => setPaymentType('cash')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase border-2 transition-all ${paymentType === 'cash' ? 'bg-secondary text-white border-secondary shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>Tunai</button>
                      <button onClick={() => setPaymentType('debt')} disabled={!selectedCustomer} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase border-2 transition-all ${paymentType === 'debt' ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'} disabled:opacity-30`}>Kasbon</button>
                    </div>
                  </div>
                </div>

                {paymentType === 'cash' && (
                  <div className="bg-secondary p-5 rounded-2xl shadow-inner flex flex-col items-center">
                    <label className="text-[10px] font-black text-blue-300 uppercase mb-2 tracking-[0.2em]">Input Pembayaran Tunai</label>
                    <input 
                      type="number" 
                      value={cashAmount} 
                      onChange={e => setCashAmount(e.target.value)} 
                      className="bg-transparent text-white text-center text-4xl font-black outline-none placeholder:text-white/20 w-full"
                      placeholder="0"
                      autoFocus
                    />
                    <div className="w-full flex justify-between mt-4 pt-4 border-t border-white/10">
                       <span className="text-xs font-bold text-blue-200">KEMBALIAN</span>
                       <span className={`text-xl font-black ${change < 0 ? 'text-red-400' : 'text-primary'}`}>{formatIDR(change)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-2">
                   <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Total Tagihan</span>
                   <span className="text-3xl font-black text-secondary tracking-tighter">{formatIDR(subtotal)}</span>
                </div>

                <button 
                  onClick={handleSave} 
                  disabled={loading || cart.length === 0} 
                  className="w-full bg-success text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent animate-spin rounded-full"/> : <><Save size={24}/> Proses Transaksi</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Modal Struk Tetap Sama */}
      {showReceiptModal && lastSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-secondary/90 backdrop-blur-lg p-4">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
              <div className="p-6 bg-secondary text-white flex justify-between items-center">
                 <div>
                    <h3 className="font-black text-xs uppercase tracking-widest text-primary">Sukses</h3>
                    <p className="text-lg font-bold">Transaksi Disimpan</p>
                 </div>
                 <button onClick={() => setShowReceiptModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col items-center gap-6">
                 <div id="printable-receipt" className="w-full max-w-[80mm] p-6 bg-white shadow-xl font-mono text-[10px] leading-relaxed text-black rounded-lg border-2 border-slate-100">
                    <div className="text-center mb-6">
                       <h2 className="font-black text-sm uppercase mb-1 tracking-tight">{settings?.storeName}</h2>
                       <p className="text-[9px] opacity-70 leading-tight">{settings?.storeAddress}</p>
                    </div>
                    <div className="border-b border-dashed border-black/30 my-4"></div>
                    <div className="space-y-3 mb-6">
                       {lastSale.items.map((i: any) => (
                          <div key={i.id}>
                             <div className="font-bold uppercase mb-0.5">{i.productName}</div>
                             <div className="flex justify-between">
                                <span>{i.quantity} {i.unitName} @{i.unitPrice.toLocaleString()}</span>
                                <span>{i.totalPrice.toLocaleString()}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="border-b border-dashed border-black/30 my-4"></div>
                    <div className="flex justify-between font-black text-sm uppercase">
                      <span>Total</span>
                      <span>{formatIDR(lastSale.sale.totalAmount)}</span>
                    </div>
                    {lastSale.sale.paymentType === 'cash' && (
                      <div className="mt-2 text-[9px] opacity-70">
                         <div className="flex justify-between"><span>Tunai</span><span>{lastSale.sale.paidAmount.toLocaleString()}</span></div>
                         <div className="flex justify-between font-bold"><span>Kembali</span><span>{lastSale.sale.changeAmount.toLocaleString()}</span></div>
                      </div>
                    )}
                    <div className="text-center mt-8 text-[9px] italic opacity-50 uppercase tracking-widest">{settings?.receiptFooterNote || 'Terima Kasih'}</div>
                 </div>

                 <div className="w-full bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block text-center tracking-[0.2em]">Kirim Struk Digital</label>
                    <div className="flex gap-2">
                       <input 
                        type="text" 
                        value={whatsappNumber} 
                        onChange={e => setWhatsappNumber(e.target.value)} 
                        className="flex-1 p-3 border-2 border-slate-100 rounded-xl text-sm focus:border-primary outline-none font-bold" 
                        placeholder="No. WhatsApp 08..." 
                       />
                       <button onClick={() => {
                          let phone = whatsappNumber.replace(/\D/g, '');
                          if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                          const text = `🧾 *STRUK DIGITAL ${settings?.storeName}*\n\n📅 ${new Date(lastSale.sale.dateTime).toLocaleString()}\n👤 Pelanggan: ${lastSale.customerName}\n\n🛒 *PESANAN:*\n` + 
                            lastSale.items.map(i => `- ${i.productName} (${i.quantity} ${i.unitName}): ${formatIDR(i.totalPrice)}`).join('\n') + 
                            `\n\n💰 *TOTAL: ${formatIDR(lastSale.sale.totalAmount)}*\n_Terima kasih sudah belanja!_`;
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                       }} className="bg-green-500 text-white p-3 rounded-xl hover:bg-green-600 shadow-lg transition-all active:scale-90"><Send size={20}/></button>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-white border-t flex gap-3">
                 <button onClick={() => window.print()} className="flex-1 bg-secondary text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Printer size={18}/> Cetak</button>
                 <button onClick={() => setShowReceiptModal(false)} className="flex-1 border-2 border-slate-200 py-4 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all">Selesai</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
