import React, { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, deleteField } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Camera, RefreshCw, AlertTriangle, Trash2, X, CheckCircle2, Send, Eye } from 'lucide-react';
import { db, storage } from '../config/firebase'; 
import { APP_ID } from '../constants';
import Button from '../components/ui/Button'; 

const Expenses = ({ user, expenses = [], onShowToast }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [viewingItem, setViewingItem] = useState(null); 
  const [aclaracionText, setAclaracionText] = useState('');
  const [isSendingAclaracion, setIsSendingAclaracion] = useState(false);

  // --- 1. LÓGICA: Filtrar últimos 30 días + Tope de seguridad ---
  const weeklyExpenses = useMemo(() => {
    if (!expenses) return [];
    
    // Filtro de tiempo
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filtered = [...expenses].filter(e => {
        const time = e.uploadedAt?.seconds ? e.uploadedAt.seconds * 1000 : Date.now();
        return time >= thirtyDaysAgo;
    });

    // Ordenar y aplicar LÍMITE DE SEGURIDAD (50 items máx)
    return filtered
        .sort((a, b) => {
            const dateA = a.uploadedAt?.seconds ?? (Date.now()/1000 + 10000);
            const dateB = b.uploadedAt?.seconds ?? (Date.now()/1000 + 10000);
            return dateB - dateA;
        })
        .slice(0, 50); // <--- MEJORA: Evita colapsar la memoria si hay demasiados registros
  }, [expenses]);

  // --- 2. LÓGICA: Eliminar Gasto ---
  const handleDelete = async (item, askConfirmation = true) => {
      if (askConfirmation && !confirm("¿Confirmas que deseas eliminar este registro permanentemente?")) return;
      try {
        if (viewingItem?.id === item.id) setViewingItem(null);
        
        // Borrar documento
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gastos', item.id));
        
        // Borrar imagen del storage
        if(item.storage_path) {
            const imageRef = ref(storage, item.storage_path);
            deleteObject(imageRef).catch(err => console.log("Imagen ya no existía o error:", err));
        }
        
        if (!askConfirmation) onShowToast("Registro eliminado", "success");
      } catch (error) {
        console.error(error);
        onShowToast("Error al eliminar", "error");
      }
  };

  // --- 3. LÓGICA: Enviar Aclaración (Chat con Admin) ---
  const handleSendAclaracion = async () => {
    if (!aclaracionText.trim()) return;
    setIsSendingAclaracion(true);
    try {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gastos', viewingItem.id);
      await updateDoc(docRef, {
        clientAclaracion: aclaracionText,
        status: 'pending', // Vuelve a pendiente
        updatedAt: serverTimestamp()
      });
      onShowToast("Aclaración enviada. El admin revisará nuevamente.", "success");
      setViewingItem(null);
      setAclaracionText('');
    } catch (error) {
      onShowToast("Error al enviar", "error");
    } finally {
      setIsSendingAclaracion(false);
    }
  };

  // --- 4. LÓGICA: Cámara Optimizada (Común) ---
  const takePhoto = async () => {
      const { Camera: CapCamera, CameraResultType, CameraSource, CameraDirection } = await import('@capacitor/camera');
      try {
          const image = await CapCamera.getPhoto({ 
              quality: 70, 
              allowEditing: false, 
              resultType: CameraResultType.DataUrl, 
              source: CameraSource.Camera,
              direction: CameraDirection.Rear,
              width: 1024, // <--- CRÍTICO: Mantiene las fotos ligeras (~300kb)
              correctOrientation: true
          });
          return image;
      } catch (e) {
          console.log("Usuario canceló cámara");
          return null;
      }
  };

  // --- 4A. Subir NUEVO Gasto ---
  const handleNewUpload = async () => {
      const image = await takePhoto();
      if (!image || !image.dataUrl) return;

      setIsUploading(true);
      try {
          const fileName = `${Date.now()}_recibo.jpg`;
          const storagePath = `fotos_recibos/${user.uid}/${fileName}`;
          const sRef = ref(storage, storagePath);
          
          await uploadString(sRef, image.dataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(sRef);
          
          await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'gastos'), { 
              userId: user.uid, 
              imageUrl: downloadUrl, 
              status: "pending", 
              uploadedAt: serverTimestamp(), 
              amount: 0, 
              storage_path: storagePath
          });
          onShowToast("Enviado para revisión", "success");
      } catch (e) {
          onShowToast("Error al subir", "error");
      } finally { setIsUploading(false); }
  };

  // --- 4B. Corregir Gasto (Actualización Inteligente) ---
  const handleCorrectionUpload = async () => {
      if (!viewingItem) return;

      const image = await takePhoto();
      if (!image || !image.dataUrl) return;

      setIsUploading(true);
      try {
          // 1. Subir nueva foto
          const fileName = `${Date.now()}_correccion.jpg`;
          const newStoragePath = `fotos_recibos/${user.uid}/${fileName}`;
          const sRef = ref(storage, newStoragePath);
          await uploadString(sRef, image.dataUrl, 'data_url');
          const newDownloadUrl = await getDownloadURL(sRef);

          // 2. Limpiar foto antigua
          if (viewingItem.storage_path) {
              const oldRef = ref(storage, viewingItem.storage_path);
              deleteObject(oldRef).catch(() => console.log("Foto vieja no encontrada, continuando..."));
          }

          // 3. Actualizar documento
          const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'gastos', viewingItem.id);
          await updateDoc(docRef, {
              imageUrl: newDownloadUrl,
              storage_path: newStoragePath,
              status: 'pending', 
              rejectionReason: deleteField(), // Borramos la razón anterior
              updatedAt: serverTimestamp()
          });

          onShowToast("Corrección enviada con éxito", "success");
          setViewingItem(null);

      } catch (e) {
          console.error(e);
          onShowToast("Error al corregir", "error");
      } finally { setIsUploading(false); }
  };

  // --- 5. RENDER: Modal de Detalle ---
  if (viewingItem) return (
    <div className="fixed inset-0 bg-black z-[3000] flex flex-col animate-in fade-in duration-200">
      {/* Header Modal */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent h-24">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <p className="text-white text-[10px] font-black uppercase tracking-widest">
                {new Date((viewingItem.uploadedAt?.seconds || 0) * 1000).toLocaleDateString()}
            </p>
          </div>
          <button onClick={() => {setViewingItem(null); setAclaracionText('');}} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white"><X size={24} /></button>
      </div>

      {/* Imagen Full Screen */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
          <img src={viewingItem.imageUrl} className="max-w-full max-h-full object-contain" alt="Comprobante" />
          {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2 z-50">
                  <RefreshCw className="animate-spin" size={40}/>
                  <p className="font-bold text-sm uppercase tracking-widest">Subiendo corrección...</p>
              </div>
          )}
      </div>

      {/* Panel Inferior */}
      <div className="bg-slate-900 rounded-t-[2.5rem] p-8 pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 shrink-0">
         {viewingItem.status === 'rejected' ? (
             <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-3xl">
                    <div className="p-2 bg-rose-500 rounded-full text-white"><AlertTriangle size={20} /></div>
                    <div className="text-left">
                        <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-1">Motivo del Rechazo</p>
                        <p className="text-white font-bold leading-tight text-sm">{viewingItem.rejectionReason}</p>
                    </div>
                </div>
                
                {/* Chat de Aclaración */}
                <div className="relative">
                  <textarea 
                    value={aclaracionText}
                    onChange={(e) => setAclaracionText(e.target.value)}
                    placeholder="Escribe aquí si no estás de acuerdo o para aclarar..."
                    className="w-full bg-slate-800 rounded-2xl p-4 text-white text-sm font-medium border border-slate-700 outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                  />
                  {aclaracionText.trim() && (
                    <button 
                      onClick={handleSendAclaracion}
                      disabled={isSendingAclaracion}
                      className="absolute bottom-3 right-3 p-2 bg-blue-500 text-white rounded-xl shadow-lg animate-in zoom-in"
                    >
                      {isSendingAclaracion ? <RefreshCw className="animate-spin" size={18}/> : <Send size={18}/>}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleDelete(viewingItem, true)} className="py-4 rounded-2xl bg-slate-800 text-rose-400 font-black text-[10px] uppercase tracking-widest">
                        Aceptar y Borrar
                    </button>
                    <button onClick={handleCorrectionUpload} disabled={isUploading} className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:bg-emerald-600 transition-colors">
                        <Camera size={16} /> Volver a tomar
                    </button>
                </div>
             </div>
         ) : (
             <div className="flex flex-col gap-4 text-left">
                 <div className="flex justify-between items-center px-2">
                    <div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 text-left">Estado</p>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-2 ${viewingItem.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                           {viewingItem.status === 'approved' ? <CheckCircle2 size={14}/> : <RefreshCw size={14}/>}
                           {viewingItem.status === 'approved' ? 'Aprobado' : 'En Revisión'}
                        </span>
                    </div>
                    <button onClick={() => handleDelete(viewingItem, true)} className="p-4 bg-slate-800 rounded-2xl text-rose-500"><Trash2 size={20} /></button>
                 </div>
                 <Button onClick={() => setViewingItem(null)} variant="secondary" className="w-full bg-slate-800 border-slate-700">Cerrar</Button>
             </div>
         )}
      </div>
    </div>
  );

  // --- 6. RENDER: Pantalla Principal ---
  return (
    <div className="h-full flex flex-col gap-6 p-7 font-sans bg-slate-50">
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter text-center">CONTROL DE GASTOS</h2>
      
      {/* Botón de Subida */}
      <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <Camera size={28} />
        </div>
        <div>
            <p className="text-sm font-black text-slate-900 uppercase">Nuevo Comprobante</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Sube una foto de tu recibo o factura</p>
        </div>
        <Button onClick={handleNewUpload} disabled={isUploading} className="w-full shadow-xl !bg-emerald-600 !hover:bg-emerald-700 !text-white">
            {isUploading ? <RefreshCw className="animate-spin" /> : "TOMAR FOTO"}
        </Button>
      </div>

      {/* Lista de Gastos */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 -mx-2 px-2">
          <div className="flex justify-between items-end mb-4 pl-2 pr-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recientes (30 días)</p>
              <p className="text-[9px] font-bold text-slate-300 uppercase">{weeklyExpenses.length} REGISTROS</p>
          </div>
          
          <div className="space-y-3">
              {weeklyExpenses.length > 0 ? weeklyExpenses.map(item => (
                  <div key={item.id} onClick={() => setViewingItem(item)} className="bg-white p-3 rounded-3xl border shadow-sm flex items-center gap-4 active:scale-95 transition-transform cursor-pointer relative overflow-hidden group">
                      
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.status === 'approved' ? 'bg-emerald-500' : item.status === 'rejected' ? 'bg-rose-500' : 'bg-yellow-400'}`}></div>

                      <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden shrink-0 relative ml-2">
                          <img 
                              src={item.imageUrl} 
                              alt="Recibo" 
                              loading="lazy" // <--- MEJORA: Ahorro de datos y memoria
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye size={16} />
                          </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 py-1">
                          <div className="flex justify-between items-start">
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {item.uploadedAt?.seconds ? new Date(item.uploadedAt.seconds * 1000).toLocaleDateString() : 'Pendiente...'}
                             </p>
                             {item.status === 'rejected' && <AlertTriangle size={14} className="text-rose-500 animate-pulse" />}
                          </div>
                          
                          <p className="text-lg font-black text-slate-900 leading-tight truncate mt-1">
                              {item.amount > 0 ? `$${item.amount}` : <span className="text-slate-300 italic text-sm">Procesando...</span>}
                          </p>

                          <div className="flex items-center gap-1 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'approved' ? 'bg-emerald-500' : item.status === 'rejected' ? 'bg-rose-500' : 'bg-yellow-400'}`}></div>
                              <p className={`text-[9px] font-black uppercase ${item.status === 'approved' ? 'text-emerald-600' : item.status === 'rejected' ? 'text-rose-500' : 'text-yellow-600'}`}>
                                  {item.status === 'approved' ? 'Aprobado' : item.status === 'rejected' ? 'Rechazado' : 'En Revisión'}
                              </p>
                          </div>
                      </div>
                  </div>
              )) : (
                  <div className="text-center py-10 opacity-50">
                      <p className="text-[10px] font-black uppercase text-slate-300">No hay registros recientes</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Expenses;
