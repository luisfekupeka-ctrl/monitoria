import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Laptop, 
  Handshake, 
  Users, 
  BarChart4, 
  LogOut,
  Monitor,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Package, label: 'Estoque', path: '/estoque' },
    { icon: Laptop, label: 'Equipamentos', path: '/notebooks' },
    { icon: Handshake, label: 'Empréstimos', path: '/emprestimos' },
    { icon: Users, label: 'Usuários', path: '/usuarios' },
    { icon: BarChart4, label: 'Relatórios', path: '/relatorios' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="size-10 bg-sesi-blue rounded-lg flex items-center justify-center text-white">
            <Monitor size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-slate-900 text-base font-bold leading-tight">Monitoria SESI</h1>
            <p className="text-slate-500 text-xs font-medium">Gestão de Ativos</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                  isActive 
                    ? "bg-sesi-yellow text-slate-900 font-bold shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-amber-50 p-4 rounded-xl flex items-start gap-3 mb-4">
            <div className="text-amber-500">
              <span className="material-symbols-outlined text-xl">tips_and_updates</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Dica do dia</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                Verifique notebooks com devolução atrasada.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-sesi-blue/10 flex items-center justify-center text-sesi-blue font-bold text-xs">
                {(user?.name || 'U').split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-bold text-slate-900 leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-500 mt-1 capitalize">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sesi-blue transition-colors">
                <span className="material-symbols-outlined text-xl">search</span>
              </span>
              <input 
                type="text" 
                placeholder="Busca global..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-sesi-blue/20 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="size-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:text-sesi-blue transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-sesi-yellow rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
