// Pantallas del torneo largo:
//  - CronogramaLargo: los partidos ordenados por fecha, con los que no tienen horario aparte.
//  - EditMatchLargoModal: mover un partido a mano. Avisa qué reglas no se cumplen,
//    pero deja guardar; lo que movés a mano queda fijo (📌) y el armado automático no lo toca.
import React, { useState } from "react";
import { COURTS } from "../logica/constantes.js";
import { horasDelDia, aMin, aHora, NOMBRES_DIA, diaDeSemana, sumarDias, DURACION_PARTIDO } from "../logica/calendario.js";
import { problemasDelHorario, libresDeCancha, conHorario } from "../logica/armado.js";
import { fechaHoyISO, formatearFecha } from "../logica/fechas.js";
import { getRoundNames } from "../logica/llave.js";
import { BotonConfirmar } from "./confirmar.jsx";

const nombreFecha = (iso) => `${NOMBRES_DIA[diaDeSemana(iso)]} ${formatearFecha(iso)}`;

// Por qué un partido no tiene horario
function motivoSinHorario(m) {
  if (!m.p1id || !m.p2id) return "Espera los resultados de A y B";
  if (m.sinLugar) return "No encontré lugar: revisá el calendario del club o la disponibilidad";
  return "Pendiente de ubicar";
}

