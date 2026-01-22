import React from 'react';
import { User as UserIcon, CheckCircle2, Lock, ChevronLeft, ShieldAlert, ExternalLink } from 'lucide-react';
import VehiclesManager from '../components/VehiclesManager'; 

// 🔴 IMPORTANTE: Cambia esto por la URL real de tu política de privacidad
const PRIVACY_URL = "https://dptaxpreparation.com/privacy-policy.html"; 

const Profile = ({ user, onRequestPasswordChange }) => {

  const handleOpenPrivacy = () => {
    window.open(PRIVACY_URL, '_system');
  };

  return (
    <div className="h-full flex flex-col p-6 font-sans bg-slate-50 overflow-hidden">
      
      {/* Header Fijo */}
      <div className="flex justify-center items-center mb-8 shrink-0">
         <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">MI PERFIL</h2>
      </div>

      {/* Contenido con Scroll Automático */}
      <div className="flex-1 overflow-y-auto pb-20 no-scrollbar space-y-8">
        
        {/* Tarjeta Usuario */}
        <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
              <UserIcon size={48} />
            </div>
            <p className="text-lg font-black text-slate-900 truncate max-w-full">{user.email}</p>
            <div className="flex items-center gap-1 mt-2 bg-emerald-100/50 px-3 py-1 rounded-full">
                <CheckCircle2 size={12} className="text-emerald-600"/>
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Cuenta Activa</p>
            </div>
        </div>

        {/* Configuración de Cuenta */}
        <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Configuración de Cuenta</p>
             <div className="bg-white border rounded-[2.5rem] p-2 shadow-sm space-y-2">
                
                {/* Botón Cambiar Contraseña - AHORA COINCIDE CON EL TEMA ESMERALDA */}
                <button onClick={onRequestPasswordChange} className="w-full p-4 hover:bg-emerald-50/50 rounded-3xl flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                        {/* CAMBIO AQUÍ: bg-emerald-50 y text-emerald-600 (Antes era slate) */}
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Lock size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">Cambiar Contraseña</p>
                            <p className="text-[10px] font-bold text-slate-400">Actualizar credenciales</p>
                        </div>
                    </div>
                    <ChevronLeft size={20} className="rotate-180 text-slate-300 group-hover:text-emerald-500" />
                </button>

                {/* Botón Privacidad - AHORA COINCIDE CON EL TEMA ESMERALDA */}
                <button onClick={handleOpenPrivacy} className="w-full p-4 hover:bg-emerald-50/50 rounded-3xl flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                        {/* CAMBIO AQUÍ: bg-emerald-50 y text-emerald-600 (Antes era slate) */}
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ShieldAlert size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">Privacidad y Legales</p>
                            <p className="text-[10px] font-bold text-slate-400">Ver términos de uso</p>
                        </div>
                    </div>
                    <ExternalLink size={16} className="text-slate-300 group-hover:text-emerald-500" />
                </button>
             </div>
        </div>

        {/* GESTIÓN DE VEHÍCULOS */}
        <div>
             <VehiclesManager user={user} />
        </div>

        <p className="text-center text-[9px] font-bold text-slate-300 uppercase mt-4">ID: {user.uid.slice(0,8)}... • v1.0.0</p>
      </div>
    </div>
  );
};

export default Profile;
