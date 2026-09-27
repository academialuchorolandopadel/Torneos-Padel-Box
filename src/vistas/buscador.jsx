// Campo de nombre de jugador con sugerencias del directorio.
// Al elegir una sugerencia se completan nombre y cédula juntos.
import React, { useState } from "react";
import { buscarJugadores } from "../logica/directorio.js";

export function CampoJugador({ valor, cedulaActual, onCambiar, onElegir, directorio, yaInscriptos }) {
  const [abierto, setAbierto] = useState(false);
  const opciones = buscarJugadores(directorio || [], valor);
  // Si ya elegiste a esa persona, no se vuelve a ofrecer la misma sugerencia
  const yaElegido = opciones.length === 1 && cedulaActual && opciones[0].cedula === cedulaActual;
  const mostrar = abierto && opciones.length > 0 && !yaElegido;
  return (
    <div style={{ position: "relative" }}>
      <input className="inp" value={valor} autoComplete="off" placeholder="Escribí nombre o cédula"
        onChange={e => { onCambiar(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        // Se cierra con una pequeña demora para que el toque en una sugerencia llegue a registrarse
        onBlur={() => setTimeout(() => setAbierto(false), 150)} />
      {mostrar && (
        <div className="sugerencias">
          {opciones.map(j => {
            const inscripto = j.cedula && yaInscriptos && yaInscriptos.has(j.cedula);
            return (
              <button key={(j.cedula || "") + j.nombre} type="button" className="sug-item"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onElegir(j); setAbierto(false); }}>
                <span>{j.nombre}</span>
                <span style={{ fontSize: 11, color: inscripto ? "var(--gold)" : "var(--muted)", whiteSpace: "nowrap" }}>
                  {inscripto ? "ya inscripto acá" : j.cedula ? `CI ${j.cedula}` : "sin cédula"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
