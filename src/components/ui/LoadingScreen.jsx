import React from 'react';
import { RefreshCw } from 'lucide-react';

const LoadingScreen = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
    <RefreshCw className="animate-spin text-emerald-500 w-10 h-10" />
  </div>
);

export default LoadingScreen;