export function CronogramaLargo({ cat, isAdmin, onEditMatch, onReproponer }) {
  const [trabajando, setTrabajando] = useState(false);
  const byId = Object.fromEntries(cat.parejas.map(p => [p.id, p]));
  // Zona + llave (los cruces de llave usan el nombre de la ronda como código)
  const rondas = cat.knockoutRounds || [];
  const nombresRonda = getRoundNames(rondas);
  const llave = rondas.flatMap((r, ri) => r.filter(m => !m.auto && m.p1id && m.p2id).map(m => ({ ...m, code: nombresRonda[ri] || `R${ri + 1}` })));
  const todos = [...cat.partidos, ...llave];
  const conFecha = todos.filter(m => m.fecha).sort((a, b) => (a.mins || 0) - (b.mins || 0));
  const sinFecha = todos.filter(m => !m.fecha && !m.done && !m.p1provisorio && !m.p2provisorio);
  const porFecha = [];
  conFecha.forEach(m => { const ult = porFecha[porFecha.length - 1]; if (ult && ult.fecha === m.fecha) ult.partidos.push(m); else porFecha.push({ fecha: m.fecha, partidos: [m] }); });
  const hoy = fechaHoyISO();
  const nombre = (id) => byId[id]?.nombre || "Por definir";
  const fijados = todos.filter(m => m.fijado).length;

  return (
    <div className="card">
      <div className="row wrap g8 just-between mb12">
        <div className="card-title" style={{ margin: 0 }}>Cronograma</div>
        <div className="row wrap g8">
          <span className="badge bg">{conFecha.length} con horario</span>
          {sinFecha.length > 0 && <span className="badge by">{sinFecha.length} sin horario</span>}
          {fijados > 0 && <span className="badge bb">📌 {fijados} fijado{fijados === 1 ? "" : "s"}</span>}
        </div>
      </div>
      {isAdmin && (
        <div className="row wrap g8 mb16">
          {trabajando ? <button className="btn btn-secondary btn-sm" disabled>Armando...</button> : (
            <BotonConfirmar className="btn btn-secondary btn-sm" textoSi="Sí, re-proponer"
              pregunta="Se mueven los partidos pendientes sin 📌. Si ya bloqueaste sus turnos en Reva, revisalos."
              onConfirmar={async () => { setTrabajando(true); try { await onReproponer(); } finally { setTrabajando(false); } }}>
              🔄 Re-proponer pendientes
            </BotonConfirmar>
          )}
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Reacomoda los partidos no jugados y no fijados (📌). Usalo después de cambiar el calendario o la disponibilidad, o cuando se definen los rivales de C y D.</span>
        </div>
      )}
      {porFecha.map(({ fecha, partidos }) => (
        <div key={fecha} style={{ marginBottom: 14, opacity: fecha < hoy ? 0.6 : 1 }}>
          <div style={{ fontFamily: "Oswald", fontSize: 13, letterSpacing: 1.5, color: "var(--accent)", textTransform: "uppercase", marginBottom: 6 }}>{nombreFecha(fecha)}</div>
          {partidos.map(m => (
            <div key={m.id} className="court-slot" style={{ background: "var(--bg3)", borderRadius: 8, marginBottom: 4, border: "1px solid var(--border)" }}>
              <div className="row g12" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ minWidth: 92 }}>
                  <div className="slot-time" style={{ margin: 0 }}>{m.hora}–{m.horaFin}</div>
                  <div className="slot-day">{m.cancha}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{nombre(m.p1id)} <span style={{ color: "var(--muted)" }}>vs</span> {nombre(m.p2id)}</div>
                  <div className="row wrap g8" style={{ marginTop: 2 }}>
                    {m.done && <span style={{ fontSize: 10, color: m.wo ? "var(--gold)" : "var(--accent)" }}>{m.wo ? "W.O." : "✓ jugado"}</span>}
                    {m.fijado && <span style={{ fontSize: 10, color: "var(--accent2)" }}>📌 fijado</span>}
                    {m.fueraDeVentana && !m.done && <span className="ctag">⚠️ fuera de la semana 1</span>}
                  </div>
                </div>
              </div>
              <div className="row g8">
                <span className="slot-code">{m.code}</span>
                {isAdmin && <button className="btn btn-ghost btn-xs" onClick={() => onEditMatch(m)}>⚙️</button>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {sinFecha.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: "Oswald", fontSize: 13, letterSpacing: 1.5, color: "var(--gold)", textTransform: "uppercase", marginBottom: 6 }}>Sin horario</div>
          {sinFecha.map(m => (
            <div key={m.id} className="court-slot" style={{ background: "var(--bg3)", borderRadius: 8, marginBottom: 4, border: "1px solid rgba(255,203,71,.25)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text)" }}>{nombre(m.p1id)} <span style={{ color: "var(--muted)" }}>vs</span> {nombre(m.p2id)}</div>
                <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>{motivoSinHorario(m)}</div>
              </div>
              <div className="row g8">
                <span className="slot-code">{m.code}</span>
                {isAdmin && m.p1id && m.p2id && <button className="btn btn-ghost btn-xs" onClick={() => onEditMatch(m)}>⚙️</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {porFecha.length === 0 && sinFecha.length === 0 && <div className="empty" style={{ padding: 20 }}>No hay partidos</div>}
    </div>
  );
}

// ctx: { calendarioClub, ocupados, parejas, duracion, maxSemana, inicioTorneo }
export function EditMatchLargoModal({ match, cat, ctx, onSave, onClose }) {
  const dur = ctx.duracion || DURACION_PARTIDO;
  const [fecha, setFecha] = useState(match.fecha || fechaHoyISO());
  const [hora, setHora] = useState(match.hora || "19:00");
  const [cancha, setCancha] = useState(match.cancha || COURTS[0]);
  const horas = horasDelDia().filter(h => aMin(h) + dur <= aMin(horasDelDia().slice(-1)[0]));
  const problemas = fecha ? problemasDelHorario(match, fecha, hora, cancha, ctx) : ["Elegí una fecha"];
  const nombre = (id) => cat.parejas.find(p => p.id === id)?.nombre || "?";
  const libres = fecha ? COURTS.map(c => [c, libresDeCancha(ctx.calendarioClub, fecha, c, ctx.ocupados, match.id)]) : [];
  const guardar = () => {
    const h = conHorario({}, fecha, hora, cancha, dur);
    const finSemana1 = ctx.inicioTorneo ? sumarDias(ctx.inicioTorneo, 6) : null;
    onSave(match.id, { fecha: h.fecha, hora: h.hora, horaFin: h.horaFin, cancha: h.cancha, dia: h.dia, mins: h.mins,
      fijado: true, sinLugar: false, fueraDeVentana: !!(finSemana1 && fecha > finSemana1) });
  };
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-title">Mover partido</div>
      <div className="match-info">
        <div className="match-teams">{nombre(match.p1id)} vs {nombre(match.p2id)}</div>
        <div className="match-meta">{match.code}{match.fecha ? ` · hoy: ${nombreFecha(match.fecha)} ${match.hora} · ${match.cancha}` : " · sin horario"}{match.fijado ? " · 📌 fijado" : ""}</div>
      </div>
      <div className="grid3 mb12">
        <div className="col"><label className="lbl">Fecha</label><input className="inp" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
        <div className="col"><label className="lbl">Hora</label><select className="inp" value={hora} onChange={e => setHora(e.target.value)}>{horas.map(h => <option key={h}>{h}</option>)}</select></div>
        <div className="col"><label className="lbl">Cancha</label><select className="inp" value={cancha} onChange={e => setCancha(e.target.value)}>{COURTS.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      {fecha && <div className="mb12">
        <div className="lbl">Libre ese día (tocá un rango para usarlo)</div>
        {libres.every(([, rs]) => !rs.length) && <div style={{ fontSize: 12, color: "var(--muted)" }}>No hay turnos libres cargados para {nombreFecha(fecha)}.</div>}
        {libres.map(([c, rs]) => rs.length > 0 && (
          <div key={c} className="row wrap g8" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 44 }}>{c}</span>
            {rs.map(([a, b]) => (
              <button key={a} className="badge bb" style={{ border: "none", cursor: "pointer" }} onClick={() => { setCancha(c); setHora(aHora(a)); }}>
                {aHora(a)}-{aHora(b)}{b - a < dur ? " (no entra)" : ""}
              </button>
            ))}
          </div>
        ))}
      </div>}
      {problemas.length === 0
        ? <div className="badge bg" style={{ marginBottom: 16 }}>✓ Cumple todas las reglas</div>
        : <div className="alert alert-warn" style={{ marginBottom: 16 }}>{problemas.map((p, i) => <div key={i}>⚠️ {p}</div>)}</div>}
      <div className="row wrap g8">
        <button className="btn btn-primary f1" disabled={!fecha} onClick={guardar}>{problemas.length ? "Guardar de todos modos 📌" : "Guardar 📌"}</button>
        {match.fijado && <button className="btn btn-secondary btn-sm" onClick={() => onSave(match.id, { fijado: false })} title="El armado automático podrá volver a moverlo">Soltar 📌</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>Al guardar queda fijo: "Re-proponer pendientes" no lo mueve. Acordate de reservar ese turno en Reva.</div>
    </div></div>
  );
}
