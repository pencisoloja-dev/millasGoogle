import React from 'react';

const NavButton = ({ active, onClick, icon: Icon, badge }) => (
  <button 
    onClick={onClick} 
    className={`p-4 rounded-2xl transition-all relative ${active ? 'text-emerald-400 bg-emerald-400/10 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
  >
    <Icon size={24} strokeWidth={2.5} />
    {badge && (
      <span className="absolute top-3 right-3 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900"></span>
    )}
  </button>
);

export default NavButton;