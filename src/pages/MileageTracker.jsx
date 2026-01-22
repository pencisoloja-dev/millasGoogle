import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Briefcase, User as UserIcon, Edit2, Trash2, RefreshCw, CalendarDays, Car } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { db } from '../config/firebase';
import { APP_ID } from '../constants';
import { useGPS } from '../hooks/useGPS';
import { useVehicles } from '../hooks/useVehicles';
import Button from '../components/ui/Button';
import ConfigurationModal from '../components/ui/ConfigurationModal';


const MileageTracker = ({ user, trips }) => {
// 🆕 Ahora recibimos también startAddress, endAddress y geocodingError
  const { 
    isTracking, 
    miles, 
    type, 
    setType, 
    gpsQuality, 
    wasGPSUsed, 
    startAddress,      // 🆕
    endAddress,        // 🆕
    geocodingError,    // 🆕
    startTrip, 
    stopTrip, 
    resetTrip 
  } = useGPS();
  
  const { vehicles } = useVehicles(user);
  
  const [formMode, setFormMode] = useState(null); 
  const [editingId, setEditingId] = useState(null);
  
  const [optimisticTrips, setOptimisticTrips] = useState([]);
  
  const [showBatteryWarn, setShowBatteryWarn] = useState(false);
  const [formData, setFormData] = useState({ origen: '', destino: '', manualMiles: '', date: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Selección automática del primer vehículo por defecto
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);
const getCurrentLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayTrips = useMemo(() => {
    const allTrips = [...optimisticTrips, ...trips];
    return allTrips.sort((a,b) => {
        const timeA = a.isOptimistic ? Infinity : (a.fecha?.seconds ?? 0);
        const timeB = b.isOptimistic ? Infinity : (b.fecha?.seconds ?? 0);
        if (timeA === Infinity && timeB === Infinity) return 0;
        return timeB - timeA;
    });
  }, [trips, optimisticTrips]);

  const formatDateForInput = (timestamp) => {
    if (!timestamp) return getCurrentLocalDate();
    const d = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp;
    if (d instanceof Date && !isNaN(d)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return getCurrentLocalDate();
  };
// 🆕 MODIFICADO: Ahora recibe y usa las direcciones automáticas
  const handleStopTrip = async () => {
    const result = await stopTrip();
    setFormMode('create');
    
    // 🆕 Pre-llenar origen y destino con las direcciones geocodificadas
    setFormData({ 
       origen: result.startAddress?.formatted || '', // 🆕 Dirección automática o vacío
       destino: result.endAddress?.formatted || '',  // 🆕 Dirección automática o vacío
       manualMiles: result.miles.toFixed(1),
       date: getCurrentLocalDate()
    });
  };

  const handleCreateManual = () => {
      setEditingId(null); 
      setFormData({ 
          origen: '', 
          destino: '', 
          manualMiles: '', 
          date: getCurrentLocalDate() 
      }); 
      setFormMode('create');
  };
const handleEdit = (trip) => {
      setEditingId(trip.id);
      
      // Actualizamos el tipo usando la función segura del hook
      setType(trip.tipo); 
      
      setFormData({ 
          origen: trip.origen, 
          destino: trip.destino, 
          manualMiles: trip.millas.toString(),
          date: formatDateForInput(trip.fecha)
      });
      
      // Lógica robusta para recuperar el vehículo
      if (trip.vehiculoData && trip.vehiculoData.id) {
         // Buscamos el vehículo en la lista actual para asegurar que tenemos la data más reciente
         const foundVehicle = vehicles.find(v => v.id === trip.vehiculoData.id);
         setSelectedVehicle(foundVehicle || trip.vehiculoData);
      } else if (trip.vehiculoData) {
         // Fallback por si es un dato antiguo sin ID
         setSelectedVehicle(trip.vehiculoData);
      }
      
      setFormMode('edit');
  };
const handleSave = async () => {
    if (!formData.manualMiles) return;
    setIsSaving(true);
    
    const [yearInput, monthInput, dayInput] = formData.date.split('-').map(Number);
    const now = new Date();
    const isSameDay = 
        yearInput === now.getFullYear() && 
        monthInput === (now.getMonth() + 1) && 
        dayInput === now.getDate();

    let dateToSave;

    if (isSameDay) {
        dateToSave = new Date(); 
    } else {
        dateToSave = new Date(yearInput, monthInput - 1, dayInput, 12, 0, 0);
    }

    const firebaseDate = Timestamp.fromDate(dateToSave);

    // Guardamos el ID del vehículo explícitamente
    const vehiculoInfo = selectedVehicle ? {
        id: selectedVehicle.id,
        alias: selectedVehicle.alias,
        plate: selectedVehicle.plate,
        owner: selectedVehicle.owner
    } : null;

    const dataToSave = {
        millas: parseFloat(formData.manualMiles) || 0,
        origen: formData.origen.trim(),
        destino: formData.destino.trim(),
        tipo: type,
        modo: wasGPSUsed ? 'gps' : 'manual',
        fecha: firebaseDate,
        vehiculoData: vehiculoInfo,
        vehiculoLabel: vehiculoInfo ? `${vehiculoInfo.plate} (${vehiculoInfo.alias})` : 'No especificado'
    };

    let tempId = null;
    if (formMode === 'create') {
        tempId = 'temp-' + Date.now();
        const optimisticTrip = { 
            ...dataToSave, 
            id: tempId, 
            isOptimistic: true 
        };
        setOptimisticTrips(prev => [optimisticTrip, ...prev]);
        setFormMode(null);
        setFormData({ origen: '', destino: '', manualMiles: '', date: '' });
    }

    try {
      const securePath = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes');
      
      if (formMode === 'create') {
        await addDoc(securePath, { 
            userId: user.uid, 
            created_at: serverTimestamp(), 
            ...dataToSave, 
        });
        resetTrip();

      } else {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes', editingId), { 
            millas: dataToSave.millas, 
            origen: dataToSave.origen, 
            destino: dataToSave.destino,
            tipo: dataToSave.tipo,   
            fecha: dataToSave.fecha,
            vehiculoData: dataToSave.vehiculoData,
            vehiculoLabel: dataToSave.vehiculoLabel
        });
        setFormMode(null);
        setFormData({ origen: '', destino: '', manualMiles: '', date: '' });
        setEditingId(null);
      }
    } catch (err) { 
        console.error(err);
        alert("Revisa tu conexión a internet."); 
    } finally { 
        if (tempId) {
            setOptimisticTrips(prev => prev.filter(t => t.id !== tempId));
        }
        setIsSaving(false); 
    }
  };
// Verificación asíncrona segura con Preferences
  const handleStartClick = async () => {
      const { value } = await Preferences.get({ key: 'BATTERY_WARN_SEEN' });
      
      if (!value) {
          setShowBatteryWarn(true); 
          await Preferences.set({ key: 'BATTERY_WARN_SEEN', value: 'true' }); 
      } else {
          startTrip(); 
      }
  };

  // Configuración visual de calidad GPS
  const gpsQualityConfig = {
    good: { text: 'EXCELENTE', color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: 3 },
    medium: { text: 'MODERADA', color: 'text-yellow-500', bgColor: 'bg-yellow-500', icon: 2 },
    poor: { text: 'DÉBIL', color: 'text-red-500', bgColor: 'bg-red-500', icon: 1 }
  };

  const currentQuality = gpsQualityConfig[gpsQuality] || gpsQualityConfig.good;
return (
    <div className="flex flex-col h-full bg-white font-sans relative overflow-hidden">
      
      {/* 1. CABECERA FIJA */}
      <div className="shrink-0 px-7 pt-7 pb-2 z-10 bg-white">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2 text-center">CONTROL DE MILLAS</h2>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl border shadow-inner shrink-0">
            <button onClick={() => setType('personal')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${type === 'personal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>PERSONAL</button>
            <button onClick={() => setType('trabajo')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${type === 'trabajo' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>TRABAJO</button>
          </div>
      </div>

      {/* 2. ÁREA DE CONTENIDO SCROLLEABLE */}
      <div className="flex-1 overflow-y-auto px-7 min-h-0">
        <div className="pb-32 pt-2">
{formMode ? (
                // --- MODO FORMULARIO ---
                <div className="animate-in zoom-in-95 duration-200">
                    <div className="bg-white border-2 border-emerald-500 rounded-[2.5rem] p-6 space-y-4 shadow-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">
                            {formMode === 'edit' ? 'Editar Registro' : 'Confirmar Viaje'}
                        </p>
                        
                        {/* INPUTS - Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <label className="block text-[9px] font-bold text-slate-400 ml-2 mb-1">DISTANCIA</label>
                                <input type="number" inputMode="decimal" value={formData.manualMiles} onChange={e => setFormData({...formData, manualMiles: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl font-black text-center text-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                                <span className="absolute right-3 bottom-3.5 text-[10px] font-bold text-slate-400">MI</span>
                            </div>
                            <div className="relative">
                                <label className="block text-[9px] font-bold text-slate-400 ml-2 mb-1">FECHA</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={formData.date} 
                                        onChange={e => setFormData({...formData, date: e.target.value})} 
                                        className="w-full p-3 pl-8 bg-slate-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-slate-900 h-[54px]" 
                                    />
                                    <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>

{/* 🆕 MENSAJE DE ERROR DE GEOCODIFICACIÓN */}
                        {geocodingError && formMode === 'create' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
                                <span className="text-amber-600 text-xs">⚠️</span>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">
                                        No se pudo obtener dirección automática
                                    </p>
                                    <p className="text-[9px] text-amber-600">
                                        {geocodingError}. Por favor ingresa manualmente.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* INPUTS - Texto */}
                        <div className="space-y-3">
                            <div>
                                <input placeholder="Origen" value={formData.origen} onChange={e => setFormData({...formData, origen: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <input placeholder="Destino" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                        </div>

{/* VEHÍCULOS */}
                        {vehicles.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1">
                                    <Car size={12} /> Vehículo
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x">
                                    {vehicles.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVehicle(v)}
                                            className={`shrink-0 px-4 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedVehicle?.id === v.id ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            {v.alias}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 space-y-3">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 shadow-xl text-sm">
                                {isSaving ? <RefreshCw className="animate-spin" /> : "GUARDAR REGISTRO"}
                            </Button>
                            <button onClick={() => setFormMode(null)} className="w-full text-[10px] font-black text-slate-400 uppercase py-3 hover:bg-slate-50 rounded-xl">Cancelar</button>
                        </div>
                    </div>
                </div>
            ) : (

// --- MODO DASHBOARD + LISTA ---
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="h-64 rounded-[2.5rem] bg-white shadow-lg flex flex-col justify-center items-center p-8 relative border border-slate-50 overflow-hidden shrink-0">
                        
                      {/* INDICADOR GPS MEJORADO - CENTRADO */}
                {isTracking && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
                    <div className="flex items-end gap-0.5 h-4">
                      <div className={`w-1 h-2 rounded-sm ${currentQuality.bgColor}`}></div>
                      <div className={`w-1 h-3 rounded-sm ${currentQuality.icon >= 2 ? currentQuality.bgColor : 'bg-slate-200'}`}></div>
                      <div className={`w-1 h-4 rounded-sm ${currentQuality.icon >= 3 ? currentQuality.bgColor : 'bg-slate-200'} ${currentQuality.icon >= 3 ? 'animate-pulse' : ''}`}></div>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${currentQuality.color}`}>
                      GPS {currentQuality.text}
                    </span>
                  </div>
                )}
                
                {/* Número grande de millas */}
                <div className="flex items-baseline justify-center gap-1">
                    <span className="text-7xl font-black text-slate-900 tracking-tighter tabular-nums">
                        {miles.toFixed(1)}
                    </span>
                    <span className="text-xl text-slate-400 uppercase font-bold translate-y-[-4px]">
                        mi
                    </span>
                </div>
                
                {/* Texto debajo del número */}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Millas Recorridas</p>

                        <Button 
                            onClick={isTracking ? handleStopTrip : handleStartClick} 
                            variant={isTracking ? "danger" : "primary"} 
                            className="w-full mt-6 h-16 shadow-2xl z-10"
                        >
                            {isTracking ? "DETENER RUTA" : "INICIAR RUTA"}
                        </Button>
                        
                        {!isTracking && <button onClick={handleCreateManual} className="mt-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-800 transition-colors p-2">Ingresar Manualmente</button>}
                    </div>
                    
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-10">Historial Reciente</p>
                        <div className="space-y-3">
                            {todayTrips.map(trip => (
                                <div key={trip.id} className={`p-4 border rounded-3xl flex justify-between items-center shadow-sm hover:shadow-md transition-all ${trip.isOptimistic ? 'bg-emerald-50/50 border-emerald-100 animate-pulse' : 'bg-white'}`}>
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${trip.tipo === 'trabajo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                            {trip.isOptimistic ? <RefreshCw size={20} className="animate-spin" /> : (trip.tipo === 'trabajo' ? <Briefcase size={20} /> : <UserIcon size={20} />)}
                                        </div>
                                        <div className="truncate pr-2 flex-1">
                                            <p className="font-black text-slate-900 leading-none text-xl mb-1">{trip.millas} <span className="text-sm text-slate-300">mi</span></p>
                                            <p className="text-[10px] text-slate-500 font-bold truncate w-full mb-1">
                                                {trip.origen || '---'} <span className="text-slate-300">➔</span> {trip.destino || '---'}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[9px] text-slate-400 uppercase font-bold">
                                                    {formatDateForInput(trip.fecha)}
                                                </p>
                                                {trip.vehiculoLabel && (
                                                    <>
                                                        <span className="text-[8px] text-slate-300">•</span>
                                                        <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1 rounded uppercase">
                                                            {trip.vehiculoLabel.split(' ')[0]}
                                                        </span>
                                                    </>
                                                )}
                                                {trip.isOptimistic && <span className="text-[8px] text-emerald-500 font-bold bg-emerald-100 px-1 rounded">GUARDANDO...</span>}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!trip.isOptimistic && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => handleEdit(trip)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl active:bg-slate-900 active:text-white transition-colors">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={async () => { if(window.confirm("¿Eliminar?")) await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes', trip.id)) }} className="p-3 bg-rose-50 text-rose-400 rounded-2xl active:bg-rose-600 active:text-white transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
{showBatteryWarn && (
    <ConfigurationModal onClose={() => { setShowBatteryWarn(false); startTrip(); }} />
)}
    </div>
  );
};

export default MileageTracker;