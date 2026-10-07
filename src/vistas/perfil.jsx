// Pantallas de "partidos por nivel":
//  - MiPerfil: el jugador completa su perfil tocando opciones (género, lado,
//    WhatsApp, filtro de nivel y franjas por día).
//  - PerfilesAdmin: el organizador ve todos los perfiles, el nivel que da el
//    filtro, los que hay que validar o revisar, y el WhatsApp de cada uno.
// La lógica (tabla de lectura, franjas, vigencia) vive en logica/perfil.js.
import React, { useState, useEffect } from "react";
import { CAT_LABELS } from "../logica/constantes.js";
import { NOMBRES_DIA, ORDEN_SEMANA, resumenDisponibilidad } from "../logica/calendario.js";
import { fechaHoyISO, formatearFecha } from "../logica/fechas.js";
import { PREGUNTAS, FRANJAS, calcularNivel, categoriasParaArmar, difiereDeOficial, franjasADisponibilidad, disponibilidadAFranjas,
  nuevaVigencia, estaVigente, normalizarWhatsapp, validarPerfil } from "../logica/perfil.js";
import { BotonConfirmar } from "./confirmar.jsx";

const LADOS = [["drive", "Drive"], ["reves", "Revés"], ["ambos", "Los dos, cómodo en ambos"]];
const GENEROS = [["M", "Caballeros"], ["F", "Damas"]];
const LADO_TXT = { drive: "Drive", reves: "Revés", ambos: "Ambos lados" };
const GENERO_TXT = { M: "Caballeros", F: "Damas" };

// "6ta-5ta" a partir de {min:5, max:6}
const textoRango = (min, max) => min === max ? CAT_LABELS[min] : `${CAT_LABELS[max]}-${CAT_LABELS[min]}`;

// Botones de opción: el elegido se pinta como principal
const Opciones = ({ opciones, valor, onElegir }) => (
  <div className="row wrap g8">
    {opciones.map(([id, texto]) => (
      <button key={id} className={`btn btn-sm ${valor === id ? "btn-primary" : "btn-ghost"}`} aria-pressed={valor === id} onClick={() => onElegir(id)}>{texto}</button>
    ))}
  </div>
);

// ================= Mi perfil (jugador) =================

