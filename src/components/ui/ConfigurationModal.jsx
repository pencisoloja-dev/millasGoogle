import React from 'react';
import { MapPin, BatteryWarning, Bell, X, CheckCircle2 } from 'lucide-react';
import Button from './Button';

const ConfigurationModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[4000] flex flex-col justify-center items-center p-6 animate-in fade-in duration-300 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl relative my-auto">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors z-10"
        >
          <X size={20} />
        </button>
        
        {/* ENCABEZADO */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-4 text-emerald-600">
            <MapPin size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase leading-tight">
            Configuración Necesaria
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Para registrar tus millas correctamente
          </p>
        </div>

        {/* INSTRUCCIONES */}
        <div className="space-y-4 mb-8">
          
          {/* 1. UBICACIÓN */}
          <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-blue-900 uppercase">
                  1. Ubicación "Todo el Tiempo"
                </h3>
                <p className="text-[10px] text-blue-700 mt-1 font-medium">
                  Necesario para rastrear en segundo plano
                </p>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-blue-800 font-medium ml-1">
              <li>Abre <b>Ajustes</b> del teléfono</li>
              <li>Busca <b>Aplicaciones</b> → <b>Esta App</b></li>
              <li>Entra en <b>Permisos</b> → <b>Ubicación</b></li>
              <li>Selecciona <b>"Todo el tiempo"</b> o <b>"Siempre"</b></li>
            </ol>
          </div>

          {/* 2. BATERÍA */}
          <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                <BatteryWarning size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-amber-900 uppercase">
                  2. Batería Sin Restricciones
                </h3>
                <p className="text-[10px] text-amber-700 mt-1 font-medium">
                  Evita que el sistema apague el GPS
                </p>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-amber-800 font-medium ml-1">
              <li>En <b>Ajustes</b> → <b>Aplicaciones</b> → <b>Esta App</b></li>
              <li>Busca <b>Batería</b> o <b>Uso de batería</b></li>
              <li>Selecciona <b>"Sin restricciones"</b></li>
              <li>O desactiva <b>"Optimizar batería"</b></li>
            </ol>
          </div>

          {/* 3. NOTIFICACIONES */}
          <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500 rounded-2xl flex items-center justify-center shrink-0">
                <Bell size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-purple-900 uppercase">
                  3. Notificaciones Habilitadas
                </h3>
                <p className="text-[10px] text-purple-700 mt-1 font-medium">
                  Te mantendremos informado del registro
                </p>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-purple-800 font-medium ml-1">
              <li>En <b>Ajustes</b> → <b>Aplicaciones</b> → <b>Esta App</b></li>
              <li>Busca <b>Notificaciones</b></li>
              <li>Activa <b>"Permitir notificaciones"</b></li>
              <li>Habilita todas las categorías</li>
            </ol>
          </div>
        </div>

        {/* NOTA IMPORTANTE */}
        <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
          <p className="text-[10px] text-slate-600 font-medium text-center">
            💡 <b>Importante:</b> Después de configurar, regresa y presiona <b>"INICIAR RUTA"</b> nuevamente
          </p>
        </div>

        {/* BOTÓN */}
        <Button 
          onClick={onClose} 
          className="w-full h-16 shadow-xl bg-emerald-600 text-white"
        >
          <CheckCircle2 size={20} /> Entendido, voy a configurar
        </Button>
      </div>
    </div>
  );
};

export default ConfigurationModal;