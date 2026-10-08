// Pantallas de la migración de cédulas (v52). Aparecen solo mientras los
// datos están en el formato viejo (esquema 1):
//  - Mantenimiento: lo que ve cualquiera que no sea admin.
//  - MigracionView: lo que ve el admin. Un solo botón hace todo:
//      1. descarga una copia de cómo está todo ahora (para poder volver),
//      2. arma cómo tiene que quedar la base y la revisa ANTES de escribir,
//      3. escribe solo lo que cambia,
//      4. vuelve a leer la base y revisa que no quede ninguna cédula a la vista.
//    Si algo sale mal, la copia del paso 1 se restaura desde esta misma pantalla.
import React, { useState } from "react";
import { planMigracion, revisarMigracion, nuevoIdJugador } from "../logica/identidad.js";
import { planRestauracion, armarLotes, nombreArchivoCopia } from "../logica/copia.js";
import { CopiaSeguridad, descargarJSON } from "./club.jsx";
import { MarcaGrande } from "./marca.jsx";

export function Mantenimiento({ club, onAdmin }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
      <MarcaGrande club={club} />
      <p style={{ color: "var(--text)", marginBottom: 8 }}>Estamos actualizando la app.</p>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>Volvé a entrar en unos minutos.</p>
      <button className="btn btn-ghost btn-sm" onClick={onAdmin}>🔑 Soy admin</button>
    </div>
  );
}

export function MigracionView({ onPrepararCopia, onAplicarRestauracion, onTerminado }) {
  const [fase, setFase] = useState(""); // "" | "trabajando" | "listo" | "error"
  const [mensaje, setMensaje] = useState("");
  const [resumen, setResumen] = useState(null);

  const migrar = async () => {
    setFase("trabajando"); setMensaje("Guardando una copia de todo como está ahora...");
    let antes;
    try {
      antes = await onPrepararCopia();
      descargarJSON(antes, nombreArchivoCopia(antes.fecha).replace("torneos-copia-", "torneos-antes-de-migrar-"));
    } catch (err) { setFase("error"); setMensaje(`No se pudo guardar la copia previa (${err.message}). No se tocó nada.`); return; }

    const objetivo = planMigracion(antes.colecciones, nuevoIdJugador);
    const cedulas = objetivo.accesos.map(d => d.id);
    const previos = revisarMigracion(objetivo, cedulas);
    if (previos.length) { setFase("error"); setMensaje(`No se migró nada: la revisión previa encontró problemas. ${previos.join(" ")} Mandame este mensaje.`); return; }

    const lotes = armarLotes(planRestauracion(antes.colecciones, objetivo));
    try {
      await onAplicarRestauracion(lotes, (h, t) => setMensaje(`Migrando... parte ${h} de ${t}`));
    } catch (err) {
      setFase("error");
      setMensaje(`Se cortó a mitad de camino (${err.message}). Restaurá abajo el archivo "torneos-antes-de-migrar" que se descargó recién, y volvé a migrar.`);
      return;
    }

    setMensaje("Revisando el resultado...");
    let despues;
    try { despues = await onPrepararCopia(); } catch (err) { setFase("error"); setMensaje(`Se migró, pero no se pudo revisar (${err.message}). Recargá la página.`); return; }
    const problemas = revisarMigracion(despues.colecciones, cedulas);
    if (problemas.length) { setFase("error"); setMensaje(`La migración terminó con problemas: ${problemas.join(" ")} Restaurá abajo el archivo "torneos-antes-de-migrar" y avisame.`); return; }
    setResumen({ jugadores: objetivo.jugadores.length, cedulas: cedulas.length, parejas: objetivo.parejas.length });
    setFase("listo");
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="sec-hdr"><div className="sec-title">Actualización de datos</div></div>
      <div className="card mb16" style={{ fontSize: 13, lineHeight: 1.6 }}>
        <p style={{ marginBottom: 8 }}>Esta versión deja de guardar las cédulas a la vista. Cada jugador pasa a tener un código interno, y la cédula queda en un lugar que solo vos podés leer. Los jugadores siguen entrando con su cédula.</p>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>Mientras tanto, la app muestra "estamos actualizando" a los demás. Se hace una sola vez y tarda menos de un minuto.</p>
        <p style={{ color: "var(--muted)" }}>Antes de escribir se descarga una copia de todo, y la migración se revisa antes y después.</p>
      </div>
      {fase === "" && <button className="btn btn-primary" onClick={migrar}>Migrar datos ahora</button>}
      {fase === "trabajando" && <div style={{ color: "var(--gold)", fontSize: 13 }}>⏳ {mensaje} No cierres la app.</div>}
      {fase === "error" && <>
        <div className="alert alert-warn" style={{ lineHeight: 1.5 }}>{mensaje}</div>
        <button className="btn btn-secondary btn-sm mb16" onClick={() => { setFase(""); setMensaje(""); }}>Volver a intentar</button>
      </>}
      {fase === "listo" && resumen && (
        <div className="alert alert-ok" style={{ lineHeight: 1.6 }}>
          ✓ Listo. {resumen.jugadores} jugadores en el ranking, {resumen.parejas} parejas y {resumen.cedulas} cédulas protegidas. Guardá el archivo "torneos-antes-de-migrar" en un lugar privado: tiene las cédulas.
          <div style={{ marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={onTerminado}>Entrar a la app</button></div>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <CopiaSeguridad onPrepararCopia={onPrepararCopia} onAplicarRestauracion={onAplicarRestauracion} onRestaurado={onTerminado} />
      </div>
    </div>
  );
}
