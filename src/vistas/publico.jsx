// Página pública del torneo (link ?t=<id>).
// La ve cualquiera, sin cuenta: la información del torneo, las categorías con
// sus inscriptos y cupo, un formulario corto que arma el mensaje de
// inscripción para WhatsApp, y cómo instalar la app.
// No guarda nada: el formulario solo arma el texto del mensaje.
// Usa la identidad de Padel Box (colores y logo de 🏟️ Club), no la de la app.
import React, { useEffect, useState } from "react";
import { cargarTorneoPublico } from "../datos/firestore.js";
import { conDefectoClub, conDefectoFicha, paletaDelClub } from "../logica/club.js";
import { estadoCategoria, mensajeInscripcion, faltantesInscripcion, numeroWhatsApp, linkWhatsApp, rangoFechas, fechaCorta } from "../logica/publico.js";
import { fechaHoyISO } from "../logica/fechas.js";
import { plataforma, yaInstalada, puedeInstalarDirecto, pedirInstalacion, alCambiarInstalacion } from "../instalar.js";
import { VERSION } from "../version.js";

// "#FFFFFF" + 0.14 -> "rgba(255,255,255,0.14)" (en vez de color-mix, que algunos celulares viejos no entienden)
function transparente(hex, alfa) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return `rgba(255,255,255,${alfa})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alfa})`;
}

const css = (p) => `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=DM+Sans:wght@400;500;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${p.fondo};color:${p.texto};font-family:'DM Sans',system-ui,sans-serif;-webkit-text-size-adjust:100%}
  .pt{--acento:${p.acento};--suave:${transparente(p.texto, 0.62)};--linea:${transparente(p.texto, 0.16)};--capa:${transparente(p.texto, 0.05)};max-width:560px;margin:0 auto;padding:28px 20px 40px;line-height:1.5}
  .pt a{color:var(--acento)}
  .pt-logo{height:44px;max-width:60%;object-fit:contain;display:block;margin-bottom:26px}
  .pt-club{font-weight:700;margin-bottom:26px;color:var(--suave)}
  .pt-h1{font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(34px,10vw,52px);line-height:1.02;text-transform:uppercase;letter-spacing:.5px}
  .pt-fecha{font-size:17px;margin-top:12px}
  .pt-fecha::first-letter{text-transform:uppercase}
  .pt-lugar{color:var(--suave);font-size:14px;margin-top:4px}
  .pt-datos{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--linea);border:1px solid var(--linea);border-radius:12px;overflow:hidden;margin:26px 0}
  .pt-dato{background:${p.fondo};padding:12px 14px}
  .pt-dato b{display:block;font-size:17px}
  .pt-dato span{font-size:12px;color:var(--suave)}
  .pt-texto{white-space:pre-wrap;font-size:15px;margin-bottom:18px}
  .pt-h2{font-family:'Oswald',sans-serif;font-weight:500;font-size:22px;margin:30px 0 12px}
  .pt-cat{border:1px solid var(--linea);border-radius:14px;padding:16px;margin-bottom:12px;background:var(--capa)}
  .pt-cat-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
  .pt-cat-nombre{font-family:'Oswald',sans-serif;font-weight:700;font-size:24px;line-height:1.1}
  .pt-cat-sub{font-size:13px;color:var(--suave);margin-top:2px}
  .pt-libres{text-align:right;flex-shrink:0}
  .pt-libres b{font-family:'Oswald',sans-serif;font-size:34px;line-height:1;color:var(--acento);display:block}
  .pt-libres span{font-size:12px;color:var(--suave)}
  .pt-libres.lleno b{color:var(--suave);font-size:20px}
  .pt-barra{height:6px;border-radius:3px;background:var(--linea);margin:12px 0 4px;overflow:hidden}
  .pt-barra i{display:block;height:100%;background:var(--acento);border-radius:3px}
  .pt-lista{margin-top:10px;font-size:14px}
  .pt-lista summary{cursor:pointer;color:var(--suave)}
  .pt-lista ol{margin:8px 0 0 22px}
  .pt-lista li{padding:2px 0}
  .pt-btn{display:block;width:100%;text-align:center;border:0;border-radius:10px;padding:13px 16px;font:700 15px 'DM Sans',sans-serif;cursor:pointer;margin-top:14px;text-decoration:none}
  .pt-btn.lleno{background:var(--acento);color:#111}
  .pt-btn.borde{background:transparent;color:${p.texto};border:1px solid var(--linea)}
  .pt-btn:focus-visible,.pt-in:focus-visible{outline:2px solid var(--acento);outline-offset:2px}
  .pt-cerrada{margin-top:12px;font-size:14px;color:var(--suave)}
  .pt-form{margin-top:14px;border-top:1px solid var(--linea);padding-top:14px}
  .pt-form label{display:block;font-size:13px;color:var(--suave);margin:10px 0 4px}
  .pt-in{width:100%;background:${p.fondo};color:${p.texto};border:1px solid var(--linea);border-radius:8px;padding:11px 12px;font:16px 'DM Sans',sans-serif}
  .pt-aviso{font-size:13px;margin-top:10px;color:var(--acento)}
  .pt-error{font-size:13px;margin-top:10px;color:#ff8a8a}
  .pt-app{border:1px solid var(--linea);border-radius:14px;padding:16px;margin-top:30px}
  .pt-app ol{margin:8px 0 0 20px;font-size:14px}
  .pt-app li{padding:3px 0}
  .pt-pie{margin-top:36px;font-size:12px;color:var(--suave);text-align:center}
  .pt-pie div+div{margin-top:4px}
`;