export function MiPerfil({ nombre, categoriaOficial, generoFicha, onCargar, onGuardar }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [guardado, setGuardado] = useState(null);   // perfil tal como está en la base
  const [genero, setGenero] = useState(generoFicha || "");
  const [lado, setLado] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [respuestas, setRespuestas] = useState({});
  const [franjas, setFranjas] = useState({});
  const [rehacerFiltro, setRehacerFiltro] = useState(false);
  const [errores, setErrores] = useState([]);
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true); setErrorCarga("");
    try {
      const p = await onCargar();
      setGuardado(p);
      if (p) {
        setGenero(p.genero || generoFicha || "");
        setLado(p.lado || "");
        setRespuestas(p.respuestas || {});
        setFranjas(disponibilidadAFranjas(p.disponibilidad));
      }
    } catch (err) { console.error(err); setErrorCarga("No se pudo cargar tu perfil. Revisá tu conexión."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const hoy = fechaHoyISO();
  const conFiltro = !categoriaOficial || rehacerFiltro;
  const respondidas = PREGUNTAS.filter(p => respuestas[p.id]).length;
  const vigente = guardado && estaVigente(guardado, hoy);

  const tocarFranja = (dia, franja) => setFranjas(prev => {
    const d = String(dia), actuales = prev[d] || [];
    const nuevas = actuales.includes(franja) ? actuales.filter(f => f !== franja) : [...actuales, franja];
    const out = { ...prev };
    if (nuevas.length) out[d] = nuevas; else delete out[d];
    return out;
  });

  const guardar = async () => {
    setAviso(""); setErrores([]);
    const perfil = { lado, genero, disponibilidad: franjasADisponibilidad(franjas), venceEl: nuevaVigencia(hoy) };
    // Sin categoría oficial el filtro es obligatorio; con categoría, solo si lo quiere rehacer.
    // Si no lo rehace, se conservan las respuestas que ya tenía.
    if (conFiltro) perfil.respuestas = respuestas;
    else if (guardado?.respuestas) perfil.respuestas = guardado.respuestas;
    const lista = validarPerfil(perfil);
    const wa = whatsapp.trim() ? normalizarWhatsapp(whatsapp) : null;
    if (whatsapp.trim() && !wa) lista.push("El WhatsApp no parece un número válido. Escribilo con característica, por ejemplo 0981 123 456.");
    if (!guardado && !wa && !whatsapp.trim()) lista.push("Cargá tu WhatsApp: es la forma de confirmarte los partidos.");
    if (lista.length) { setErrores(lista); return; }
    setGuardando(true);
    try {
      await onGuardar(perfil, wa);
      setGuardado(perfil); setWhatsapp(""); setRehacerFiltro(false);
      setAviso(`Perfil guardado. Te vamos a tener en cuenta para partidos hasta el ${formatearFecha(perfil.venceEl)}.`);
    } catch (err) { console.error(err); setErrores(["No se pudo guardar. Revisá tu conexión e intentá de nuevo."]); }
    finally { setGuardando(false); }
  };

  if (cargando) return <div className="empty"><div className="empty-ico">⏳</div><p>Cargando tu perfil...</p></div>;
  if (errorCarga) return <div className="empty"><div className="empty-ico">⚠️</div><p style={{ color: "var(--danger)" }}>{errorCarga}</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={cargar}>Reintentar</button></div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="sec-hdr">
        <div className="sec-title">Mi perfil</div>
        {categoriaOficial && <span className="badge by">Categoría {CAT_LABELS[categoriaOficial]}</span>}
      </div>

      <div className="card mb16">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{nombre || "Jugador"}</div>
        {!guardado && <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Completá tu perfil para que te armemos partidos con gente de tu nivel. Se completa tocando opciones y lleva un par de minutos.</p>}
        {guardado && vigente && <div className="alert alert-ok" style={{ marginBottom: 0 }}>Tu disponibilidad está activa hasta el {formatearFecha(guardado.venceEl)}. Si cambia, actualizala y guardá.</div>}
        {guardado && !vigente && <div className="alert alert-warn" style={{ marginBottom: 0 }}>Tu disponibilidad venció el {formatearFecha(guardado.venceEl)}. Revisala y guardá para volver a recibir partidos.</div>}
      </div>

      <div className="card mb16">
        <div className="card-title">Cómo jugás</div>
        <label className="lbl">Categoría en la que jugás</label>
        <div className="mb16"><Opciones opciones={GENEROS} valor={genero} onElegir={setGenero} /></div>
        <label className="lbl">De qué lado de la cancha</label>
        <Opciones opciones={LADOS} valor={lado} onElegir={setLado} />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Marcá "los dos" solo si te sentís cómodo en ambos lados: si no, vas a terminar jugando del lado que no te gusta.</div>
      </div>

      <div className="card mb16">
        <div className="card-title">WhatsApp</div>
        <input className="inp" type="tel" inputMode="tel" autoComplete="tel" placeholder="0981 123 456" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          {guardado ? "Ya tenemos tu WhatsApp. Si cambiaste de número, escribí el nuevo; si no, dejalo vacío." : "Solo lo ve el organizador, para confirmarte los partidos."}
        </div>
      </div>

      <div className="card mb16">
        <div className="row just-between mb12">
          <div className="card-title" style={{ margin: 0 }}>Tu nivel</div>
          {conFiltro && <span className={`badge ${respondidas === PREGUNTAS.length ? "bg" : "bx"}`}>{respondidas} de {PREGUNTAS.length}</span>}
        </div>
        {!conFiltro && <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>Ya tenés categoría por torneos, así que no hace falta responder nada. Si querés, podés hacer el cuestionario igual: tu categoría no cambia, pero el organizador ve el resultado.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setRehacerFiltro(true)}>Hacer el cuestionario</button>
        </>}
        {conFiltro && <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>Respondé como jugás hoy, no como te gustaría jugar: así te tocan partidos parejos. El organizador confirma tu nivel.</p>
          {PREGUNTAS.map(p => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{p.texto}</div>
              <Opciones opciones={p.opciones.map(o => [o.id, o.texto])} valor={respuestas[p.id]} onElegir={id => setRespuestas(r => ({ ...r, [p.id]: id }))} />
            </div>
          ))}
          {categoriaOficial && <button className="btn btn-ghost btn-sm" onClick={() => { setRehacerFiltro(false); setRespuestas(guardado?.respuestas || {}); }}>No hacer el cuestionario</button>}
        </>}
      </div>

      <div className="card mb16">
        <div className="card-title">Cuándo podés jugar</div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>Marcá a qué hora podés empezar un partido cada día. Mañana: de 7 a 13 · tarde: de 13 a 18 · noche: de 18 a 24. El partido puede terminar después.</p>
        {ORDEN_SEMANA.map(d => (
          <div key={d} className="row g8" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, minWidth: 78 }}>{NOMBRES_DIA[d]}</span>
            <div className="row g8 wrap f1">
              {FRANJAS.map(f => {
                const on = (franjas[String(d)] || []).includes(f.id);
                return <button key={f.id} className={`btn btn-xs ${on ? "btn-primary" : "btn-ghost"}`} aria-pressed={on} style={{ minWidth: 64, justifyContent: "center" }} onClick={() => tocarFranja(d, f.id)}>{f.texto}</button>;
              })}
            </div>
          </div>
        ))}
      </div>

      {errores.length > 0 && <div className="alert alert-warn">{errores.map((e, i) => <div key={i}>{e}</div>)}</div>}
      {aviso && <div className="alert alert-ok">{aviso}</div>}
      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }} onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : guardado && !vigente ? "Guardar y reactivar" : "Guardar perfil"}
      </button>
    </div>
  );
}

