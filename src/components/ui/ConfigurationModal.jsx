import React from 'react';
import { MapPin, BatteryWarning, Bell, X, CheckCircle2 } from 'lucide-react';
import Button from './Button';

const ConfigurationModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[4000] flex flex-col justify-center items-center p-4 animate-in fade-in duration-300 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-[2rem] p-5 shadow-2xl relative flex flex-col max-h-[95vh]">
        
        {/* BOTÓN CERRAR */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors z-10"
        >
          <X size={18} />
        </button>
        
        {/* CONTENIDO SCROLLABLE (Solo si la pantalla es muy pequeña) */}
        <div className="overflow-y-auto pr-1 custom-scrollbar">
          {/* ENCABEZADO - Más compacto */}
          <div className="text-center mb-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-2 text-emerald-600">
              <MapPin size={24} />
            </div>
            <h2 className="text-lg font-black text-slate-900 uppercase leading-tight">
              Configuración Necesaria
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Para registrar tus millas correctamente
            </p>
          </div>

          {/* INSTRUCCIONES - Layout más denso */}
          <div className="space-y-3 mb-4">
            
            {/* 1. UBICACIÓN */}
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-white" />
                </div>
                <h3 className="text-[12px] font-black text-blue-900 uppercase">
                  1. Ubicación "Siempre"
                </h3>
              </div>
              <p className="text-[10px] text-blue-800 font-medium ml-1 leading-relaxed">
                Ajustes → Aplicaciones → Esta App → Permisos → Ubicación → <b>"Todo el tiempo"</b>
              </p>
            </div>

            {/* 2. BATERÍA */}
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                  <BatteryWarning size={16} className="text-white" />
                </div>
                <h3 className="text-[12px] font-black text-amber-900 uppercase">
                  2. Batería Sin Restricción
                </h3>
              </div>
              <p className="text-[10px] text-amber-800 font-medium ml-1 leading-relaxed">
                Ajustes → Aplicaciones → Batería → <b>"Sin restricciones"</b>
              </p>
            </div>

            {/* 3. NOTIFICACIONES */}
            <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-white" />
                </div>
                <h3 className="text-[12px] font-black text-purple-900 uppercase">
                  3. Notificaciones
                </h3>
              </div>
              <p className="text-[10px] text-purple-800 font-medium ml-1 leading-relaxed">
                Activa <b>"Permitir notificaciones"</b> para asegurar el rastreo.
              </p>
            </div>
          </div>

          {/* NOTA IMPORTANTE */}
          <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
            <p className="text-[10px] text-slate-600 font-medium text-center">
              💡 Regresa y presiona <b>"INICIAR RUTA"</b> al terminar.
            </p>
          </div>
        </div>

        {/* BOTÓN - Fuera del área de scroll para que siempre sea visible */}
        <Button 
          onClick={onClose} 
          className="w-full h-14 shadow-lg bg-emerald-600 text-white text-sm"
        >
          <CheckCircle2 size={18} className="mr-2" /> Entendido
        </Button>
      </div>
    </div>
  );
};

export default ConfigurationModal;