const mayuscula = (t) => t ? t[0].toUpperCase() + t.slice(1) : t;

// Paso a paso para instalar según el teléfono
function InstalarApp() {
  const [, refrescar] = useState(0);
  useEffect(() => alCambiarInstalacion(() => refrescar(n => n + 1)), []);
  if (yaInstalada()) return null;
  const pf = plataforma();
  const ua = navigator.userAgent || "";
  const navegadorInterno = /Instagram|FBAN|FBAV/.test(ua);
  if (pf === "otra") return null;
  return (
    <div className="pt-app">
      <div style={{ fontWeight: 700, fontSize: 16 }}>Tené la app en tu celular</div>
      <div style={{ fontSize: 14, color: "var(--suave)", marginTop: 4 }}>Para seguir tus partidos, horarios y resultados sin buscar el link.</div>
      {navegadorInterno ? (
        <div style={{ fontSize: 14, marginTop: 10 }}>Abriste el link desde Instagram o Facebook, y desde ahí no se puede instalar. Tocá los tres puntos (⋯) y elegí «Abrir en el navegador».</div>
      ) : pf === "android" && puedeInstalarDirecto() ? (
        <button className="pt-btn lleno" onClick={() => pedirInstalacion()}>Instalar la app</button>
      ) : pf === "android" ? (
        <ol>
          <li>Tocá el menú <b>⋮</b> de Chrome (arriba a la derecha).</li>
          <li>Elegí <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.</li>
        </ol>
      ) : (
        <ol>
          <li>Tocá <b>Compartir</b>: el cuadrado con la flecha para arriba (en Safari está abajo).</li>
          <li>Deslizá y elegí <b>«Agregar a inicio»</b>.</li>
          <li>Tocá <b>«Agregar»</b>. La app queda en tu pantalla como cualquier otra.</li>
        </ol>
      )}
    </div>
  );
}

