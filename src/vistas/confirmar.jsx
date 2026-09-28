// Botón con confirmación dentro de la pantalla.
// Reemplaza a window.confirm, que en Android (WebView / app instalada) puede no
// mostrarse y dejar el botón sin efecto.
//
// Primer toque: muestra la pregunta con "Sí" y "No" en el mismo lugar.
// Frena la propagación de los toques para que funcione dentro de filas o
// tarjetas que tienen su propio onClick.
import React, { useState } from "react";

export function BotonConfirmar({ children, pregunta, textoSi = "Sí", onConfirmar, className = "btn btn-danger btn-xs", style, title }) {
  const [preguntando, setPreguntando] = useState(false);
  const frenar = (e) => e.stopPropagation();
  if (!preguntando) {
    return (
      <button type="button" className={className} style={style} title={title}
        onClick={(e) => { frenar(e); setPreguntando(true); }} onKeyDown={frenar}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirmar" onClick={frenar} onKeyDown={frenar}>
      <span className="confirmar-txt">{pregunta}</span>
      <button type="button" className="btn btn-danger btn-xs" onClick={(e) => { frenar(e); setPreguntando(false); onConfirmar(); }}>{textoSi}</button>
      <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { frenar(e); setPreguntando(false); }}>No</button>
    </span>
  );
}
