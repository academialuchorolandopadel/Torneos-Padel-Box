// Pantallas del torneo largo:
//  - CalendarioClubView: rangos libres del club por fecha y cancha, con atajos para copiar.
//  - DisponibilidadEditor: disponibilidad semanal de una pareja ("solo puede" / "no puede").
// Las confirmaciones son dentro de la pantalla (window.confirm falla en Android).
import React, { useState } from "react";
import { COURTS } from "../logica/constantes.js";
import { NOMBRES_DIA, ORDEN_SEMANA, horasDelDia, lunesDeSemana, diasDeLaSemana, sumarDias, diaDeSemana,
  normalizarRangos, capacidadPartidos, capacidadDia, DURACION_PARTIDO, DISPONIBILIDAD_LIBRE } from "../logica/calendario.js";
import { fechaHoyISO, formatearFecha } from "../logica/fechas.js";

const HORAS = horasDelDia();
// Selector de hora de media en media hora. Para "desde" no se ofrece la hora de
// cierre; para "hasta" solo horas posteriores a "desde".
const SelectHora = ({ value, onChange, desde }) => (
  <select className="inp" style={{ width: 86, padding: "6px 8px" }} value={value} onChange={e => onChange(e.target.value)}>
    {HORAS.filter(h => desde ? h > desde : h < HORAS[HORAS.length - 1]).map(h => <option key={h} value={h}>{h}</option>)}
  </select>
);
const Chip = ({ texto, onQuitar }) => (
  <span className="badge bb" style={{ gap: 6, marginRight: 4, marginBottom: 4 }}>
    {texto}{onQuitar && <button className="icon-btn" style={{ padding: 0, fontSize: 11, color: "inherit" }} onClick={onQuitar}>✕</button>}
  </span>
);

// ================= Calendario del club =================

export function CalendarioClubView({ calendario, isAdmin, onGuardarDias, duracion = DURACION_PARTIDO }) {
  const [lunes, setLunes] = useState(lunesDeSemana(fechaHoyISO()));
  const [confirmar, setConfirmar] = useState(null); // { texto, accion }
  const dias = diasDeLaSemana(lunes);
  const canchasDe = (fecha) => calendario[fecha]?.canchas || {};
  const tieneDatos = (fecha) => Object.values(canchasDe(fecha)).some(rs => rs && rs.length);
  const totalSemana = dias.reduce((n, f) => n + capacidadDia(calendario[f], duracion), 0);

  // Si alguna fecha destino ya tiene turnos cargados, se pide confirmación antes de reemplazar
  const conConfirmacion = (destinos, texto, accion) => {
    if (destinos.some(tieneDatos)) setConfirmar({ texto, accion });
    else accion();
  };
  const copiarSemana = () => {
    const destinos = dias.map(f => sumarDias(f, 7));
    conConfirmacion(destinos, "La semana siguiente ya tiene turnos cargados. ¿Reemplazarlos?",
      () => onGuardarDias(dias.map(f => ({ fecha: sumarDias(f, 7), canchas: canchasDe(f) }))));
  };

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Calendario del club</div>
        <span className="badge bb">{totalSemana} partidos de {duracion}' entran esta semana</span>
      </div>
      <div className="card mb16">
        <div className="row wrap g8 just-between">
          <button className="btn btn-ghost btn-sm" onClick={() => setLunes(sumarDias(lunes, -7))}>‹ Anterior</button>
          <div style={{ fontFamily: "Oswald", fontSize: 15, letterSpacing: 1 }}>SEMANA DEL {formatearFecha(dias[0])} AL {formatearFecha(dias[6])}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setLunes(sumarDias(lunes, 7))}>Siguiente ›</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
          Cargá los rangos en los que cada cancha está libre para el torneo. Un partido entra en cualquier horario que empiece en punto o y media, dentro de un rango.
        </div>
        {isAdmin && <div className="row wrap g8 mt12">
          <button className="btn btn-secondary btn-sm" onClick={copiarSemana} disabled={!dias.some(tieneDatos)}>Copiar esta semana a la siguiente</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLunes(lunesDeSemana(fechaHoyISO()))}>Ir a hoy</button>
        </div>}
        {confirmar && <div className="alert alert-warn mt12" style={{ marginBottom: 0 }}>
          <div className="row wrap g8 just-between">
            <span>{confirmar.texto}</span>
            <span className="row g8">
              <button className="btn btn-danger btn-xs" onClick={() => { confirmar.accion(); setConfirmar(null); }}>Sí, reemplazar</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmar(null)}>Cancelar</button>
            </span>
          </div>
        </div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
        {dias.map(f => <DiaClub key={f} fecha={f} canchas={canchasDe(f)} isAdmin={isAdmin} duracion={duracion}
          onGuardar={(canchas) => onGuardarDias([{ fecha: f, canchas }])}
          onCopiar={(semanas) => {
            const destinos = Array.from({ length: semanas }, (_, i) => sumarDias(f, 7 * (i + 1)));
            conConfirmacion(destinos, `Algunos de los próximos ${NOMBRES_DIA[diaDeSemana(f)].toLowerCase()} ya tienen turnos. ¿Reemplazarlos?`,
              () => onGuardarDias(destinos.map(fecha => ({ fecha, canchas: canchasDe(f) }))));
          }}
          onVaciar={() => setConfirmar({ texto: `¿Vaciar el ${NOMBRES_DIA[diaDeSemana(f)].toLowerCase()} ${formatearFecha(f)}?`, accion: () => onGuardarDias([{ fecha: f, canchas: {} }]) })}
        />)}
      </div>
    </div>
  );
}