// ================= Perfiles (admin) =================

// Nombre de un jugador que no está en el ranking: se busca en las inscripciones
function nombreDesdeInscripciones(torneos, clave) {
  for (const t of torneos || []) for (const c of t.categorias || []) {
    for (const p of c.parejas || []) {
      if (p.j1cedula === clave) return p.j1nombre || p.j1 || "";
      if (p.j2cedula === clave) return p.j2nombre || p.j2 || "";
    }
    const j = (c.jugadoresAmericano || []).find(x => x.cedula === clave);
    if (j) return j.nombre || "";
  }
  return "";
}

const GRUPOS = [
  ["revisar", "Para revisar", "Las respuestas se contradicen: no tienen nivel hasta que los ubiques."],
  ["pendiente", "Pendientes de validar", "El filtro los ubica en 3ra o más: confirmá su categoría."],
  ["listo", "Listos para armar partidos", "Tienen categoría oficial o un nivel asignado por el filtro."],
  ["incompleto", "Incompletos", "Les falta el cuestionario o no terminaron el perfil."],
];

export function PerfilesAdmin({ jugadores, torneos, onCargar, onEliminar, onUpdateCategoria }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);
  const hoy = fechaHoyISO();

  const cargar = async () => {
    setError("");
    try { setFilas(await onCargar()); }
    catch (err) { console.error(err); setError("No se pudieron cargar los perfiles: " + err.message); }
  };
  useEffect(() => { cargar(); }, []);

  if (error) return <div className="empty"><div className="empty-ico">⚠️</div><p style={{ color: "var(--danger)" }}>{error}</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={cargar}>Reintentar</button></div>;
  if (!filas) return <div className="empty"><div className="empty-ico">⏳</div><p>Cargando perfiles...</p></div>;

  const datos = filas.map(f => {
    const jug = jugadores[f.clave];
    const oficial = jug?.categoria || null;
    const respuestas = f.perfil?.respuestas;
    const nivel = respuestas ? calcularNivel(respuestas) : null;
    const armar = f.perfil ? categoriasParaArmar(oficial, respuestas) : null;
    let grupo = "incompleto";
    if (f.perfil && oficial) grupo = "listo";
    else if (f.perfil && nivel?.estado === "revisar") grupo = "revisar";
    else if (f.perfil && nivel?.estado === "pendiente") grupo = "pendiente";
    else if (armar) grupo = "listo";
    return { ...f, jug, oficial, nivel, armar, grupo, difiere: difiereDeOficial(oficial, respuestas),
      nombre: jug?.nombre || nombreDesdeInscripciones(torneos, f.clave) || "Sin nombre",
      vigente: f.perfil ? estaVigente(f.perfil, hoy) : false };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const renderFila = (d) => {
    const abiertoEste = abierto === d.id;
    return (
      <div key={d.id} className="rank-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, cursor: "default" }}>
        <div className="row wrap g8 just-between">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{d.nombre}</div>
          <div className="row wrap g8">
            {d.oficial && <span className="badge by">{CAT_LABELS[d.oficial]} oficial</span>}
            {d.nivel?.min != null && <span className="badge bb">Filtro: {textoRango(d.nivel.min, d.nivel.max)}</span>}
            {d.perfil && <span className={`badge ${d.vigente ? "bg" : "bx"}`}>{d.vigente ? `Activo hasta ${formatearFecha(d.perfil.venceEl)}` : "Vencido"}</span>}
          </div>
        </div>
        {d.perfil && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          {GENERO_TXT[d.perfil.genero] || "Sin género"} · {LADO_TXT[d.perfil.lado] || "Sin lado"} · {resumenDisponibilidad(d.perfil.disponibilidad)}
        </div>}
        {d.nivel?.motivos?.length > 0 && <div style={{ fontSize: 12, color: "var(--gold)" }}>{d.nivel.motivos.join(" ")}</div>}
        {d.difiere && <div style={{ fontSize: 12, color: "var(--accent2)" }}>{d.difiere === "arriba" ? "El filtro le da mejor nivel que su categoría oficial: puede estar listo para subir." : "El filtro le da menos nivel que su categoría oficial."}</div>}
        <div className="row wrap g8">
          {d.whatsapp
            ? <a className="btn btn-cyan btn-xs" style={{ textDecoration: "none" }} href={`https://wa.me/${d.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp +{d.whatsapp}</a>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}>Sin WhatsApp</span>}
          {d.perfil?.respuestas && <button className="btn btn-ghost btn-xs" onClick={() => setAbierto(abiertoEste ? null : d.id)}>{abiertoEste ? "Ocultar respuestas" : "Ver respuestas"}</button>}
          {d.jug && (d.grupo === "pendiente" || d.grupo === "revisar" || d.difiere) && (
            <select className="inp" style={{ width: 150, padding: "3px 6px", fontSize: 11 }} value="" onChange={e => { if (e.target.value) onUpdateCategoria(d.clave, Number(e.target.value)); }}>
              <option value="">Asignar categoría...</option>
              {[8, 7, 6, 5, 4, 3, 2].map(n => <option key={n} value={n}>{CAT_LABELS[n]}</option>)}
            </select>
          )}
          {!d.jug && (d.grupo === "pendiente" || d.grupo === "revisar") && <span style={{ fontSize: 11, color: "var(--muted)" }}>Para asignarle categoría, crealo primero en Jugadores.</span>}
          <span style={{ marginLeft: "auto" }}><BotonConfirmar pregunta="¿Borrar este perfil y su WhatsApp?" textoSi="Sí, borrar" onConfirmar={async () => { try { await onEliminar(d.id); await cargar(); } catch (err) { alert("Error al borrar: " + err.message); } }}>🗑️</BotonConfirmar></span>
        </div>
        {abiertoEste && <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 12px" }}>
          {PREGUNTAS.map(p => {
            const o = p.opciones.find(x => x.id === d.perfil.respuestas[p.id]);
            return <div key={p.id} style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.4 }}>
              <span style={{ color: "var(--muted)" }}>{p.texto}</span><br />
              <span>{o ? o.texto : "Sin respuesta"}{o?.banda ? ` (${textoRango(o.banda.min, o.banda.max)})` : ""}</span>
            </div>;
          })}
        </div>}
      </div>
    );
  };

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Perfiles</div>
        <div className="row g8 wrap">
          <span className="badge bb">{datos.length} perfiles</span>
          <button className="btn btn-ghost btn-sm" onClick={cargar}>🔄 Actualizar</button>
        </div>
      </div>
      {datos.length === 0 && <div className="empty"><div className="empty-ico">👤</div><p>Todavía nadie completó su perfil.</p><p style={{ fontSize: 12, marginTop: 8 }}>Los jugadores lo completan desde "Mi perfil", después de entrar con su cédula.</p></div>}
      {GRUPOS.map(([id, titulo, ayuda]) => {
        const lista = datos.filter(d => d.grupo === id);
        if (!lista.length) return null;
        return (
          <div key={id} className="card mb16">
            <div className="row just-between mb8">
              <div className="card-title" style={{ margin: 0 }}>{titulo}</div>
              <span className="badge bx">{lista.length}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{ayuda}</div>
            {lista.map(renderFila)}
          </div>
        );
      })}
    </div>
  );
}
