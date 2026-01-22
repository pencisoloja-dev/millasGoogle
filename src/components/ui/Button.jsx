import React from 'react';

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, icon: Icon }) => {
  const styles = {
    primary: "bg-emerald-600 text-white active:bg-emerald-800 shadow-lg shadow-emerald-200/50",
    secondary: "bg-slate-900 text-white active:bg-slate-950 shadow-lg shadow-slate-200/50",
    danger: "bg-rose-600 text-white active:bg-rose-800 shadow-lg shadow-rose-200/50",
    outline: "border-2 border-slate-200 text-slate-600 active:bg-slate-50"
  };
  
  return (
    <button 
      disabled={disabled} 
      onClick={onClick} 
      className={`px-6 py-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

export default Button;