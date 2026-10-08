import React from 'react'
import ReactDOM from 'react-dom/client'
import './instalar.js' // primero: escucha el aviso de instalación desde el arranque
import App from './App.jsx'
import { PaginaTorneo } from './vistas/publico.jsx'
import { Anotarse } from './vistas/anotarse.jsx'

// Tres puertas de entrada:
//   ?t=<id>      -> página pública de ese torneo (sin login, lectura liviana)
//   ?anotarse=1  -> inscripción abierta a partidos por nivel (sin login, solo envía)
//   sin nada     -> la app de siempre
const params = new URLSearchParams(window.location.search)
const torneoPublico = params.get('t')
const anotarse = params.has('anotarse')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {torneoPublico ? <PaginaTorneo torneoId={torneoPublico} /> : anotarse ? <Anotarse /> : <App />}
  </React.StrictMode>
)
