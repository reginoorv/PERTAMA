
import React, { useState, useEffect, useRef } from 'react';
import { getDB, exportBackup, restoreBackup } from '../services/db';
import { Settings as SettingsType, User, UserRole } from '../types';
import { Save, UserPlus, Trash2, Edit, Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('store');
  const [storeSettings, setStoreSettings] = useState<SettingsType>({
    storeName: '', storeAddress: '', storePhone: '', receiptFooterNote: ''
  });
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<{username: string, password: string, role: UserRole}>({ 
    username: '', 
    password: '', 
    role: 'cashier' 
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Backup Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const db = await getDB();
      const s = await db.get('settings', 'config');
      if (s) setStoreSettings(s);
      const u = await db.getAll('users');
      setUsers(u);
    };
    load();
  }, []);

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDB();
    await db.put('settings', storeSettings, 'config');
    alert('Pengaturan toko berhasil disimpan');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username) return;
    
    // If adding new, require password. If editing, optional (blank = keep old).
    if (!editingUser && !newUser.password) {
        alert("Password wajib diisi untuk user baru");
        return;
    }

    const db = await getDB();

    if (editingUser) {
        // Edit Mode
        const updatedUser: User = {
            ...editingUser,
            username: newUser.username,
            role: newUser.role,
            // If password field is not empty, update hash. Else keep old.
            passwordHash: newUser.password ? newUser.password : editingUser.passwordHash
        };
        await db.put('users', updatedUser);
        setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
        setEditingUser(null);
        alert('Data user diperbarui');
    } else {
        // Add Mode
        const user: User = {
            id: uuidv4(),
            username: newUser.username,
            passwordHash: newUser.password,
            role: newUser.role,
            createdAt: new Date().toISOString()
        };
        await db.add('users', user);
        setUsers([...users, user]);
        alert('User berhasil ditambahkan');
    }

    setNewUser({ username: '', password: '', role: 'cashier' });
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Hapus user ini?')) return;
    const db = await getDB();
    await db.delete('users', id);
    setUsers(users.filter(u => u.id !== id));
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setNewUser({
        username: u.username,
        password: '', // Leave blank to indicate "unchanged"
        role: u.role
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUser({ username: '', password: '', role: 'cashier' });
  };

  // --- Backup & Restore Logic ---

  const handleBackup = async () => {
    try {
      const data = await exportBackup();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      
      const fileName = `grosir-localpos-backup-${yyyy}${mm}${dd}-${hh}${min}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert('Gagal melakukan backup data');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("PERINGATAN: Restore data akan menghapus SEMUA data yang ada saat ini dan menggantinya dengan data dari file backup. Apakah Anda yakin ingin melanjutkan?")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const backupData = JSON.parse(jsonContent);
        
        // Basic validation
        if (!backupData.timestamp || !Array.isArray(backupData.products)) {
           throw new Error("Format file tidak valid");
        }

        await restoreBackup(backupData);
        alert('Restore data berhasil! Aplikasi akan dimuat ulang.');
        window.location.reload();
      } catch (error) {
        console.error(error);
        alert('Gagal memulihkan data. Pastikan file yang dipilih adalah file backup yang valid.');
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-secondary mb-6">Pengaturan</h2>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('store')}
          className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'store' ? 'border-primary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Profil Toko
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'users' ? 'border-primary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Manajemen User
        </button>
        <button 
          onClick={() => setActiveTab('backup')}
          className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'backup' ? 'border-primary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Backup & Restore
        </button>
      </div>

      {activeTab === 'store' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-w-2xl">
          <form onSubmit={saveStore} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Toko</label>
              <input type="text" value={storeSettings.storeName} onChange={e => setStoreSettings({...storeSettings, storeName: e.target.value})} className="w-full p-2 border rounded" placeholder="Contoh: Toko Berkah" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alamat</label>
              <textarea rows={3} value={storeSettings.storeAddress} onChange={e => setStoreSettings({...storeSettings, storeAddress: e.target.value})} className="w-full p-2 border rounded" placeholder="Alamat lengkap..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">No. Telepon</label>
              <input type="text" value={storeSettings.storePhone} onChange={e => setStoreSettings({...storeSettings, storePhone: e.target.value})} className="w-full p-2 border rounded" placeholder="08..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Catatan Kaki Struk</label>
              <input type="text" value={storeSettings.receiptFooterNote} onChange={e => setStoreSettings({...storeSettings, receiptFooterNote: e.target.value})} className="w-full p-2 border rounded" placeholder="Terima kasih..." />
            </div>
            <div className="pt-2">
              <button type="submit" className="bg-secondary text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800">
                <Save size={18} /> Simpan Pengaturan
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-secondary mb-4">Daftar User</h3>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
                   <div>
                     <p className="font-bold text-slate-700">{u.username}</p>
                     <p className="text-xs text-slate-500 uppercase">{u.role}</p>
                   </div>
                   <div className="flex gap-1">
                      <button onClick={() => handleEditUser(u)} className="text-blue-400 hover:text-blue-600 p-2" title="Edit User">
                         <Edit size={16} />
                      </button>
                      {/* Can delete if not self AND not the seed admin 'admin' */}
                      {(u.id !== currentUser?.id && u.id !== 'user-admin-seed') && (
                        <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:text-red-600 p-2" title="Hapus User">
                          <Trash2 size={16} />
                        </button>
                      )}
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
            <h3 className="font-bold text-secondary mb-4">{editingUser ? 'Edit User' : 'Tambah User'}</h3>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password {editingUser && <span className="text-xs text-slate-400 font-normal">(Kosongkan jika tidak ubah)</span>}</label>
                <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded" placeholder={editingUser ? "******" : ""} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded">
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                  {editingUser && (
                     <button type="button" onClick={handleCancelEdit} className="flex-1 bg-white border border-slate-300 text-slate-600 py-2 rounded-lg font-bold hover:bg-slate-50">
                        Batal
                     </button>
                  )}
                  <button type="submit" className="flex-1 bg-primary text-secondary py-2 rounded-lg font-bold hover:bg-amber-400 flex items-center justify-center gap-2">
                    {editingUser ? <Save size={18}/> : <UserPlus size={18} />}
                    {editingUser ? 'Simpan' : 'Tambah'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="max-w-2xl space-y-6">
           <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
             <div className="flex items-start gap-4">
               <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <Download size={32} />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-secondary mb-1">Backup Data</h3>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Download semua data aplikasi (produk, transaksi, pelanggan, pengaturan, dll) ke dalam file JSON. 
                    Simpan file ini di tempat aman (Google Drive, Flashdisk) sebagai cadangan jika perangkat rusak atau browser dibersihkan.
                  </p>
                  <button 
                    onClick={handleBackup}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md transition"
                  >
                    <Download size={18} /> Download Backup
                  </button>
               </div>
             </div>
           </div>

           <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 shadow-sm relative overflow-hidden">
             {isRestoring && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                   <Loader2 size={48} className="text-primary animate-spin mb-2" />
                   <p className="font-bold text-slate-700">Sedang memulihkan data...</p>
                </div>
             )}
             <div className="flex items-start gap-4">
               <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                  <Upload size={32} />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-secondary mb-1">Restore Data</h3>
                  <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                    Upload file backup JSON untuk mengembalikan data yang hilang atau memindahkan data ke perangkat ini.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-lg mb-4 text-xs text-red-800 font-medium">
                     <AlertTriangle size={16} className="shrink-0" />
                     <span>PERINGATAN: Data yang ada saat ini akan dihapus dan diganti sepenuhnya dengan data dari file backup.</span>
                  </div>
                  
                  <input 
                    type="file" 
                    accept=".json"
                    ref={fileInputRef}
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-700 shadow-md transition"
                  >
                    <Upload size={18} /> Upload & Restore
                  </button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
