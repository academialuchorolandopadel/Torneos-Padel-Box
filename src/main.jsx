import React from 'react'
import ReactDOM from 'react-dom/client'
import './instalar.js' // primero: escucha el aviso de instalación desde el arranque
import App from './App.jsx'
import { PaginaTorneo } from './vistas/publico.jsx'

// Dos puertas de entrada:
//   ?t=<id>  -> página pública de ese torneo (sin login, lectura liviana)
//   sin ?t   -> la app de siempre
const torneoPublico = new URLSearchParams(window.location.search).get('t')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {torneoPublico ? <PaginaTorneo torneoId={torneoPublico} /> : <App />}
  </React.StrictMode>
)