function DiaClub({ fecha, canchas, isAdmin, duracion, onGuardar, onCopiar, onVaciar }) {
  const [cancha, setCancha] = useState("__todas__");
  const [desde, setDesde] = useState("19:00");
  const [hasta, setHasta] = useState("23:00");
  const [semanas, setSemanas] = useState(4);
  const hoy = fechaHoyISO();
  const capacidad = Object.values(canchas).reduce((n, rs) => n + capacidadPartidos(rs, duracion), 0);
  const hayDatos = Object.values(canchas).some(rs => rs && rs.length);

  const agregar = () => {
    if (hasta <= desde) return;
    const nuevas = { ...canchas };
    (cancha === "__todas__" ? COURTS : [cancha]).forEach(c => { nuevas[c] = normalizarRangos([...(nuevas[c] || []), { desde, hasta }]); });
    onGuardar(nuevas);
  };
  const quitar = (c, idx) => {
    const nuevas = { ...canchas, [c]: (canchas[c] || []).filter((_, i) => i !== idx) };
    onGuardar(nuevas);
  };

  return (
    <div className="card" style={{ margin: 0, opacity: fecha < hoy ? 0.55 : 1 }}>
      <div className="row just-between mb8">
        <div className="card-title" style={{ margin: 0 }}>{NOMBRES_DIA[diaDeSemana(fecha)]} {formatearFecha(fecha)}</div>
        <span className={`badge ${capacidad ? "bg" : "bx"}`}>{capacidad} partido{capacidad === 1 ? "" : "s"}</span>
      </div>
      {COURTS.map(c => (
        <div key={c} className="row g8" style={{ alignItems: "flex-start", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 44, paddingTop: 4 }}>{c}</span>
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap" }}>
            {(canchas[c] || []).length === 0 && <span style={{ fontSize: 11, color: "var(--muted)", paddingTop: 4 }}>no disponible</span>}
            {(canchas[c] || []).map((r, i) => <Chip key={i} texto={`${r.desde}-${r.hasta}`} onQuitar={isAdmin ? () => quitar(c, i) : null} />)}
          </div>
        </div>
      ))}
      {isAdmin && <>
        <div className="divider" style={{ margin: "10px 0" }} />
        <div className="row wrap g8">
          <select className="inp" style={{ width: 110, padding: "6px 8px" }} value={cancha} onChange={e => setCancha(e.target.value)}>
            <option value="__todas__">Todas</option>
            {COURTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <SelectHora value={desde} onChange={v => { setDesde(v); if (hasta <= v) setHasta(HORAS[HORAS.indexOf(v) + 1] || v); }} />
          <SelectHora value={hasta} onChange={setHasta} desde={desde} />
          <button className="btn btn-primary btn-sm" onClick={agregar}>+ Libre</button>
        </div>
        <div className="row wrap g8 mt8">
          <button className="btn btn-ghost btn-xs" disabled={!hayDatos} onClick={() => onCopiar(semanas)}>Copiar a los próximos</button>
          <select className="inp" style={{ width: 56, padding: "3px 6px", fontSize: 11 }} value={semanas} onChange={e => setSemanas(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{NOMBRES_DIA[diaDeSemana(fecha)].toLowerCase()}</span>
          {hayDatos && <button className="btn btn-danger btn-xs" style={{ marginLeft: "auto" }} onClick={onVaciar}>Vaciar</button>}
        </div>
      </>}
    </div>
  );
}

// ================= Disponibilidad semanal de una pareja =================

const MODOS = [
  ["libre", "Sin restricciones"],
  ["solo", "Solo puede"],
  ["no", "No puede"],
];
const DIAS_OPCIONES = [
  ...ORDEN_SEMANA.map(d => [String(d), NOMBRES_DIA[d]]),
  ["lv", "Lunes a viernes"],
  ["todos", "Todos los días"],
];

export function DisponibilidadEditor({ value, onChange }) {
  const disp = value && value.modo ? value : DISPONIBILIDAD_LIBRE;
  const [dia, setDia] = useState("1");
  const [desde, setDesde] = useState("19:00");
  const [hasta, setHasta] = useState("23:00");

  const setModo = (modo) => onChange({ ...disp, modo, dias: disp.dias || {} });
  const agregar = () => {
    if (hasta <= desde) return;
    const destino = dia === "lv" ? ["1", "2", "3", "4", "5"] : dia === "todos" ? ORDEN_SEMANA.map(String) : [dia];
    const dias = { ...(disp.dias || {}) };
    destino.forEach(d => { dias[d] = normalizarRangos([...(dias[d] || []), { desde, hasta }]); });
    onChange({ ...disp, dias });
  };
  const quitar = (d, idx) => {
    const dias = { ...(disp.dias || {}) };
    dias[d] = (dias[d] || []).filter((_, i) => i !== idx);
    if (!dias[d].length) delete dias[d];
    onChange({ ...disp, dias });
  };

  return (
    <div>
      <div className="row wrap g8 mb12">
        {MODOS.map(([m, txt]) => (
          <button key={m} className={`btn btn-sm ${disp.modo === m ? "btn-primary" : "btn-ghost"}`} onClick={() => setModo(m)}>{txt}</button>
        ))}
      </div>
      {disp.modo !== "libre" && <>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
          {disp.modo === "solo"
            ? "El partido tiene que caer entero dentro de alguno de estos horarios. Los días sin horarios no puede jugar."
            : "El partido no puede tocar ninguno de estos horarios. El resto del tiempo puede jugar."}
        </div>
        {ORDEN_SEMANA.map(d => {
          const rs = disp.dias?.[String(d)] || [];
          if (!rs.length) return null;
          return (
            <div key={d} className="row g8" style={{ alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontSize: 12, minWidth: 80, paddingTop: 3 }}>{NOMBRES_DIA[d]}</span>
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap" }}>
                {rs.map((r, i) => <Chip key={i} texto={`${r.desde}-${r.hasta}`} onQuitar={() => quitar(String(d), i)} />)}
              </div>
            </div>
          );
        })}
        <div className="row wrap g8 mt8">
          <select className="inp" style={{ width: 150, padding: "6px 8px" }} value={dia} onChange={e => setDia(e.target.value)}>
            {DIAS_OPCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <SelectHora value={desde} onChange={v => { setDesde(v); if (hasta <= v) setHasta(HORAS[HORAS.indexOf(v) + 1] || v); }} />
          <SelectHora value={hasta} onChange={setHasta} desde={desde} />
          <button className="btn btn-secondary btn-sm" onClick={agregar}>+ Agregar</button>
        </div>
      </>}
    </div>
  );
}
