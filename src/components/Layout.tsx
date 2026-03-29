import React, { useState, useEffect } from 'react';
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
  Search,
  Bell,
  ShieldCheck,
  Sun,
  Moon,
  KeyRound,
  Menu,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllAsRead, removeNotification } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const isDark = theme === 'dark';

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Package, label: 'Estoque', path: '/estoque' },
    { icon: Laptop, label: 'Equipamentos', path: '/notebooks' },
    { icon: Handshake, label: 'Empréstimos', path: '/emprestimos' },
    { icon: Users, label: 'Usuários', path: '/usuarios' },
    { icon: BarChart4, label: 'Relatórios', path: '/relatorios' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ icon: ShieldCheck, label: 'Gestão de Acesso', path: '/gestao-acesso' });
  }

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      setPasswordStatus('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    try {
      if (user?.role === 'admin') {
        const { error } = await supabase
          .from('users')
          .update({ password: newPassword })
          .eq('id', user.id);
        if (error) throw error;
        setPasswordStatus('Senha alterada com sucesso!');
        setNewPassword('');
        setTimeout(() => { setIsPasswordModalOpen(false); setPasswordStatus(''); }, 1500);
      } else {
        const { error } = await supabase
          .from('users')
          .update({ password_change_request: newPassword })
          .eq('id', user?.id);
        if (error) throw error;
        setPasswordStatus('Solicitação enviada! Aguarde aprovação do administrador.');
        setNewPassword('');
        setTimeout(() => { setIsPasswordModalOpen(false); setPasswordStatus(''); }, 2500);
      }
    } catch (err: any) {
      setPasswordStatus('Erro: ' + err.message);
    }
  };

  return (
    <div className={cn("flex h-screen transition-colors duration-300", isDark ? "bg-gray-900" : "bg-slate-50")}>
      
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 flex flex-col border-r transition-all duration-300 z-50 lg:translate-x-0 lg:static",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        isDark ? "bg-gray-950 border-gray-800" : "bg-white border-slate-200"
      )}>
        <div className={cn(
          "p-6 flex items-center justify-between border-b transition-colors",
          isDark ? "border-gray-800" : "border-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <div className="size-10 bg-sesi-blue rounded-lg flex items-center justify-center text-white">
              <Monitor size={24} />
            </div>
            <div className="flex flex-col">
              <h1 className={cn("text-base font-bold leading-tight", isDark ? "text-white" : "text-slate-900")}>Monitoria SESI</h1>
              <p className={cn("text-xs font-medium", isDark ? "text-gray-500" : "text-slate-500")}>Gestão de Ativos</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">
            <X size={20} />
          </button>
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
                    : isDark 
                      ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                      : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-4 border-t transition-colors", isDark ? "border-gray-800" : "border-slate-100")}>
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold mb-3 transition-all",
              isDark 
                ? "bg-gray-800 text-amber-400 hover:bg-gray-700" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold mb-3 transition-all",
              isDark 
                ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <KeyRound size={18} />
            <span>Trocar Senha</span>
          </button>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "size-8 rounded-full flex items-center justify-center font-bold text-xs",
                isDark ? "bg-sesi-blue/20 text-sesi-blue" : "bg-sesi-blue/10 text-sesi-blue"
              )}>
                {(user?.name || 'U').split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <p className={cn("text-xs font-bold leading-none", isDark ? "text-white" : "text-slate-900")}>{user?.name}</p>
                <p className={cn("text-[10px] mt-1 capitalize", isDark ? "text-gray-500" : "text-slate-500")}>{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={cn("transition-colors", isDark ? "text-gray-600 hover:text-red-400" : "text-slate-400 hover:text-red-500")}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-4 lg:px-8 transition-colors",
          isDark ? "bg-gray-950 border-gray-800" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            {/* Hamburger Menu (Mobile) */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "lg:hidden p-2 rounded-xl transition-colors",
                isDark ? "text-gray-400 bg-gray-800" : "text-slate-600 bg-slate-50"
              )}
            >
              <Menu size={20} />
            </button>

            <div className="relative group flex-1">
              <span className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
                isDark ? "text-gray-600 group-focus-within:text-sesi-blue" : "text-slate-400 group-focus-within:text-sesi-blue"
              )}>
                <Search size={20} />
              </span>
              <input 
                type="text" 
                placeholder="Busca global..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:ring-2 focus:ring-sesi-blue/20 transition-all outline-none",
                  isDark ? "bg-gray-800 text-white placeholder-gray-600" : "bg-slate-100 text-slate-900"
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 ml-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={cn(
                  "size-10 flex items-center justify-center rounded-xl transition-colors relative",
                  isDark ? "bg-gray-800 text-gray-400 hover:text-sesi-blue" : "bg-slate-50 text-slate-600 hover:text-sesi-blue",
                  isNotificationOpen && "ring-2 ring-sesi-blue/50"
                )}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 size-4 bg-sesi-yellow text-[10px] font-black text-slate-900 rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsNotificationOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={cn(
                        "absolute right-0 mt-4 w-[calc(100vw-2rem)] md:w-96 rounded-3xl shadow-2xl border p-4 z-[70] ring-1 ring-black/5",
                        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-100"
                      )}
                    >
                      <div className="flex items-center justify-between mb-4 px-2">
                        <h4 className={cn("font-black text-sm", isDark ? "text-white" : "text-slate-900")}>Notificações</h4>
                        <button 
                          onClick={markAllAsRead}
                          className="text-[10px] font-black text-sesi-blue uppercase tracking-widest hover:underline"
                        >
                          Limpar tudo
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <div className="py-10 text-center text-slate-300">
                            <Bell size={32} className="mx-auto mb-2 opacity-10" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma notificação</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id}
                              className={cn(
                                "p-3 rounded-2xl border transition-all relative group",
                                n.read 
                                  ? isDark ? "bg-gray-800/20 border-gray-800" : "bg-slate-50 border-slate-100" 
                                  : isDark ? "bg-blue-900/10 border-blue-900/40" : "bg-blue-50 border-blue-100"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "size-8 rounded-xl flex items-center justify-center shrink-0",
                                  n.type === 'alert' ? "bg-rose-100 text-rose-500" : "bg-blue-100 text-blue-500"
                                )}>
                                  {n.type === 'alert' ? <AlertCircle size={16} /> : <Bell size={16} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className={cn("text-xs font-black truncate", isDark ? "text-white" : "text-slate-900")}>{n.title}</h5>
                                  <p className={cn("text-[10px] mt-0.5 leading-relaxed break-words", isDark ? "text-gray-400" : "text-slate-500")}>{n.message}</p>
                                  <span className="text-[9px] font-bold text-slate-400 mt-1.5 block">{n.time}</span>
                                </div>
                                <button 
                                  onClick={() => removeNotification(n.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className={cn(
          "flex-1 overflow-y-auto p-4 lg:p-8 transition-colors",
          isDark ? "bg-gray-900" : "bg-slate-50"
        )}>
          {children}
        </div>
      </main>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className={cn(
            "w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden",
            isDark ? "bg-gray-900 border border-gray-800" : "bg-white"
          )}>
            <div className={cn(
              "p-6 border-b flex items-center justify-between",
              isDark ? "border-gray-800" : "border-slate-100"
            )}>
              <div className="flex items-center gap-3">
                <KeyRound size={24} className="text-sesi-blue" />
                <h3 className={cn("text-xl font-black", isDark ? "text-white" : "text-slate-900")}>
                  Trocar Senha
                </h3>
              </div>
              <button onClick={() => { setIsPasswordModalOpen(false); setPasswordStatus(''); setNewPassword(''); }}
                className={cn("transition-colors", isDark ? "text-gray-600 hover:text-white" : "text-slate-400 hover:text-slate-600")}>
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-slate-500")}>
                {user?.role === 'admin' 
                  ? 'A nova senha será aplicada imediatamente.'
                  : 'Sua solicitação será enviada ao administrador para aprovação.'
                }
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha"
                className={cn(
                  "w-full h-14 px-6 rounded-2xl focus:ring-4 focus:ring-sesi-blue/20 transition-all outline-none font-bold",
                  isDark ? "bg-gray-800 text-white border-gray-700 placeholder-gray-600" : "bg-slate-50 text-slate-900 border-slate-100"
                )}
              />
              {passwordStatus && (
                <p className={cn(
                  "text-sm font-bold p-3 rounded-xl",
                  passwordStatus.includes('sucesso') || passwordStatus.includes('enviada')
                    ? "bg-emerald-50 text-emerald-600" 
                    : "bg-red-50 text-red-600"
                )}>{passwordStatus}</p>
              )}
              <button
                onClick={handlePasswordChange}
                className="w-full py-4 bg-sesi-yellow text-slate-900 font-black rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-sesi-yellow/20"
              >
                {user?.role === 'admin' ? 'ALTERAR SENHA' : 'SOLICITAR ALTERAÇÃO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

