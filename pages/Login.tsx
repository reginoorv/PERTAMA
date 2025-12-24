import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (success) {
      // Get role to redirect properly. We can't access updated User state immediately here easily without effect.
      // But typically login sets state. 
      // We will let AuthContext/ProtectedRoutes handle direction or basic redirect.
      navigate('/');
    } else {
      setError('Username atau password salah');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-100">
        <div className="flex justify-center mb-6 text-primary">
          <div className="p-4 bg-secondary rounded-full">
            <Store size={48} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-secondary mb-2">Grosir Sembako LocalPOS</h2>
        <p className="text-center text-slate-500 mb-8">Silakan login untuk melanjutkan</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              placeholder="admin123"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-secondary text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors mt-2"
          >
            Login
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Default Admin: admin / admin123</p>
        </div>
      </div>
    </div>
  );
};
