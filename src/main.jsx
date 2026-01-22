import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Se eliminó la importación de index.css para evitar el error de compilación
// ya que los estilos se cargan vía CDN en index.html

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
