import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Briefcase, User as UserIcon, Edit2, Trash2, RefreshCw, CalendarDays, Car, ClipboardCheck } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { db } from '../config/firebase';
import { APP_ID } from '../constants';
import { useGPS } from '../hooks/useGPS';
import { useVehicles } from '../hooks/useVehicles';
import Button from '../components/ui/Button';
import ConfigurationModal from '../components/ui/ConfigurationModal';

const MileageTracker = ({ user, trips }) => {
  const { 
    isTracking, miles, type, setType, gpsQuality, wasGPSUsed, 
    startAddress, endAddress, geocodingError,
    startTrip, stopTrip, resetTrip, savePlace 
  } = useGPS();
  
  const { vehicles } = useVehicles(user);
  
  const [formMode, setFormMode] = useState(null); 
  const [editingId, setEditingId] = useState(null);
  const [optimisticTrips, setOptimisticTrips] = useState([]);
  const [showBatteryWarn, setShowBatteryWarn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const [formData, setFormData] = useState({ 
    origen: '', 
    destino: '', 
    manualMiles: '', 
    date: '', 
    proposito: '' 
  });

  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  const getCurrentLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const todayTrips = useMemo(() => {
    const allTrips = [...optimisticTrips, ...trips];
    return allTrips.sort((a,b) => {
        const timeA = a.isOptimistic ? Infinity : (a.fecha?.seconds ?? 0);
        const timeB = b.isOptimistic ? Infinity : (b.fecha?.seconds ?? 0);
        return timeB - timeA;
    });
  }, [trips, optimisticTrips]);

  const formatDateForInput = (timestamp) => {
    if (!timestamp) return getCurrentLocalDate();
    const d = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleStopTrip = async () => {
    const result = await stopTrip();
    setFormMode('create');
    setFormData({ 
       origen: result.startAddress?.formatted || '', 
       destino: result.endAddress?.formatted || '',
       manualMiles: result.miles.toFixed(1),
       date: getCurrentLocalDate(),
       proposito: '' // Limpieza garantizada
    });
  };

  const handleCreateManual = () => {
      setEditingId(null); 
      setFormData({ origen: '', destino: '', manualMiles: '', date: getCurrentLocalDate(), proposito: '' }); 
      setFormMode('create');
  };

  const handleEdit = (trip) => {
      setEditingId(trip.id);
      setType(trip.tipo); 
      setFormData({ 
          origen: trip.origen, 
          destino: trip.destino, 
          manualMiles: trip.millas.toString(),
          date: formatDateForInput(trip.fecha),
          proposito: trip.proposito || '' 
      });
      
      if (trip.vehiculoData?.id) {
         const foundVehicle = vehicles.find(v => v.id === trip.vehiculoData.id);
         setSelectedVehicle(foundVehicle || trip.vehiculoData);
      }
      setFormMode('edit');
  };

  const handleSave = async () => {
    if (!formData.manualMiles) return;

    

    setIsSaving(true);
    
    const [yearInput, monthInput, dayInput] = formData.date.split('-').map(Number);
    const now = new Date();
    const isSameDay = yearInput === now.getFullYear() && monthInput === (now.getMonth() + 1) && dayInput === now.getDate();
    const dateToSave = isSameDay ? new Date() : new Date(yearInput, monthInput - 1, dayInput, 12, 0, 0);
    const firebaseDate = Timestamp.fromDate(dateToSave);

    // APRENDIZAJE AUTOMÁTICO
    if (wasGPSUsed && formMode === 'create') {
        if (startAddress) await savePlace(startAddress.lat, startAddress.lon, formData.origen);
        if (endAddress) await savePlace(endAddress.lat, endAddress.lon, formData.destino);
    }

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
        proposito: formData.proposito.trim(),
        tipo: type,
        modo: wasGPSUsed ? 'gps' : 'manual',
        fecha: firebaseDate,
        vehiculoData: vehiculoInfo,
        vehiculoLabel: vehiculoInfo ? `${vehiculoInfo.plate} (${vehiculoInfo.alias})` : 'No especificado'
    };

    let tempId = null;
    if (formMode === 'create') {
        tempId = 'temp-' + Date.now();
        setOptimisticTrips(prev => [{ ...dataToSave, id: tempId, isOptimistic: true }, ...prev]);
    }

    try {
      const securePath = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes');
      if (formMode === 'create') {
        await addDoc(securePath, { userId: user.uid, created_at: serverTimestamp(), ...dataToSave });
        resetTrip();
      } else {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes', editingId), dataToSave);
      }
      setFormMode(null);
      setFormData({ origen: '', destino: '', manualMiles: '', date: '', proposito: '' });
      setEditingId(null);
    } catch (err) { 
        console.error(err);
        alert("Error al guardar."); 
    } finally { 
        if (tempId) setOptimisticTrips(prev => prev.filter(t => t.id !== tempId));
        setIsSaving(false); 
    }
  };

  const handleStartClick = async () => {
      const { value } = await Preferences.get({ key: 'BATTERY_WARN_SEEN' });
      if (!value) {
          setShowBatteryWarn(true); 
          await Preferences.set({ key: 'BATTERY_WARN_SEEN', value: 'true' }); 
      } else {
          startTrip(); 
      }
  };

  const gpsQualityConfig = {
    good: { text: 'EXCELENTE', color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: 3 },
    medium: { text: 'MODERADA', color: 'text-yellow-500', bgColor: 'bg-yellow-500', icon: 2 },
    poor: { text: 'DÉBIL', color: 'text-red-500', bgColor: 'bg-red-500', icon: 1 }
  };

  const currentQuality = gpsQualityConfig[gpsQuality] || gpsQualityConfig.good;

  return (
    <div className="flex flex-col h-full bg-white font-sans relative overflow-hidden">
      {/* Encabezado y Selector Tipo */}
      <div className="shrink-0 px-7 pt-7 pb-2 z-10 bg-white">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2 text-center">CONTROL DE MILLAS</h2>
          <div className="flex bg-slate-100 p-1 rounded-2xl border shadow-inner shrink-0">
            <button onClick={() => setType('personal')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${type === 'personal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>PERSONAL</button>
            <button onClick={() => setType('trabajo')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${type === 'trabajo' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>TRABAJO</button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 min-h-0">
        <div className="pb-32 pt-2">
          {formMode ? (
            <div className="animate-in zoom-in-95 duration-200">
                <div className="bg-white border-2 border-emerald-500 rounded-[2.5rem] p-6 space-y-4 shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">
                        {formMode === 'edit' ? 'Editar Registro' : 'Confirmar Viaje'}
                    </p>
                    
                    {/* Campos Numéricos y Fecha */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <label className="block text-[9px] font-bold text-slate-400 ml-2 mb-1">DISTANCIA</label>
                            <input type="number" inputMode="decimal" value={formData.manualMiles} onChange={e => setFormData({...formData, manualMiles: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl font-black text-center text-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                            <span className="absolute right-3 bottom-3.5 text-[10px] font-bold text-slate-400">MI</span>
                        </div>
                        <div className="relative">
                            <label className="block text-[9px] font-bold text-slate-400 ml-2 mb-1">FECHA</label>
                            <div className="relative">
                                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 pl-8 bg-slate-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-slate-900 h-[54px]" />
                                <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Direcciones y Propósito */}
                    <div className="space-y-3">
                        <input placeholder="Origen" value={formData.origen} onChange={e => setFormData({...formData, origen: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                        <input placeholder="Destino" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                        
                        <div className="relative">
                            <input 
                                placeholder="Propósito (ej: Entrega de materiales)" 
                                value={formData.proposito} 
                                onChange={e => setFormData({...formData, proposito: e.target.value})} 
                                className="w-full p-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500" 
                            />
                        </div>
                    </div>

                    {/* Vehículos */}
                    {vehicles.length > 0 && (
                        <div className="space-y-2 pt-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Car size={12} /> Vehículo</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x">
                                {vehicles.map(v => (
                                    <button key={v.id} onClick={() => setSelectedVehicle(v)} className={`shrink-0 px-4 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedVehicle?.id === v.id ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200'}`}>
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Visualizador Principal */}
                <div className="h-64 rounded-[2.5rem] bg-white shadow-lg flex flex-col justify-center items-center p-8 relative border border-slate-50 overflow-hidden shrink-0">
                    <div className={`flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm transition-opacity duration-300 ${isTracking ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <div className="flex items-end gap-0.5 h-4">
                            <div className={`w-1 h-2 rounded-sm ${currentQuality.bgColor}`}></div>
                            <div className={`w-1 h-3 rounded-sm ${currentQuality.icon >= 2 ? currentQuality.bgColor : 'bg-slate-200'}`}></div>
                            <div className={`w-1 h-4 rounded-sm ${currentQuality.icon >= 3 ? currentQuality.bgColor : 'bg-slate-200'} ${currentQuality.icon >= 3 ? 'animate-pulse' : ''}`}></div>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${currentQuality.color}`}>GPS {currentQuality.text}</span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1">
                        <span className="text-7xl font-black text-slate-900 tracking-tighter tabular-nums">{miles.toFixed(1)}</span>
                        <span className="text-xl text-slate-400 uppercase font-bold translate-y-[-4px]">mi</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Millas Recorridas</p>
                    <Button onClick={isTracking ? handleStopTrip : handleStartClick} variant={isTracking ? "danger" : "primary"} className="w-full mt-6 h-16 shadow-2xl z-10">
                        {isTracking ? "DETENER RUTA" : "INICIAR RUTA"}
                    </Button>
                    {!isTracking && <button onClick={handleCreateManual} className="mt-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-800 transition-colors p-2">Ingresar Manualmente</button>}
                </div>
                
                {/* Historial */}
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-10">Historial Reciente</p>
                    <div className="space-y-3">
                        {todayTrips.map(trip => (
                            <div key={trip.id} className={`p-4 border rounded-[2rem] flex items-center gap-3 shadow-sm hover:shadow-md transition-all ${trip.isOptimistic ? 'bg-emerald-50/50 border-emerald-100 animate-pulse' : 'bg-white border-slate-100'}`}>
                                <div className={`w-10 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${trip.tipo === 'trabajo' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                    <div className={`w-2 h-2 rounded-full ${trip.tipo === 'trabajo' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                    <div className="w-0.5 h-4 bg-slate-200 my-1" />
                                    <div className={`w-2 h-2 rounded-full border-2 ${trip.tipo === 'trabajo' ? 'border-emerald-500' : 'border-slate-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-slate-800 truncate leading-tight">{trip.origen || 'Origen no detectado'}</p>
                                    <p className="text-[11px] font-bold text-slate-500 truncate leading-tight mt-1">{trip.destino || 'Destino no detectado'}</p>
                                    
                                    {trip.proposito && (
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase italic mt-1 flex items-center gap-1">
                                            <Briefcase size={10} /> {trip.proposito}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                                        <p className="text-[9px] text-slate-400 font-bold">{formatDateForInput(trip.fecha)}</p>
                                        {trip.vehiculoLabel && (
                                            <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">{trip.vehiculoLabel.split(' ')[0]}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <div className="text-right">
                                        <span className="text-lg font-black text-slate-900">{trip.millas.toFixed(1)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 ml-0.5">mi</span>
                                    </div>
                                    {!trip.isOptimistic && (
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(trip)} className="p-2 bg-slate-50 text-slate-400 rounded-xl active:bg-slate-900 active:text-white"><Edit2 size={14} /></button>
                                            <button onClick={async () => { if(window.confirm("¿Eliminar?")) await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'viajes', trip.id)) }} className="p-2 bg-rose-50 text-rose-400 rounded-xl active:bg-rose-600 active:text-white"><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
      {showBatteryWarn && <ConfigurationModal onClose={() => { setShowBatteryWarn(false); startTrip(); }} />}
    </div>
  );
};

export default MileageTracker;
