
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  FileBarChart, 
  Settings, 
  LogOut,
  Menu,
  X,
  MoreHorizontal
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { path: '/', label: 'Home', icon: LayoutDashboard, role: 'admin', mobile: true },
    { path: '/pos', label: 'Kasir', icon: ShoppingCart, role: 'all', mobile: true },
    { path: '/products', label: 'Stok', icon: Package, role: 'admin', mobile: true },
    { path: '/reports', label: 'Laporan', icon: FileBarChart, role: 'admin', mobile: true },
    { path: '/customers', label: 'Pelanggan', icon: Users, role: 'admin', mobile: false },
    { path: '/debt', label: 'Kasbon', icon: CreditCard, role: 'admin', mobile: false },
    { path: '/settings', label: 'Setelan', icon: Settings, role: 'admin', mobile: false },
  ];

  const filteredMenu = menuItems.filter(item => 
    item.role === 'all' || (user?.role === 'admin' && item.role === 'admin')
  );

  return (
    <div className="flex h-screen bg-bg overflow-hidden flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white transition-transform duration-300 ease-in-out transform 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:relative lg:translate-x-0 hidden lg:flex flex-col
      `}>
        <div className="p-6 border-b border-blue-900/50">
          <h1 className="text-2xl font-bold text-primary">LocalPOS</h1>
          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Grosir Sembako</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive(item.path) 
                  ? 'bg-primary text-secondary font-bold shadow-lg' 
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-900/50 bg-secondary/50">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-white/5 rounded-lg text-sm transition-colors">
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      <div className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <aside className={`absolute left-0 top-0 bottom-0 w-72 bg-secondary text-white transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h1 className="text-xl font-bold text-primary">Menu Utama</h1>
            <button onClick={() => setSidebarOpen(false)}><X size={24} /></button>
          </div>
          <div className="p-4 space-y-1">
            {filteredMenu.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-4 px-4 py-4 rounded-xl ${isActive(item.path) ? 'bg-primary text-secondary font-bold' : 'text-slate-300'}`}
              >
                <item.icon size={22} />
                <span className="text-base">{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
             <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 text-red-400 font-bold">
               <LogOut size={22} /> <span>Keluar</span>
             </button>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-16 lg:pb-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40">
           <h1 className="font-bold text-secondary text-lg">LocalPOS</h1>
           <div className="flex items-center gap-2">
              <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase">{user?.role}</div>
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-secondary text-white rounded-lg">
                <Menu size={20} />
              </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-bg">
          {children}
        </main>

        {/* Bottom Navigation (Mobile Only) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center px-2 py-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          {filteredMenu.filter(m => m.mobile).map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${isActive(item.path) ? 'text-primary scale-110' : 'text-slate-400'}`}
            >
              <item.icon size={20} strokeWidth={isActive(item.path) ? 3 : 2} />
              <span className={`text-[10px] mt-1 font-bold ${isActive(item.path) ? 'text-secondary' : 'text-slate-400'}`}>{item.label}</span>
            </Link>
          ))}
          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center justify-center py-1 px-3 text-slate-400">
            <MoreHorizontal size={20} />
            <span className="text-[10px] mt-1 font-bold uppercase">Lainnya</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
