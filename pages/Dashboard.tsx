
import React, { useEffect, useState } from 'react';
import { getDB } from '../services/db';
import { Sale, Product } from '../types';
import { 
  DollarSign, ShoppingCart, TrendingUp, 
  AlertTriangle, UserMinus, ArrowUpRight, BarChart3,
  Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ transactionsToday: 0, salesToday: 0, profitToday: 0, debtToday: 0 });
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  useEffect(() => {
    const loadData = async () => {
      const db = await getDB();
      const today = new Date().toISOString().split('T')[0];
      const allSales = await db.getAll('sales');
      const allItems = await db.getAll('sale_items');
      const allProducts = await db.getAll('products');
      const allDebts = await db.getAll('debts');

      const salesToday = allSales.filter(s => s.dateTime.startsWith(today));
      let profit = 0;
      salesToday.forEach(sale => {
        const items = allItems.filter(i => i.saleId === sale.id);
        items.forEach(item => profit += (item.unitPrice - item.costPrice) * item.quantity);
      });

      setStats({
        transactionsToday: salesToday.length,
        salesToday: salesToday.reduce((sum, s) => sum + s.totalAmount, 0),
        profitToday: profit,
        debtToday: allDebts.filter(d => d.createdAt.startsWith(today)).reduce((sum, d) => sum + d.amount, 0)
      });

      setLowStock(allProducts.filter(p => p.stock < 10).slice(0, 5));

      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      setChartData(last7Days.map(date => ({
        name: new Date(date).toLocaleDateString('id-ID', { weekday: 'short' }),
        amount: allSales.filter(s => s.dateTime.startsWith(date)).reduce((acc, s) => acc + s.totalAmount, 0)
      })));
    };
    loadData();
  }, []);

  const cards = [
    { title: 'Omzet Hari Ini', value: formatIDR(stats.salesToday), icon: DollarSign, color: 'bg-blue-50 text-blue-600', trend: '+12% vs Kemarin' },
    { title: 'Estimasi Laba', value: formatIDR(stats.profitToday), icon: TrendingUp, color: 'bg-green-50 text-green-600', trend: 'Margin Sehat' },
    { title: 'Total Transaksi', value: stats.transactionsToday, icon: ShoppingCart, color: 'bg-purple-50 text-purple-600', trend: 'Rata-rata 5mnt' },
    { title: 'Piutang Baru', value: formatIDR(stats.debtToday), icon: UserMinus, color: 'bg-orange-50 text-orange-600', trend: 'Perlu Monitoring' }
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Ringkasan Bisnis</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Data Real-time Perangkat Ini</p>
         </div>
         <div className="hidden md:flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
            <button className="px-4 py-1.5 text-[10px] font-black uppercase bg-primary text-secondary rounded-lg shadow-sm">Hari Ini</button>
            <button className="px-4 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-secondary">7 Hari</button>
         </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
               <div className={`p-3 rounded-2xl ${card.color} group-hover:scale-110 transition-transform`}>
                 <card.icon size={24} />
               </div>
               <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                 <ArrowUpRight size={12}/> {card.trend}
               </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</p>
            <p className="text-2xl font-black text-secondary tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-secondary uppercase text-sm flex items-center gap-2"><BarChart3 size={20} className="text-primary"/> Tren Penjualan 7 Hari</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update: Baru Saja</span>
          </div>
          <div className="h-[250px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94A3B8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94A3B8' }} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  formatter={(val: number) => [formatIDR(val), 'Omzet']}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={40}>
                   {chartData.map((_, index) => (
                     <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#FFB84A' : '#1F3A5F'} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Alerts Card */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-secondary uppercase text-sm flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={20} /> Stok Kritis
                </h3>
                <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">{lowStock.length}</span>
              </div>
              <div className="space-y-4">
                {lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-red-200 transition-colors">
                     <div className="min-w-0 flex-1 pr-4">
                        <p className="font-bold text-slate-700 text-xs truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{p.category}</p>
                     </div>
                     <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-red-600">{p.stock}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">{p.unit}</p>
                     </div>
                  </div>
                ))}
                {lowStock.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-10 text-center opacity-30 grayscale">
                      <Package size={48} className="mb-2" />
                      <p className="text-xs font-bold uppercase">Stok Aman Terkendali</p>
                   </div>
                )}
              </div>
              <button className="w-full mt-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-secondary hover:text-white transition-all tracking-widest">Lihat Semua Inventaris</button>
           </div>
        </div>
      </div>
    </div>
  );
};
