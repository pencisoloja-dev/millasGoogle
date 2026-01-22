import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Importamos la funcion de reset
import { Briefcase, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { auth } from '../config/firebase';
import Button from '../components/ui/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState(''); // Estado para mensajes de éxito
  const [imgLoaded, setImgLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setInfo('');
    try { 
      await signInWithEmailAndPassword(auth, email, password); 
    } catch (e) { 
      console.error(e); 
      setErr("Credenciales incorrectas o error de red."); 
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
        setErr("Por favor escribe tu email en la casilla de arriba primero.");
        return;
    }
    setLoading(true);
    setErr('');
    setInfo('');
    try {
        await sendPasswordResetEmail(auth, email);
        setInfo("¡Listo! Revisa tu correo para cambiar la contraseña.");
    } catch (e) {
        console.error(e);
        if (e.code === 'auth/user-not-found') setErr("Este email no está registrado.");
        else setErr("Error al enviar el correo.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white px-10 items-center justify-center font-sans overflow-hidden">
      
      <div className="mb-12 text-center w-full max-w-xs animate-in zoom-in-95 duration-500">
        <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-slate-100 relative overflow-hidden">
           {!imgLoaded && <div className="absolute inset-0 flex items-center justify-center text-slate-200"><Briefcase size={48} /></div>}
           <img src="logo.png" alt="App Logo" className={`w-full h-full object-contain p-4 transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setImgLoaded(true)} onError={(e) => { e.target.style.display='none'; setImgLoaded(false); }} />
           {!imgLoaded && <Briefcase size={48} className="text-slate-300 absolute" />}
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight mb-2 text-center">Miles & Expenses Pro</h2>
      </div>

      {/* Mensajes de Error y Exito */}
      {err && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black rounded-xl text-center uppercase w-full max-w-xs animate-in zoom-in-95">{err}</div>}
      {info && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black rounded-xl text-center uppercase w-full max-w-xs animate-in zoom-in-95">{info}</div>}

      <form onSubmit={handleAuth} className="space-y-5 w-full max-w-xs animate-in slide-in-from-bottom-4 duration-700">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
        <div className="relative">
          <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 pr-12 transition-all" />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 hover:text-slate-600 transition-colors">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </div>
        
        {/* Enlace de Olvidé mi contraseña */}
        <div className="text-right">
            <button type="button" onClick={handleForgotPassword} className="text-[10px] font-black text-slate-400 uppercase hover:text-emerald-600 transition-colors">
                ¿Olvidaste tu contraseña?
            </button>
        </div>

        <Button type="submit" variant="secondary" disabled={loading} className="w-full h-16 mt-4 uppercase tracking-widest font-black shadow-xl active:scale-95 transition-all">
            {loading ? <RefreshCw className="animate-spin" /> : "Ingresar"}
        </Button>
      </form>
      
      <div className="mt-12 text-center opacity-50">
          <p className="text-[9px] text-slate-400 font-bold uppercase">v1.0 • Final Release</p>
      </div>
    </div>
  );
};

export default Login;