// Formulario corto: arma el mensaje y abre WhatsApp. No guarda nada.
function FormInscripcion({ torneo, categoria, individual, espera, numero }) {
  const [f, setF] = useState({ jugador1: "", jugador2: "", telefono: "" });
  const [faltan, setFaltan] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const set = (k) => (e) => { setF(v => ({ ...v, [k]: e.target.value })); setFaltan([]); };
  const datos = { ...f, individual };
  const listos = faltantesInscripcion(datos).length === 0;
  const href = listos ? linkWhatsApp(numero, mensajeInscripcion({ torneo, categoria, espera, ...datos })) : "#";
  const alTocar = (e) => {
    const fal = faltantesInscripcion(datos);
    if (fal.length) { e.preventDefault(); setFaltan(fal); return; }
    setEnviado(true);
  };
  return (
    <div className="pt-form">
      <label htmlFor={`j1-${categoria}`}>{individual ? "Tu nombre y apellido" : "Jugador/a 1 — nombre y apellido"}</label>
      <input id={`j1-${categoria}`} className="pt-in" autoComplete="name" value={f.jugador1} onChange={set("jugador1")} />
      {!individual && <>
        <label htmlFor={`j2-${categoria}`}>Jugador/a 2 — nombre y apellido</label>
        <input id={`j2-${categoria}`} className="pt-in" value={f.jugador2} onChange={set("jugador2")} />
      </>}
      <label htmlFor={`tel-${categoria}`}>Teléfono de contacto</label>
      <input id={`tel-${categoria}`} className="pt-in" type="tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={set("telefono")} placeholder="0981 123 456" />
      <a className="pt-btn lleno" href={href} target="_blank" rel="noopener noreferrer" onClick={alTocar}>Enviar por WhatsApp</a>
      {faltan.length > 0 && <div className="pt-error">Falta completar: {faltan.join(", ")}.</div>}
      {enviado && <div className="pt-aviso">Se abrió WhatsApp con tu mensaje: solo falta tocar enviar. Te respondemos por ahí para confirmar el lugar y el pago.</div>}
    </div>
  );
}

