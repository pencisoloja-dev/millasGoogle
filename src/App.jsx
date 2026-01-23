import React, { useState, useEffect, useMemo } from 'react';
import { WifiOff, AlertTriangle, X, Map as MapIcon, Receipt, BarChart3, UserCog, LogOut, RefreshCw } from 'lucide-react';

// --- NUEVA ARQUITECTURA: IMPORTS ---
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import Login from './pages/Login';
import MileageTracker from './pages/MileageTracker';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Profile from './pages/Profile';

import Button from './components/ui/Button';
import NavButton from './components/ui/NavButton';
import Toast from './components/ui/Toast';
import LoadingScreen from './components/ui/LoadingScreen';
import { PasswordResetModal } from './components/ui/Modals';

export default function App() {
  // 1. Lógica de Autenticación
  const { user, loadingAuth, passwordResetForced, logout } = useAuth();
  
  // 2. Lógica de Datos
  const { trips, expenses } = useData(user);

  // 3. Estado Local de la Interfaz
  const [activeTab, setActiveTab] = useState('millas');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [showRejectedBanner, setShowRejectedBanner] = useState(false);
  const [lastRejectedSeenAt, setLastRejectedSeenAt] = useState(() => 
    parseInt(localStorage.getItem('lastRejectedSeenAt') || '0')
  );

  // --- EFECTOS ---
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (passwordResetForced) setShowPasswordModal(true);
  }, [passwordResetForced]);

  const rejectedCount = useMemo(() => {
    const rejected = expenses.filter(e => e.status === 'rejected');
    const hasNew = rejected.some(e => (e.reviewedAt?.seconds || 0) * 1000 > lastRejectedSeenAt);
    if (hasNew && activeTab !== 'gastos') setShowRejectedBanner(true);
    return rejected.length;
  }, [expenses, lastRejectedSeenAt, activeTab]);

  const dismissBanner = () => {
    const now = Date.now();
    setLastRejectedSeenAt(now);
    localStorage.setItem('lastRejectedSeenAt', now.toString());
    setShowRejectedBanner(false);
  };

  useEffect(() => { if (activeTab === 'gastos') dismissBanner(); }, [activeTab]);

  // --- HANDLERS ---
  
  const showToast = (message, type = 'success') => setToast({ message, type });

  const handleLogout = async () => {
    if (window.confirm("¿Seguro que quieres cerrar sesión?")) {
      await logout();
    }
  };

  // --- RENDERIZADO QUIRÚRGICO ANTI-PARPADEO ---

  // Solo mostramos la pantalla de carga la PRIMERA VEZ (cuando no hay usuario ni se sabe si lo habrá)
  if (loadingAuth && !user) return <LoadingScreen />;
  
  // Si no hay usuario y ya dejó de cargar, Login
  if (!user && !loadingAuth) return <Login />;

  // Si hay usuario (aunque loadingAuth sea true al despertar), mantenemos la UI montada
  return (
    <div className={`h-screen bg-slate-50 flex flex-col relative overflow-hidden font-sans select-none transition-opacity duration-300 ${loadingAuth ? 'opacity-80' : 'opacity-100'}`}>
      
      {/* Indicador de carga sutil (Spinner de fondo) */}
      {loadingAuth && (
        <div className="absolute top-10 right-10 z-[200] animate-spin text-slate-400">
          <RefreshCw size={16} />
        </div>
      )}

      {/* --- CAPA SUPERIOR (Modales y Alertas) --- */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showPasswordModal && (
        <PasswordResetModal 
           user={user} 
           forced={passwordResetForced} 
           onClose={() => !passwordResetForced && setShowPasswordModal(false)} 
        />
      )}

      {isOffline && (
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest z-[101]">
            <WifiOff size={14} /> Sin conexión • Modo Offline Activo
        </div>
      )}

      {showRejectedBanner && rejectedCount > 0 && (
        <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 shrink-0 z-[100] relative">
          <div className="flex items-center gap-3" onClick={() => setActiveTab('gastos')}>
            <AlertTriangle size={20} className="animate-bounce" />
            <div className="leading-none">
              <p className="text-[10px] font-black uppercase tracking-widest">Acción Requerida</p>
              <p className="text-[9px] font-bold opacity-90 uppercase mt-1">{rejectedCount} comprobantes rechazados</p>
            </div>
          </div>
          <button onClick={dismissBanner} className="p-2 bg-black/10 rounded-full hover:bg-black/20"><X size={18} /></button>
        </div>
      )}

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'millas' && <MileageTracker user={user} trips={trips} />}
        {activeTab === 'gastos' && <Expenses user={user} expenses={expenses} onShowToast={showToast} />}
        {activeTab === 'reporte' && <Reports user={user} trips={trips} expenses={expenses} />}
        {activeTab === 'perfil' && <Profile user={user} onRequestPasswordChange={() => setShowPasswordModal(true)} />}
      </div>
      
      {/* --- BARRA DE NAVEGACIÓN --- */}
      <div className="h-24 bg-slate-900 flex justify-around items-center px-6 pb-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-50 relative">
        <NavButton active={activeTab === 'millas'} onClick={() => setActiveTab('millas')} icon={MapIcon} />
        <NavButton active={activeTab === 'gastos'} onClick={() => setActiveTab('gastos')} icon={Receipt} badge={rejectedCount > 0 ? rejectedCount : null} />
        <NavButton active={activeTab === 'reporte'} onClick={() => setActiveTab('reporte')} icon={BarChart3} />
        
        <div className="w-px h-8 bg-white/10 mx-1"></div>
        
        <NavButton active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} icon={UserCog} />
        
        <button 
          onClick={handleLogout} 
          className="p-4 rounded-2xl transition-all text-rose-500 hover:bg-rose-500/10 active:scale-95 flex items-center justify-center relative z-50"
          aria-label="Cerrar Sesión"
        >
          <LogOut size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}