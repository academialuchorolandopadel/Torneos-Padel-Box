// Página pública de inscripción a "partidos por nivel" (se abre con ?anotarse=1).
// La persona completa sus datos y su perfil de una vez; queda como solicitud
// hasta que el organizador la apruebe en Perfiles → Anotados.
// No lee nada de la base: solo manda la solicitud (datos/firestore.js).
import React, { useState } from "react";
import { CSS } from "../estilos.js";
import { VERSION } from "../version.js";
import { NOMBRES_DIA, ORDEN_SEMANA } from "../logica/calendario.js";
import { fechaHoyISO } from "../logica/fechas.js";
import { PREGUNTAS, FRANJAS, franjasADisponibilidad, nuevaVigencia } from "../logica/perfil.js";
import { armarSolicitud } from "../logica/anotarse.js";
import { enviarSolicitud } from "../datos/firestore.js";
import { Marca, textoPie } from "./marca.jsx";

const LADOS = [["drive", "Drive"], ["reves", "Revés"], ["ambos", "Los dos, cómodo en ambos"]];
const GENEROS = [["M", "Caballeros"], ["F", "Damas"]];

const Opciones = ({ opciones, valor, onElegir }) => (
  <div className="row wrap g8">
    {opciones.map(([id, texto]) => (
      <button key={id} type="button" className={`btn btn-sm ${valor === id ? "btn-primary" : "btn-ghost"}`} aria-pressed={valor === id} onClick={() => onElegir(id)}>{texto}</button>
    ))}
  </div>
);

export function Anotarse() {
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [genero, setGenero] = useState("");
  const [lado, setLado] = useState("");
  const [respuestas, setRespuestas] = useState({});
  const [franjas, setFranjas] = useState({});
  const [errores, setErrores] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const respondidas = PREGUNTAS.filter(p => respuestas[p.id]).length;

  const tocarFranja = (dia, franja) => setFranjas(prev => {
    const d = String(dia), actuales = prev[d] || [];
    const nuevas = actuales.includes(franja) ? actuales.filter(f => f !== franja) : [...actuales, franja];
    const out = { ...prev };
    if (nuevas.length) out[d] = nuevas; else delete out[d];
    return out;
  });

  const enviar = async () => {
    if (enviando) return;
    const perfil = { genero, lado, respuestas, disponibilidad: franjasADisponibilidad(franjas), venceEl: nuevaVigencia(fechaHoyISO()) };
    const { solicitud, errores: lista } = armarSolicitud({ nombre, cedula, whatsapp, perfil }, new Date().toISOString());
    setErrores(lista);
    if (!solicitud) return;
    setEnviando(true);
    try { await enviarSolicitud(solicitud); setListo(true); window.scrollTo(0, 0); }
    catch (err) { console.error(err); setErrores(["No se pudo enviar. Revisá tu conexión e intentá de nuevo."]); }
    finally { setEnviando(false); }
  };

  const marco = (contenido) => (<><style>{CSS}</style><div className="app">
    <header className="hdr"><Marca club={null} /></header>
    <div className="main" style={{ maxWidth: 680 }}>{contenido}</div>
    <div className="pie-version">{textoPie(VERSION)}</div>
  </div></>);

  if (listo) return marco(
    <div className="card" style={{ textAlign: "center", padding: "36px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎾</div>
      <div className="sec-title" style={{ marginBottom: 12 }}>¡Listo, {nombre.trim().split(/\s+/)[0]}!</div>
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>Recibimos tus datos. Cuando estés habilitado te escribimos por WhatsApp, y desde ahí vas a recibir los partidos que se armen con gente de tu nivel.</p>
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginTop: 12 }}>Una vez habilitado, podés entrar a la app con tu cédula para cambiar tus horarios cuando quieras.</p>
    </div>
  );

  return marco(<>
    <div className="sec-hdr"><div className="sec-title">Partidos por nivel</div></div>
    <div className="card mb16">
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>Anotate para jugar partidos parejos con gente nueva de tu nivel. Cuando haya 4 que coincidan en nivel y horario, te escribimos por WhatsApp para armar el partido.</p>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Se completa tocando opciones y lleva un par de minutos.</p>
    </div>

    <div className="card mb16">
      <div className="card-title">Tus datos</div>
      <label className="lbl" htmlFor="an-nombre">Nombre y apellido</label>
      <input id="an-nombre" className="inp mb12" autoComplete="name" placeholder="Juan Pérez" value={nombre} onChange={e => setNombre(e.target.value)} />
      <label className="lbl" htmlFor="an-cedula">Cédula</label>
      <input id="an-cedula" className="inp mb12" inputMode="numeric" placeholder="1234567" value={cedula} onChange={e => setCedula(e.target.value)} />
      <label className="lbl" htmlFor="an-wa">WhatsApp</label>
      <input id="an-wa" className="inp" type="tel" inputMode="tel" autoComplete="tel" placeholder="0981 123 456" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Tu cédula y tu WhatsApp solo los ve el organizador. La cédula es para que después puedas entrar a la app.</div>
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
      <div className="row just-between mb12">
        <div className="card-title" style={{ margin: 0 }}>Tu nivel</div>
        <span className={`badge ${respondidas === PREGUNTAS.length ? "bg" : "bx"}`}>{respondidas} de {PREGUNTAS.length}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>Respondé como jugás hoy, no como te gustaría jugar: así te tocan partidos parejos.</p>
      {PREGUNTAS.map(p => (
        <div key={p.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{p.texto}</div>
          <Opciones opciones={p.opciones.map(o => [o.id, o.texto])} valor={respuestas[p.id]} onElegir={id => setRespuestas(r => ({ ...r, [p.id]: id }))} />
        </div>
      ))}
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
              return <button key={f.id} type="button" className={`btn btn-xs ${on ? "btn-primary" : "btn-ghost"}`} aria-pressed={on} style={{ minWidth: 64, justifyContent: "center" }} onClick={() => tocarFranja(d, f.id)}>{f.texto}</button>;
            })}
          </div>
        </div>
      ))}
    </div>

    {errores.length > 0 && <div className="alert alert-warn">{errores.map((e, i) => <div key={i}>{e}</div>)}</div>}
    <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }} onClick={enviar} disabled={enviando}>
      {enviando ? "Enviando..." : "Anotarme"}
    </button>
  </>);
}
