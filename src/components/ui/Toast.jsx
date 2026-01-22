import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-[5000] flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300 border ${type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-900 border-slate-800 text-white'}`}>
      {type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertTriangle size={20} />}
      <span className="text-[10px] font-black uppercase tracking-widest">{message}</span>
    </div>
  );
};

export default Toast;