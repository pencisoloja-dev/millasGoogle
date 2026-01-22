import React, { useState, useMemo } from 'react';
import { ChevronLeft, Share2, FileText, Car } from 'lucide-react';
import Button from '../components/ui/Button';

const Reports = ({ trips = [], expenses = [] }) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [print, setPrint] = useState(false);
  
  const irsRate = 0.70; 

  const stats = useMemo(() => {
    if (!Array.isArray(trips) || !Array.isArray(expenses)) {
        return { miles: "0.0", deduction: "0.00", expenses: "0.00", rawTrips: [], tripsByVehicle: {} };
    }

    // 1. Filtrar viajes del mes y año (Solo Trabajo)
    const mTrips = trips.filter(t => { 
        let d = new Date();
        if (t.fecha?.seconds) d = new Date(t.fecha.seconds * 1000);
        else if (t.fecha?.toDate) d = t.fecha.toDate();
        return d.getMonth() === month && d.getFullYear() === year && t.tipo === 'trabajo'; 
    });

    // 2. Filtrar gastos
    const mExp = expenses.filter(e => { 
        let d = new Date();
        if (e.uploadedAt?.seconds) d = new Date(e.uploadedAt.seconds * 1000);
        else if (e.uploadedAt?.toDate) d = e.uploadedAt.toDate();
        return d.getMonth() === month && d.getFullYear() === year && e.status === 'approved'; 
    });

    const totMiles = mTrips.reduce((acc, curr) => acc + (parseFloat(curr.millas) || 0), 0);
    const totExp = mExp.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    // --- NUEVA LÓGICA: AGRUPAR POR VEHÍCULO ---
    const tripsByVehicle = {};

    mTrips.forEach(trip => {
        // Obtenemos el nombre del vehículo. Si no tiene, usamos "Sin Asignar"
        let vehicleKey = "Sin Vehículo Asignado";
        
        // Prioridad: 1. Label guardado (ej: "ABC-123 (Toyota)") 2. Alias del objeto vehiculoData 3. Fallback
        if (trip.vehiculoLabel) {
            vehicleKey = trip.vehiculoLabel;
        } else if (trip.vehiculoData?.alias) {
            vehicleKey = `${trip.vehiculoData.plate || ''} (${trip.vehiculoData.alias})`;
        }

        if (!tripsByVehicle[vehicleKey]) {
            tripsByVehicle[vehicleKey] = {
                miles: 0,
                deduction: 0,
                trips: []
            };
        }

        const tripMiles = parseFloat(trip.millas) || 0;
        tripsByVehicle[vehicleKey].miles += tripMiles;
        tripsByVehicle[vehicleKey].deduction += (tripMiles * irsRate);
        tripsByVehicle[vehicleKey].trips.push(trip);
    });
    // ------------------------------------------

    return { 
        miles: totMiles.toFixed(1), 
        deduction: (totMiles * irsRate).toFixed(2), 
        expenses: totExp.toFixed(2), 
        rawTrips: mTrips,
        tripsByVehicle // Devolvemos el objeto agrupado
    };
  }, [trips, expenses, month, year]);

  const handleShare = async () => {
    const monthName = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month];
    
    // Generar texto agrupado para compartir
    let vehiclesText = "";
    Object.entries(stats.tripsByVehicle).forEach(([vehicleName, data]) => {
        vehiclesText += `\n> ${vehicleName}: ${data.miles.toFixed(1)} mi ($${data.deduction.toFixed(2)})`;
    });

    const textData = `
REPORTE MENSUAL: ${monthName} ${year}
-----------------------------
TOTAL MILLAS: ${stats.miles} mi
DEDUCCIÓN TOTAL: $${stats.deduction}
GASTOS APROBADOS: $${stats.expenses}
-----------------------------
DETALLE POR VEHÍCULO:${vehiclesText}
-----------------------------
Generado por Miles & Expenses Pro
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reporte ${monthName} ${year}`,
          text: textData,
        });
      } catch (err) {
        console.log('Error al compartir', err);
      }
    } else {
      alert("Copia este resumen:\n\n" + textData);
    }
  };

  if (print) return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col p-8 overflow-y-auto animate-in fade-in font-sans h-screen">
      <div className="flex justify-between items-center border-b-4 border-slate-900 pb-6 mb-8 shrink-0">
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Resumen</h1>
          <button onClick={() => setPrint(false)} className="p-3 bg-slate-900 text-white rounded-2xl">
              <ChevronLeft size={20}/>
          </button>
      </div>
      <div className="space-y-8 flex-1 pb-safe">
        
        {/* TARJETAS DE RESUMEN GLOBAL */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-50 rounded-3xl border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Total Millas</p>
                <p className="text-3xl font-black">{stats.miles} mi</p>
                <p className="text-xl font-black text-emerald-600 mt-1">${stats.deduction}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Total Gastos</p>
                <p className="text-3xl font-black">${stats.expenses}</p>
            </div>
        </div>

        {/* --- AQUÍ ESTÁ LA MAGIA: Iteramos por cada vehículo encontrado --- */}
        {Object.keys(stats.tripsByVehicle).length > 0 ? (
            Object.entries(stats.tripsByVehicle).map(([vehicleName, vehicleData]) => (
                <div key={vehicleName} className="border rounded-2xl overflow-hidden shadow-sm">
                    {/* Encabezado del Vehículo */}
                    <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Car size={16} className="text-slate-500"/>
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wide">{vehicleName}</h3>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-slate-900">{vehicleData.miles.toFixed(1)} mi</span>
                            <span className="text-[10px] text-emerald-600 font-bold block">${vehicleData.deduction.toFixed(2)}</span>
                        </div>
                    </div>

                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-900 text-white font-black uppercase">
                            <tr>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Ruta</th>
                                <th className="p-3 text-right">Mi</th>
                            </tr>
                        </thead>
                        <tbody className="font-bold text-slate-600 divide-y">
                            {vehicleData.trips.map(t => (
                                <tr key={t.id}>
                                    <td className="p-3 font-black">
                                        {t.fecha?.seconds ? new Date(t.fecha.seconds * 1000).toLocaleDateString() : '---'}
                                    </td>
                                    <td className="p-3 uppercase truncate max-w-[100px] font-bold">
                                        {t.origen || '---'} → {t.destino || '---'}
                                    </td>
                                    <td className="p-3 text-right font-black text-slate-900">{t.millas}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))
        ) : (
             <div className="p-12 text-center border-2 border-dashed rounded-3xl text-slate-300 font-black uppercase">
                Sin registros este mes
             </div>
        )}
      </div>
      
      <div className="mt-8 pt-8 border-t border-dashed space-y-4 shrink-0 pb-10">
          <Button onClick={handleShare} className="w-full h-16 shadow-xl">
              <Share2 size={20} /> Compartir Resumen
          </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col gap-6 p-7 animate-in fade-in font-sans overflow-hidden">
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2 text-center">REPORTES</h2>
      
      <div className="space-y-6 flex-1 overflow-y-auto pb-32 pr-1">
        
        {/* TARJETA MILLAS */}
        <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Millas (Trabajo)</p>
            <p className="text-5xl font-black text-slate-900 leading-none">
                {stats.miles} <span className="text-xl text-slate-200 uppercase font-bold tracking-widest">mi</span>
            </p>
            <div className="mt-6 pt-6 border-t border-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Deducción Estimada (${irsRate}/mi)</p>
                <p className="text-3xl font-black text-emerald-600">${stats.deduction}</p>
            </div>
        </div>

        {/* TARJETA GASTOS */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Gastos Validados</p>
            <p className="text-3xl font-black text-emerald-400 leading-none">${stats.expenses}</p>
        </div>

        {/* FILTROS Y BOTÓN */}
        <div className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
            <div className="grid grid-cols-2 gap-4">
                <select 
                    value={month} 
                    onChange={e => setMonth(parseInt(e.target.value))} 
                    className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black uppercase appearance-none outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                        <option key={i} value={i}>{m}</option>
                    ))}
                </select>
                <select 
                    value={year} 
                    onChange={e => setYear(parseInt(e.target.value))} 
                    className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black uppercase focus:ring-2 focus:ring-emerald-500"
                >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                </select>
            </div>
            <Button onClick={() => setPrint(true)} variant="secondary" className="w-full h-16">
                <FileText size={20} /> Generar Vista Previa
            </Button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
