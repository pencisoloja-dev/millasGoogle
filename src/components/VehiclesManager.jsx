// src/components/VehiclesManager.jsx
import React, { useState } from 'react';
import { Car, Trash2, Plus, Building2, User } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles'; // <--- USAMOS TU HOOK ORIGINAL

const VehiclesManager = ({ user }) => {
  // 1. RECUPERAMOS TU LÓGICA EXACTA
  const { vehicles, addVehicle, deleteVehicle } = useVehicles(user);
  
  const [alias, setAlias] = useState('');
  const [plate, setPlate] = useState('');
  const [ownerType, setOwnerType] = useState('personal'); // 'personal' o 'empresa'
  const [ownerName, setOwnerName] = useState(''); // Solo si es empresa

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alias.trim() || !plate.trim()) return;

    const ownerFinal = ownerType === 'personal' ? 'Propio' : ownerName;

    const success = await addVehicle({
        alias: alias.trim(),
        plate: plate.toUpperCase().trim(),
        owner: ownerFinal
    });

    if (success) {
        setAlias('');
        setPlate('');
        setOwnerName('');
        setOwnerType('personal');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- FORMULARIO CON EL DISEÑO VISUAL CORREGIDO (VERDE FUERTE) --- */}
      <div className="bg-white border rounded-[2.5rem] p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Plus size={16} /> Agregar Vehículo
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Alias y Placa */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 pl-2">Alias (Ej. Ford Roja)</label>
                    <input 
                        type="text" 
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder="Mi Auto"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-emerald-600 transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 pl-2">Placa / Matrícula</label>
                    <input 
                        type="text" 
                        value={plate}
                        onChange={(e) => setPlate(e.target.value)}
                        placeholder="ABC-1234"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 uppercase outline-none focus:border-emerald-600 transition-colors"
                    />
                </div>
            </div>

            {/* Selector de Dueño - AHORA CON EL VERDE FUERTE (EMERALD-600) */}
            <div className="p-1 bg-white space-y-3">
                <div className="flex gap-2">
                    <button 
                        type="button"
                        onClick={() => setOwnerType('personal')}
                        className={`flex-1 py-3 px-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            ownerType === 'personal' 
                            ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-700' // ACTIVO: Verde fuerte
                            : 'bg-slate-50 border border-slate-200 text-slate-400' // INACTIVO
                        }`}
                    >
                        <User size={16} /> Es Mío
                    </button>
                    <button 
                        type="button"
                        onClick={() => setOwnerType('empresa')}
                        className={`flex-1 py-3 px-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                            ownerType === 'empresa' 
                            ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-700' // ACTIVO: Verde fuerte
                            : 'bg-slate-50 border border-slate-200 text-slate-400' // INACTIVO
                        }`}
                    >
                        <Building2 size={16} /> De Empresa
                    </button>
                </div>
                
                {ownerType === 'empresa' && (
                    <input 
                        type="text" 
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Nombre de la Empresa o Dueño"
                        className="w-full p-4 bg-slate-50 border border-emerald-200 rounded-2xl font-bold text-emerald-900 text-sm outline-none focus:border-emerald-600 transition-colors"
                    />
                )}
            </div>

            {/* BOTÓN GUARDAR - IDÉNTICO AL DE "INICIAR RUTA" (EMERALD-600) */}
            <button 
                type="submit" 
                disabled={!alias || !plate} 
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 active:scale-95 transition-all"
            >
                GUARDAR VEHÍCULO
            </button>
        </form>
      </div>

      {/* --- LISTA DE VEHÍCULOS (USANDO TUS DATOS ORIGINALES) --- */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest pl-2">Mis Vehículos</h3>
        
        {vehicles.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed">
                <Car size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">No tienes vehículos registrados</p>
            </div>
        ) : (
            vehicles.map((v) => (
                <div key={v.id} className="bg-white p-4 rounded-3xl border shadow-sm flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                        {/* Icono actualizado al estilo verde */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${v.owner === 'Propio' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Car size={20} />
                        </div>
                        <div>
                            <p className="font-black text-slate-900">{v.alias}</p>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{v.plate}</span>
                                <span>• {v.owner}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => deleteVehicle(v)}
                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default VehiclesManager;
