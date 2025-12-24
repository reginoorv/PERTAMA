import React, { useEffect, useState } from 'react';
import { getDB } from '../services/db';
import { Customer, DebtPayment } from '../types';
import { CreditCard, History, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const DebtPage: React.FC = () => {
  const [debtors, setDebtors] = useState<{customer: Customer, totalDebt: number}[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<{customer: Customer, totalDebt: number} | null>(null);
  const [history, setHistory] = useState<{date: string, type: 'debt' | 'payment', amount: number, note?: string}[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const fetchDebtors = async () => {
    const db = await getDB();
    const customers = await db.getAll('customers');
    const debts = await db.getAll('debts');
    const payments = await db.getAll('debt_payments');

    const list = customers.map(c => {
       const cDebts = debts.filter(d => d.customerId === c.id).reduce((sum, d) => sum + d.amount, 0);
       const cPayments = payments.filter(p => p.customerId === c.id).reduce((sum, p) => sum + p.amount, 0);
       return {
         customer: c,
         totalDebt: cDebts - cPayments
       };
    }).filter(x => x.totalDebt > 0);

    setDebtors(list);
    return list;
  };

  const loadHistory = async (customerId: string) => {
    const db = await getDB();
    const debts = await db.getAllFromIndex('debts', 'customerId', customerId);
    const payments = await db.getAllFromIndex('debt_payments', 'customerId', customerId);

    const merged = [
      ...debts.map(d => ({ date: d.createdAt, type: 'debt' as const, amount: d.amount, note: `Sale ID: ...${d.saleId.slice(-4)}` })),
      ...payments.map(p => ({ date: p.dateTime, type: 'payment' as const, amount: p.amount, note: p.note }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setHistory(merged);
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  const handleSelect = (d: typeof debtors[0]) => {
    setSelectedDebtor(d);
    loadHistory(d.customer.id);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    const amount = parseInt(paymentAmount);
    if (!amount || amount <= 0) return;

    const db = await getDB();
    const payment: DebtPayment = {
      id: uuidv4(),
      customerId: selectedDebtor.customer.id,
      amount: amount,
      dateTime: new Date().toISOString(),
      note: paymentNote
    };

    await db.add('debt_payments', payment);
    setPaymentAmount('');
    setPaymentNote('');
    
    // Refresh List and update selected view immediately
    const updatedList = await fetchDebtors();
    const updatedDebtor = updatedList.find(d => d.customer.id === selectedDebtor.customer.id);
    
    if (updatedDebtor) {
       setSelectedDebtor(updatedDebtor);
       loadHistory(updatedDebtor.customer.id);
    } else {
       // Debtor fully paid off, removed from list
       setSelectedDebtor({ ...selectedDebtor, totalDebt: 0 });
       loadHistory(selectedDebtor.customer.id); // Show history to confirm payment
       alert('Hutang lunas!');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-2xl font-bold text-secondary">Manajemen Kasbon</h2>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-bold text-lg text-secondary">Daftar Penunggak</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {debtors.map(d => (
              <div 
                key={d.customer.id} 
                onClick={() => handleSelect(d)}
                className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${selectedDebtor?.customer.id === d.customer.id ? 'bg-blue-50 border-l-4 border-l-secondary' : ''}`}
              >
                <div className="font-bold text-slate-700">{d.customer.name}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-500">{d.customer.phone}</span>
                  <span className="text-sm font-bold text-red-600">{formatIDR(d.totalDebt)}</span>
                </div>
              </div>
            ))}
            {debtors.length === 0 && (
              <div className="p-8 text-center text-slate-400">Tidak ada data kasbon.</div>
            )}
          </div>
        </div>

        {/* Right Detail */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {selectedDebtor ? (
            <>
              <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-secondary">{selectedDebtor.customer.name}</h2>
                  <p className="text-slate-500 text-sm">{selectedDebtor.customer.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Sisa Hutang</p>
                  <p className={`text-3xl font-bold ${selectedDebtor.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatIDR(selectedDebtor.totalDebt)}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* History */}
                <div className="flex-1 p-4 border-r overflow-y-auto">
                  <h4 className="font-bold text-secondary mb-4 flex items-center gap-2">
                    <History size={18} /> Riwayat Transaksi
                  </h4>
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={i} className="flex justify-between items-center text-sm p-3 rounded bg-slate-50">
                        <div>
                          <div className="font-medium text-slate-700">
                            {new Date(h.date).toLocaleDateString('id-ID')}
                          </div>
                          <div className="text-xs text-slate-500 uppercase">{h.type === 'debt' ? 'Belanja (Kasbon)' : 'Pembayaran'}</div>
                          {h.note && <div className="text-xs italic text-slate-400">{h.note}</div>}
                        </div>
                        <div className={`font-bold ${h.type === 'debt' ? 'text-red-500' : 'text-green-600'}`}>
                          {h.type === 'debt' ? '+' : '-'}{formatIDR(h.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <div className="w-full md:w-80 p-4 bg-slate-50 overflow-y-auto">
                   <h4 className="font-bold text-secondary mb-4 flex items-center gap-2">
                     <CreditCard size={18} /> Bayar Hutang
                   </h4>
                   {selectedDebtor.totalDebt > 0 ? (
                     <form onSubmit={handlePayment} className="space-y-4">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase">Jumlah Bayar</label>
                         <input 
                           type="number" 
                           value={paymentAmount}
                           onChange={e => setPaymentAmount(e.target.value)}
                           className="w-full p-2 border rounded-lg"
                           placeholder="Rp"
                           required
                           max={selectedDebtor.totalDebt}
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                         <input 
                           type="text" 
                           value={paymentNote}
                           onChange={e => setPaymentNote(e.target.value)}
                           className="w-full p-2 border rounded-lg"
                           placeholder="Opsional"
                         />
                       </div>
                       <button 
                         type="submit"
                         className="w-full bg-success text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 flex justify-center gap-2"
                       >
                         <PlusCircle size={20} /> Simpan Pembayaran
                       </button>
                     </form>
                   ) : (
                     <div className="bg-green-100 text-green-700 p-4 rounded-lg text-center font-bold">
                       Hutang Lunas!
                     </div>
                   )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Pilih pelanggan untuk melihat detail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
