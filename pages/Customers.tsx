import React, { useEffect, useState } from 'react';
import { getDB } from '../services/db';
import { Customer } from '../types';
import { Plus, Edit, Trash, Search, Phone, MapPin } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const emptyForm = { name: '', contactName: '', phone: '', address: '' };
  const [formData, setFormData] = useState(emptyForm);

  const fetchCustomers = async () => {
    const db = await getDB();
    const data = await db.getAll('customers');
    setCustomers(data);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDB();
    const payload: Customer = {
      id: editingCustomer ? editingCustomer.id : uuidv4(),
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
      ...formData
    };

    await db.put('customers', payload);
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
    fetchCustomers();
  };

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      contactName: c.contactName || '',
      phone: c.phone || '',
      address: c.address || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const db = await getDB();
    
    // Safety check: existing Sales or Debts
    const sales = await db.getAllFromIndex('sales', 'customerId', id);
    const debts = await db.getAllFromIndex('debts', 'customerId', id);
    
    let confirmMessage = 'Hapus pelanggan ini?';
    
    if (sales.length > 0 || debts.length > 0) {
      confirmMessage = `PERINGATAN: Pelanggan ini memiliki ${sales.length} riwayat transaksi dan ${debts.length} catatan hutang.\n\nMenghapus pelanggan ini akan menyebabkan data transaksi tersebut kehilangan nama pelanggan (menjadi anonim). \n\nApakah Anda yakin ingin melanjutkan penghapusan?`;
    }

    if (confirm(confirmMessage)) {
      await db.delete('customers', id);
      fetchCustomers();
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-secondary">Pelanggan</h2>
        <div className="flex gap-2">
            <button 
              onClick={() => { setEditingCustomer(null); setFormData(emptyForm); setIsModalOpen(true); }}
              className="bg-primary text-secondary px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-amber-400 transition"
            >
              <Plus size={20} /> Tambah Pelanggan
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
           <div className="relative max-w-md">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
             <input 
               type="text" 
               placeholder="Cari nama pelanggan..." 
               className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary outline-none"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3">Nama Toko/Warung</th>
                <th className="px-6 py-3">Kontak</th>
                <th className="px-6 py-3">Telepon</th>
                <th className="px-6 py-3">Alamat</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-6 py-3">{c.contactName || '-'}</td>
                  <td className="px-6 py-3 flex items-center gap-2 text-slate-600">
                    {c.phone && <Phone size={14} />} {c.phone || '-'}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    <div className="flex items-center gap-2 max-w-xs truncate">
                       {c.address && <MapPin size={14} />} {c.address || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <button onClick={() => handleEdit(c)} className="text-blue-500 hover:text-blue-700" title="Edit Pelanggan"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700" title="Hapus Pelanggan"><Trash size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Toko / Warung</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Kontak (Pemilik)</label>
                <input type="text" value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">No. Telepon</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-2 border rounded"></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border rounded hover:bg-slate-50">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-secondary text-white rounded hover:bg-slate-800">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