function Categoria({ cat, torneo, ficha, numero, hoy }) {
  const [abierto, setAbierto] = useState(false);
  const e = estadoCategoria(cat, ficha, hoy);
  const unidad = e.individual ? (e.inscriptos === 1 ? "jugador/a" : "jugadores") : (e.inscriptos === 1 ? "pareja" : "parejas");
  return (
    <div className="pt-cat">
      <div className="pt-cat-top">
        <div>
          <div className="pt-cat-nombre">{cat.nombre}</div>
          <div className="pt-cat-sub">{e.inscriptos} {unidad} {e.inscriptos === 1 ? "inscripta" : "inscriptas"}{e.cupo ? ` de ${e.cupo}` : ""}</div>
        </div>
        {e.cupo && !e.cerrada && (
          <div className={`pt-libres${e.completo ? " lleno" : ""}`}>
            <b>{e.completo ? "Completo" : e.quedan}</b>
            {!e.completo && <span>{e.quedan === 1 ? "lugar libre" : "lugares libres"}</span>}
          </div>
        )}
      </div>
      {e.cupo && <div className="pt-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (e.inscriptos / e.cupo) * 100)}%` }} /></div>}
      {e.inscriptos > 0 && (
        <details className="pt-lista">
          <summary>Ver inscriptos</summary>
          <ol>{e.nombres.map((n, i) => <li key={i}>{n}</li>)}</ol>
        </details>
      )}
      {e.cerrada ? (
        <div className="pt-cerrada">{e.cerrada}</div>
      ) : !numero ? (
        <div className="pt-cerrada">Para inscribirte, consultá en el club.</div>
      ) : !abierto ? (
        <button className={`pt-btn ${e.completo ? "borde" : "lleno"}`} onClick={() => setAbierto(true)}>
          {e.completo ? "Anotarme en lista de espera" : `Inscribirme en ${cat.nombre}`}
        </button>
      ) : (
        <FormInscripcion torneo={torneo.nombre} categoria={cat.nombre} individual={e.individual} espera={e.completo} numero={numero} />
      )}
    </div>
  );
}

export function PaginaTorneo({ torneoId }) {
  const [estado, setEstado] = useState("cargando"); // "cargando" | "listo" | "no-existe" | "error"
  const [d, setD] = useState(null);
  const cargar = async () => {
    setEstado("cargando");
    try {
      const r = await cargarTorneoPublico(torneoId);
      if (!r) { setEstado("no-existe"); return; }
      setD(r); setEstado("listo");
    } catch (err) { console.error(err); setEstado("error"); }
  };
  useEffect(() => { cargar(); }, [torneoId]);

  const club = conDefectoClub(d?.club);
  const p = paletaDelClub(club);
  useEffect(() => {
    if (d) document.title = `${d.torneo.nombre} · ${club.nombre}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", p.fondo);
  }, [d, p.fondo]);

  const envoltorio = (contenido) => (<><style>{css(p)}</style><div className="pt">{contenido}</div></>);
  if (estado === "cargando") return envoltorio(<div style={{ color: "var(--suave)", paddingTop: 40 }}>Cargando torneo...</div>);
  if (estado === "no-existe") return envoltorio(<div style={{ paddingTop: 40 }}>Este torneo no existe o fue eliminado. Pedí el link actualizado en el club.</div>);
  if (estado === "error") return envoltorio(<div style={{ paddingTop: 40 }}>No se pudo cargar el torneo. Revisá tu conexión.<button className="pt-btn borde" onClick={cargar}>Probar de nuevo</button></div>);

  const { torneo, categorias } = d;
  const ficha = conDefectoFicha(torneo.ficha);
  const hoy = fechaHoyISO();
  const numero = numeroWhatsApp(club.whatsapp);
  const fechas = rangoFechas(torneo.fecha, ficha.fechaFin);
  const precio = ficha.precio ? `${ficha.precio}` : "";
  return envoltorio(<>
    {p.logo ? <img className="pt-logo" src={p.logo} alt={club.nombre} /> : <div className="pt-club">{club.nombre}</div>}
    <h1 className="pt-h1">{torneo.nombre}</h1>
    {fechas && <div className="pt-fecha">{fechas}{torneo.horaInicio ? `, desde las ${torneo.horaInicio}` : ""}</div>}
    {club.direccion && <div className="pt-lugar">{club.nombre} · {club.direccion}{club.mapsUrl && <> · <a href={club.mapsUrl} target="_blank" rel="noopener noreferrer">Cómo llegar</a></>}</div>}

    {(precio || ficha.fechaLimite) && (
      <div className="pt-datos">
        {precio && <div className="pt-dato"><b>{precio}</b><span>por {ficha.precioPor === "jugador" ? "jugador/a" : "pareja"}</span></div>}
        {ficha.fechaLimite && <div className="pt-dato"><b>{mayuscula(fechaCorta(ficha.fechaLimite))}</b><span>cierre de inscripción</span></div>}
      </div>
    )}
    {ficha.descripcion && <p className="pt-texto">{ficha.descripcion}</p>}
    {ficha.premios && <><h2 className="pt-h2">Premios</h2><p className="pt-texto">{ficha.premios}</p></>}

    <h2 className="pt-h2">Categorías</h2>
    {categorias.length === 0
      ? <p className="pt-texto" style={{ color: "var(--suave)" }}>Las categorías se anuncian pronto.</p>
      : categorias.map(c => <Categoria key={c.id} cat={c} torneo={torneo} ficha={ficha} numero={numero} hoy={hoy} />)}
    {ficha.notas && <p className="pt-texto" style={{ color: "var(--suave)", marginTop: 18 }}>{ficha.notas}</p>}

    <InstalarApp />
    {/* En iPhone, la app instalada desde esta página puede abrir en esta misma
        página (Safari guarda el link completo). Desde acá se llega a la app. */}
    {yaInstalada() && <a className="pt-btn borde" href={window.location.pathname}>Ir a la app: fixture, horarios y resultados</a>}

    <div className="pt-pie">
      {club.instagram && <div>{club.instagram}</div>}
      {club.textoApoyo && <div>{club.textoApoyo}</div>}
      <div style={{ opacity: 0.6 }}>PadelBox {VERSION}</div>
    </div>
  </>);
}
