// Nombre visible de la app: una palabra fija (lo que ES la herramienta) más el
// nombre del club, que sale de 🏟️ Club. Así la misma app sirve para cualquier
// club sin tocar el código: cambia el dato, no el programa.
// Sin nombre de club cargado, muestra solo "TORNEOS".
import React from "react";
import { conDefectoClub } from "../logica/club.js";

export const NOMBRE_APP = "TORNEOS";

// Encabezado: "TORNEOS · <club>" o solo "TORNEOS"
export function Marca({ club }) {
  const nombre = conDefectoClub(club).nombre;
  return <div className="logo" title={nombre ? `${NOMBRE_APP} · ${nombre}` : NOMBRE_APP}>{NOMBRE_APP}{nombre && <em> · {nombre}</em>}</div>;
}

// Portada (pantalla de acceso y mantenimiento)
export function MarcaGrande({ club }) {
  const nombre = conDefectoClub(club).nombre;
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="hero-title" style={{ marginBottom: 8 }}><span>{NOMBRE_APP}</span></div>
      {nombre && <div className="marca-club">{nombre}</div>}
    </div>
  );
}

// Pie con la versión
export const textoPie = (version) => `Torneos ${version}`;
