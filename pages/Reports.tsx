import React, { useEffect, useState } from 'react';
import { getDB } from '../services/db';
import { Sale, SaleItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  
  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const load = async () => {
    const db = await getDB();
    const allSales = await db.getAll('sales');
    const allItems = await db.getAll('sale_items');
    setSales(allSales);
    setItems(allItems);
    prepareChart(allSales, allItems);
  };

  useEffect(() => {
    load();
  }, []);

  const prepareChart = (saleData: Sale[], itemData: SaleItem[]) => {
    // Group by date
    const grouped: any = {};
    
    saleData.forEach(s => {
      const date = s.dateTime.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { revenue: 0, profit: 0 };
      }
      
      grouped[date].revenue += s.totalAmount;
      
      // Calculate profit for this sale
      const saleItems = itemData.filter(i => i.saleId === s.id);
      const saleCost = saleItems.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
      grouped[date].profit += (s.totalAmount - saleCost);
    });

    const chart = Object.keys(grouped).sort().slice(-14).map(date => ({
      date: new Date(date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}),
      revenue: grouped[date].revenue,
      profit: grouped[date].profit
    }));
    setChartData(chart);
  };

  // Top Products Logic
  const topProducts = React.useMemo(() => {
    const map = new Map<string, {name: string, qty: number, revenue: number, profit: number}>();
    items.forEach(i => {
      const profit = (i.unitPrice - i.costPrice) * i.quantity;
      const current = map.get(i.productId) || { name: i.productName, qty: 0, revenue: 0, profit: 0 };
      map.set(i.productId, {
        name: i.productName,
        qty: current.qty + i.quantity,
        revenue: current.revenue + i.totalPrice,
        profit: current.profit + profit
      });
    });
    return Array.from(map.values()).sort((a,b) => b.qty - a.qty).slice(0, 10);
  }, [items]);

  // Summary Cards
  const totalRevenue = chartData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalProfit = chartData.reduce((acc, curr) => acc + curr.profit, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-secondary">Laporan Bisnis</h2>
      </div>
      
      <div className="flex gap-4">
        <button onClick={() => setReportType('sales')} className={`px-4 py-2 rounded-lg font-medium transition ${reportType === 'sales' ? 'bg-primary text-secondary shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Penjualan & Keuntungan</button>
        <button onClick={() => setReportType('products')} className={`px-4 py-2 rounded-lg font-medium transition ${reportType === 'products' ? 'bg-primary text-secondary shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Produk Terlaris</button>
      </div>

      {reportType === 'sales' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4">
               <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                 <DollarSign size={24} />
               </div>
               <div>
                 <p className="text-sm text-slate-500">Total Omzet (14 Hari)</p>
                 <p className="text-2xl font-bold text-secondary">{formatIDR(totalRevenue)}</p>
               </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4">
               <div className="p-3 bg-green-100 text-green-700 rounded-full">
                 <TrendingUp size={24} />
               </div>
               <div>
                 <p className="text-sm text-slate-500">Total Keuntungan (14 Hari)</p>
                 <p className="text-2xl font-bold text-green-600">{formatIDR(totalProfit)}</p>
               </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold mb-6 text-secondary">Grafik Omzet vs Keuntungan</h3>
            <div className="h-80 w-full mb-8">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="date" />
                   <YAxis />
                   <Tooltip formatter={(val: number) => formatIDR(val)} />
                   <Legend />
                   <Bar dataKey="revenue" fill="#1F3A5F" name="Omzet" radius={[4, 4, 0, 0]} />
                   <Bar dataKey="profit" fill="#27AE60" name="Keuntungan" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <h3 className="text-lg font-bold mb-4 text-secondary">Detail Transaksi Terbaru</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 uppercase text-slate-500 text-xs">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">Tipe Bayar</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.slice().sort((a,b) => b.dateTime.localeCompare(a.dateTime)).slice(0, 15).map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3">{new Date(s.dateTime).toLocaleString('id-ID')}</td>
                      <td className="p-3 font-mono text-xs text-slate-400">{s.id.slice(0, 8)}...</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.paymentType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.paymentType === 'cash' ? 'Tunai' : 'Kasbon'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700">{formatIDR(s.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reportType === 'products' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-secondary">10 Produk Terlaris & Paling Menguntungkan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 uppercase text-slate-500 text-xs">
                <tr>
                  <th className="p-3">Produk</th>
                  <th className="p-3 text-center">Terjual (Qty)</th>
                  <th className="p-3 text-right">Total Pendapatan</th>
                  <th className="p-3 text-right">Est. Keuntungan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-700">{p.name}</td>
                    <td className="p-3 text-center font-bold text-primary text-lg">{p.qty}</td>
                    <td className="p-3 text-right">{formatIDR(p.revenue)}</td>
                    <td className="p-3 text-right font-bold text-green-600">{formatIDR(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
