import React, { useState } from 'react';
import { X, Lock, RefreshCw, Eye, EyeOff } from 'lucide-react'; // Agregamos Eye y EyeOff
import { updatePassword, signOut } from 'firebase/auth';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { APP_ID } from '../../constants';
import Button from './Button';

// --- MODAL PASSWORD SOLAMENTE ---
export const PasswordResetModal = ({ user, onClose, forced = false }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // NUEVO: Estados para alternar la visibilidad de las contraseñas
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUpdate = async () => {
    if (newPassword.length < 6) return setError("Mínimo 6 caracteres");
    if (newPassword !== confirmPassword) return setError("Las contraseñas no coinciden");
    
    setLoading(true);
    setError('');
    try {
      await updatePassword(user, newPassword);
      if (forced) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid), {
          require_password_reset: false,
          last_password_update: serverTimestamp()
        });
      }
      alert("Contraseña actualizada correctamente.");
      if (onClose) onClose();
    } catch (e) {
      console.error(e);
      setError("Error: Re-autenticación requerida. Cierra sesión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[3000] flex flex-col justify-center items-center p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl relative">
        {!forced && (
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        )}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-4 text-emerald-600">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase leading-tight">
            {forced ? "Actualización Requerida" : "Cambiar Contraseña"}
          </h2>
          {forced && <p className="text-xs text-rose-500 font-bold mt-2 uppercase tracking-wide">Por seguridad, debes actualizar tu contraseña temporal.</p>}
        </div>
        
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-xl text-center">{error}</div>}
        
        <div className="space-y-4">
          
          {/* Input Nueva Contraseña con Ojito */}
          <div className="relative">
            <input 
              type={showNew ? "text" : "password"} 
              placeholder="Nueva Contraseña" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center pr-12" 
            />
            <button 
              type="button" 
              onClick={() => setShowNew(!showNew)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 hover:text-slate-600 transition-colors"
            >
              {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Input Confirmar Contraseña con Ojito */}
          <div className="relative">
            <input 
              type={showConfirm ? "text" : "password"} 
              placeholder="Confirmar Nueva Contraseña" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center pr-12" 
            />
            <button 
              type="button" 
              onClick={() => setShowConfirm(!showConfirm)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 hover:text-slate-600 transition-colors"
            >
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <Button onClick={handleUpdate} disabled={loading} className="w-full h-16 shadow-xl mt-4">
            {loading ? <RefreshCw className="animate-spin" /> : "GUARDAR NUEVA CONTRASEÑA"}
          </Button>
          
          {forced && (
             <button onClick={() => signOut(auth)} className="w-full text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">
               Cancelar y Cerrar Sesión
             </button>
          )}
        </div>
      </div>
    </div>
  );
};