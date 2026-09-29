// Pantallas:
//  - ClubView: datos del club (identidad, contacto, pago). Se cargan una vez.
//  - FichaTorneoView: la información de cada torneo (descripción, precio, cupo, premios).
//  - CopiaSeguridad (dentro de ClubView): descarga toda la base en un archivo
//    y la restaura desde un archivo (RestaurarCopia).
//  - LinkPublico (dentro de FichaTorneoView): el link de la página pública para compartir.
import React, { useState } from "react";
import { conDefectoClub, conDefectoFicha, normalizarColor, paletaDelClub, LOGO_MAX_BYTES } from "../logica/club.js";
import { formatearFecha } from "../logica/fechas.js";
import { nombreArchivoCopia, nombreArchivoPrevio, textoResumen, validarCopia, planRestauracion, resumirPlan, armarLotes, COLECCIONES_COPIA } from "../logica/copia.js";
import { BotonConfirmar } from "./confirmar.jsx";
import { linkPublico, numeroWhatsApp } from "../logica/publico.js";

// Lee una imagen del dispositivo y la achica a un ancho máximo, conservando la transparencia
function leerLogo(archivo, anchoMax = 800) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error("El archivo no es una imagen válida"));
      img.onload = () => {
        const escala = Math.min(1, anchoMax / img.width);
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
        const dataUrl = lienzo.toDataURL("image/png");
        if (dataUrl.length > LOGO_MAX_BYTES * 1.37) rechazar(new Error("El logo es demasiado pesado aun achicado"));
        else resolver(dataUrl);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

const Campo = ({ label, children, ayuda }) => (
  <div className="col mb12"><label className="lbl">{label}</label>{children}{ayuda && <div style={{ fontSize: 11, color: "var(--muted)" }}>{ayuda}</div>}</div>
);

function SelectorColor({ label, valor, onCambiar }) {
  const [texto, setTexto] = useState(valor);
  return (
    <Campo label={label}>
      <div className="row g8">
        <input type="color" value={valor} onChange={e => { onCambiar(e.target.value.toUpperCase()); setTexto(e.target.value.toUpperCase()); }}
          style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 8, background: "transparent" }} />
        <input className="inp" style={{ width: 120 }} value={texto}
          onChange={e => { setTexto(e.target.value); const c = normalizarColor(e.target.value); if (c) onCambiar(c); }} />
      </div>
    </Campo>
  );
}

function SlotLogo({ titulo, fondo, valor, onSubir, onQuitar }) {
  const [estado, setEstado] = useState("");
  return (
    <div className="card" style={{ margin: 0, padding: 14 }}>
      <div className="lbl">{titulo}</div>
      <div style={{ background: fondo, borderRadius: 10, height: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, marginBottom: 10, border: "1px solid var(--border)" }}>
        {valor ? <img src={valor} alt={titulo} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ fontSize: 12, color: "#888" }}>Sin logo</span>}
      </div>
      <div className="row wrap g8">
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
          {valor ? "Cambiar" : "Subir"}
          <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
            onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              setEstado("Procesando...");
              try { await onSubir(await leerLogo(f)); setEstado(""); } catch (err) { setEstado(err.message); }
            }} />
        </label>
        {valor && <button className="btn btn-ghost btn-sm" onClick={onQuitar}>Quitar</button>}
        {estado && <span style={{ fontSize: 11, color: estado.startsWith("Proces") ? "var(--muted)" : "var(--danger)" }}>{estado}</span>}
      </div>
    </div>
  );
}

// Vista previa de cómo se ven las piezas con los datos actuales
function VistaPrevia({ club }) {
  const p = paletaDelClub(club);
  return (
    <div style={{ background: p.fondo, color: p.texto, borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
      {p.logo ? <img src={p.logo} alt="logo" style={{ height: 56, maxWidth: "70%", objectFit: "contain" }} /> : <div style={{ fontWeight: 700, fontSize: 22 }}>{club.nombre}</div>}
      <div style={{ fontFamily: "Oswald", fontSize: 22, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 12 }}>Torneo de ejemplo</div>
      <div style={{ display: "inline-block", background: p.acento, color: "#111", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 6, marginTop: 6 }}>PARTIDOS DE LA SEMANA</div>
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>Mar 14/10 · 19:00 · BOX 1 — Pérez / Gómez vs Rojas / Díaz</div>
      {club.textoApoyo && <div style={{ marginTop: 14, fontSize: 11, opacity: 0.7 }}>{club.textoApoyo}</div>}
    </div>
  );
}

// La fecha de la última copia se recuerda en este dispositivo (no en la base):
// sirve de recordatorio, no de registro.
const KEY_ULTIMA_COPIA = "padelbox_ultima_copia";
const leerUltimaCopia = () => { try { return localStorage.getItem(KEY_ULTIMA_COPIA) || ""; } catch { return ""; } };
const DIAS_AVISO_COPIA = 7;

// Descarga un objeto como archivo .json
export function descargarJSON(obj, nombre) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const fechaCorta = (iso) => new Date(iso).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
const NOMBRE_COL = { torneos: "Torneos", categorias: "Categorías", parejas: "Parejas", partidos: "Partidos", jugadores: "Jugadores", calendarioClub: "Días del calendario", club: "Datos del club", accesos: "Cédulas (accesos)" };

export function CopiaSeguridad({ onPrepararCopia, onAplicarRestauracion, onRestaurado }) {
  const [estado, setEstado] = useState(""); // "" | "trabajando" | "ok" | "error"
  const [detalle, setDetalle] = useState("");
  const [ultima, setUltima] = useState(leerUltimaCopia());
  const descargar = async () => {
    setEstado("trabajando"); setDetalle("");
    try {
      const copia = await onPrepararCopia();
      descargarJSON(copia, nombreArchivoCopia(copia.fecha));
      try { localStorage.setItem(KEY_ULTIMA_COPIA, copia.fecha); } catch { /* sin almacenamiento: solo no se recuerda la fecha */ }
      setUltima(copia.fecha); setEstado("ok"); setDetalle(textoResumen(copia.resumen));
    } catch (err) { setEstado("error"); setDetalle(err.message); }
  };
  const dias = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000) : null;
  const vieja = dias === null || dias >= DIAS_AVISO_COPIA;
  return (
    <div className="card mb16">
      <div className="card-title">Copia de seguridad</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Descarga toda la base (torneos, parejas, resultados, ranking, calendario y club) en un archivo. Guardalo en Drive o en tu computadora. Conviene hacerlo antes de cada torneo y antes de cualquier cambio grande.
      </p>
      <div className="row g8 wrap" style={{ alignItems: "center" }}>
        <button className="btn btn-primary" onClick={descargar} disabled={estado === "trabajando"}>{estado === "trabajando" ? "Preparando copia..." : "⬇️ Descargar copia"}</button>
        <span style={{ fontSize: 12, color: vieja ? "var(--gold)" : "var(--muted)" }}>
          {ultima ? `Última copia desde este dispositivo: ${fechaCorta(ultima)}${dias > 0 ? ` (hace ${dias} ${dias === 1 ? "día" : "días"})` : ""}` : "Todavía no descargaste ninguna copia desde este dispositivo."}
        </span>
      </div>
      {estado === "ok" && <div className="alert alert-ok mt8" style={{ marginBottom: 0 }}>✓ Copia descargada: {detalle}</div>}
      {estado === "error" && <div className="alert alert-warn mt8" style={{ marginBottom: 0 }}>No se pudo hacer la copia: {detalle}. No se descargó nada; probá de nuevo.</div>}
      {onAplicarRestauracion && <RestaurarCopia onPrepararCopia={onPrepararCopia} onAplicarRestauracion={onAplicarRestauracion} onRestaurado={onRestaurado} />}
    </div>
  );
}

// Restaurar: deja la base igual a un archivo de copia.
// Pasos: 1) elegir archivo -> se valida y se muestra qué va a cambiar.
//        2) confirmar -> se descarga una copia del estado actual (para poder
//           deshacer), se recalcula el plan con esa lectura fresca y se escribe.
function RestaurarCopia({ onPrepararCopia, onAplicarRestauracion, onRestaurado }) {
  const [fase, setFase] = useState(""); // "" | "leyendo" | "revision" | "restaurando" | "listo" | "error"
  const [copia, setCopia] = useState(null);
  const [revision, setRevision] = useState(null); // { resumen, versionApp }
  const [mensaje, setMensaje] = useState("");
  const cancelar = () => { setFase(""); setCopia(null); setRevision(null); setMensaje(""); };

  const elegirArchivo = async (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    // Sin filtro de tipo en el selector: en Android algunos selectores esconden
    // los .json. Si eligen cualquier otra cosa, la validación lo rechaza.
    if (!archivo) return;
    setFase("leyendo"); setMensaje(""); setRevision(null);
    try {
      let leida;
      try { leida = JSON.parse(await archivo.text()); } catch { throw new Error("El archivo no se puede leer como copia (no es un .json válido)."); }
      const v = validarCopia(leida);
      if (!v.ok) throw new Error(v.error);
      const actual = await onPrepararCopia();
      const ops = planRestauracion(actual.colecciones, leida.colecciones);
      setCopia(leida);
      setRevision({ resumen: resumirPlan(ops, actual.colecciones), versionApp: actual.version });
      setFase("revision");
    } catch (err) { setFase("error"); setMensaje(err.message); }
  };

  const restaurar = async () => {
    setFase("restaurando"); setMensaje("Guardando el estado actual...");
    let antes;
    try {
      antes = await onPrepararCopia();
      descargarJSON(antes, nombreArchivoPrevio(antes.fecha));
    } catch (err) { setFase("error"); setMensaje(`No se pudo guardar el estado actual (${err.message}). No se restauró nada.`); return; }
    const lotes = armarLotes(planRestauracion(antes.colecciones, copia.colecciones));
    let hechos = 0;
    try {
      setMensaje("Restaurando...");
      await onAplicarRestauracion(lotes, (h, t) => { hechos = h; setMensaje(`Restaurando... parte ${h} de ${t}`); });
    } catch (err) {
      setFase("error");
      setMensaje(`Se cortó en la parte ${hechos + 1} de ${lotes.length} (${err.message}). La base quedó a medio restaurar: volvé a restaurar la misma copia para terminar. Para volver atrás, restaurá el archivo "${nombreArchivoPrevio(antes.fecha)}" que se descargó recién.`);
      if (onRestaurado) onRestaurado();
      return;
    }
    if (onRestaurado) await onRestaurado();
    setFase("listo");
    setMensaje(`La base quedó igual a la copia del ${fechaCorta(copia.fecha)}. El estado anterior se descargó como "${nombreArchivoPrevio(antes.fecha)}": guardalo por si necesitás volver atrás.`);
  };

  const r = revision && revision.resumen;
  const lista = (titulo, nombres) => nombres.length > 0 && <div style={{ marginBottom: 4 }}><b>{titulo}:</b> {nombres.join(", ")}</div>;
  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Restaurar una copia</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Deja la base igual a como estaba en el archivo que elijas. Antes de escribir te muestra qué va a cambiar.
      </p>
      {(fase === "" || fase === "error" || fase === "listo") && (
        <label className="btn btn-ghost" style={{ display: "inline-block", cursor: "pointer" }}>
          📂 Elegir archivo de copia
          <input type="file" data-copia="1" onChange={elegirArchivo} style={{ display: "none" }} />
        </label>
      )}
      {fase === "leyendo" && <div style={{ fontSize: 12, color: "var(--muted)" }}>Leyendo la copia y comparando con la base...</div>}
      {fase === "revision" && r && (
        <div className="alert alert-warn" style={{ marginBottom: 0, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 6 }}>Copia del <b>{fechaCorta(copia.fecha)}</b> ({copia.version || "versión desconocida"}).</div>
          {copia.version !== revision.versionApp && <div style={{ marginBottom: 6 }}>⚠️ La copia es de la {copia.version || "versión desconocida"} y la app está en la {revision.versionApp}. Si entre esas versiones cambió la forma de guardar los datos, la app puede quedar inconsistente.</div>}
          {r.total === 0 ? (
            <div>La base ya es igual a esta copia. No hay nada que restaurar.</div>
          ) : (
            <>
              {lista("Torneos que vuelven", r.torneos.vuelven)}
              {lista("Torneos que desaparecen", r.torneos.desaparecen)}
              {lista("Torneos que cambian", r.torneos.cambian)}
              <div style={{ margin: "6px 0" }}>
                {COLECCIONES_COPIA.filter(c => { const x = r.porCol[c]; return x.vuelven + x.cambian + x.desaparecen > 0; }).map(c => {
                  const x = r.porCol[c]; const partes = [];
                  if (x.vuelven) partes.push(`${x.vuelven} vuelven`);
                  if (x.cambian) partes.push(`${x.cambian} cambian`);
                  if (x.desaparecen) partes.push(`${x.desaparecen} desaparecen`);
                  return <div key={c}>{NOMBRE_COL[c]}: {partes.join(", ")}</div>;
                })}
              </div>
              <div style={{ marginBottom: 8 }}>Todo lo que se cargó después de esa copia se pierde. Antes de escribir se descarga una copia del estado actual, para poder deshacerlo.</div>
            </>
          )}
          <div className="row g8 wrap">
            {r.total > 0 && <BotonConfirmar className="btn btn-danger btn-sm" pregunta="¿La base queda igual a la copia?" textoSi="Sí, restaurar" onConfirmar={restaurar}>Restaurar esta copia</BotonConfirmar>}
            <button className="btn btn-ghost btn-sm" onClick={cancelar}>{r.total > 0 ? "Cancelar" : "Cerrar"}</button>
          </div>
        </div>
      )}
      {fase === "restaurando" && <div style={{ fontSize: 12, color: "var(--gold)" }}>⏳ {mensaje} No cierres la app.</div>}
      {fase === "listo" && <div className="alert alert-ok mt8" style={{ marginBottom: 0 }}>✓ {mensaje}</div>}
      {fase === "error" && mensaje && <div className="alert alert-warn mt8" style={{ marginBottom: 0 }}>{mensaje}</div>}
    </div>
  );
}

export function ClubView({ club, onGuardar, onGuardarLogo, onPrepararCopia, onAplicarRestauracion, onRestaurado }) {
  const [form, setForm] = useState(conDefectoClub(club));
  const [estado, setEstado] = useState("");
  const set = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); setEstado(""); };
  const setTexto = (k) => (e) => set(k)(e.target.value);
  const subirLogo = (tipo) => async (dataUrl) => {
    setForm(f => ({ ...f, [tipo]: dataUrl }));
    await onGuardarLogo(tipo, dataUrl);
  };
  const guardar = async () => {
    setEstado("Guardando...");
    const { logoColor, logoBlanco, ...datos } = form;
    try { await onGuardar(datos); setEstado("✓ Guardado"); } catch (err) { setEstado("Error: " + err.message); }
  };
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Datos del club</div>
        <div className="row g8">
          {estado && <span className={`badge ${estado.startsWith("✓") ? "bg" : estado.startsWith("Error") ? "by" : "bx"}`}>{estado}</span>}
          <button className="btn btn-primary" onClick={guardar}>Guardar</button>
        </div>
      </div>
      <div className="card mb16" style={{ fontSize: 12, color: "var(--muted)" }}>
        Se cargan una sola vez y los usan todos los torneos: la imagen de los partidos de la semana y la página pública del torneo.
      </div>
      <div className="grid2">
        <div>
          <div className="card mb16">
            <div className="card-title">Identidad</div>
            <Campo label="Nombre del club"><input className="inp" value={form.nombre} onChange={setTexto("nombre")} /></Campo>
            <div className="grid2 mb12">
              <SlotLogo titulo="Logo para fondo claro" fondo="#FFFFFF" valor={form.logoColor} onSubir={subirLogo("logoColor")} onQuitar={() => subirLogo("logoColor")("")} />
              <SlotLogo titulo="Logo para fondo oscuro" fondo={form.colorOscuro} valor={form.logoBlanco} onSubir={subirLogo("logoBlanco")} onQuitar={() => subirLogo("logoBlanco")("")} />
            </div>
            <div className="grid3">
              <SelectorColor label="Color principal" valor={form.colorPrincipal} onCambiar={set("colorPrincipal")} />
              <SelectorColor label="Oscuro" valor={form.colorOscuro} onCambiar={set("colorOscuro")} />
              <SelectorColor label="Claro" valor={form.colorClaro} onCambiar={set("colorClaro")} />
            </div>
            <Campo label="Fondo de la imagen y la página" ayuda="No uses el color principal como fondo: la pelota del logo es de ese color y desaparece.">
              <div className="row g8">
                {[["oscuro", "Oscuro"], ["claro", "Claro"]].map(([v, t]) => (
                  <button key={v} className={`btn btn-sm ${form.tema === v ? "btn-primary" : "btn-ghost"}`} onClick={() => set("tema")(v)}>{t}</button>
                ))}
              </div>
            </Campo>
            <Campo label="Texto de apoyo (opcional)" ayuda="Aparece chico al pie. Vacío = no aparece.">
              <input className="inp" value={form.textoApoyo} onChange={setTexto("textoApoyo")} placeholder="Con el apoyo de Academia LR" />
            </Campo>
          </div>
          <div className="card mb16">
            <div className="card-title">Vista previa</div>
            <VistaPrevia club={form} />
          </div>
        </div>
        <div>
          <div className="card mb16">
            <div className="card-title">Contacto</div>
            <Campo label="WhatsApp" ayuda="Con código de país, para el botón de contacto. Ej: 595981123456"><input className="inp" inputMode="tel" value={form.whatsapp} onChange={setTexto("whatsapp")} placeholder="595..." /></Campo>
            <Campo label="Instagram"><input className="inp" value={form.instagram} onChange={setTexto("instagram")} placeholder="@padelbox" /></Campo>
            <Campo label="Dirección"><input className="inp" value={form.direccion} onChange={setTexto("direccion")} /></Campo>
            <Campo label="Link de Google Maps (opcional)"><input className="inp" value={form.mapsUrl} onChange={setTexto("mapsUrl")} placeholder="https://maps.app.goo.gl/..." /></Campo>
          </div>
          <div className="card mb16">
            <div className="card-title">Datos de pago</div>
            <Campo label="Alias o número de cuenta"><input className="inp" value={form.pagoAlias} onChange={setTexto("pagoAlias")} /></Campo>
            <Campo label="Titular"><input className="inp" value={form.pagoTitular} onChange={setTexto("pagoTitular")} /></Campo>
            <Campo label="Banco"><input className="inp" value={form.pagoBanco} onChange={setTexto("pagoBanco")} /></Campo>
            <Campo label="Nota para el pago (opcional)"><input className="inp" value={form.pagoNota} onChange={setTexto("pagoNota")} placeholder="Ej: enviar comprobante por WhatsApp" /></Campo>
          </div>
        </div>
      </div>
      {onPrepararCopia && <CopiaSeguridad onPrepararCopia={onPrepararCopia} onAplicarRestauracion={onAplicarRestauracion} onRestaurado={onRestaurado} />}
    </div>
  );
}

// El link de la página pública del torneo, con avisos de lo que le falta
function LinkPublico({ torneo, ficha, club }) {
  const [aviso, setAviso] = useState("");
  const link = linkPublico(window.location.origin + window.location.pathname, torneo.id);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setAviso("✓ Link copiado"); }
    catch { setAviso("No se pudo copiar: mantené apretado el link y copialo a mano."); }
  };
  const compartir = async () => {
    try { await navigator.share({ title: torneo.nombre, text: `Inscripciones abiertas: ${torneo.nombre}`, url: link }); }
    catch { /* la persona cerró el menú de compartir */ }
  };
  const faltas = [];
  if (!numeroWhatsApp(conDefectoClub(club).whatsapp)) faltas.push("Sin un WhatsApp válido en 🏟️ Club, la página no muestra el botón para inscribirse.");
  if (!(Number(ficha.cupo) > 0)) faltas.push("Sin cupo, la página no muestra cuántos lugares quedan.");
  return (
    <div className="card mb16">
      <div className="card-title">Página pública</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>La ve cualquiera con el link: información, categorías, inscriptos, cupo y el botón para inscribirse por WhatsApp. Muestra lo último que guardaste.</div>
      <div style={{ fontSize: 12, wordBreak: "break-all", userSelect: "all", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>{link}</div>
      <div className="row g8 wrap">
        <button className="btn btn-secondary btn-sm" onClick={copiar}>📋 Copiar link</button>
        {navigator.share && <button className="btn btn-secondary btn-sm" onClick={compartir}>📤 Compartir</button>}
        <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>👁️ Ver página</a>
        {aviso && <span style={{ fontSize: 12, color: aviso.startsWith("✓") ? "var(--accent)" : "var(--gold)" }}>{aviso}</span>}
      </div>
      {faltas.map((t, i) => <div key={i} className="alert alert-warn mt8" style={{ marginBottom: 0 }}>⚠️ {t}</div>)}
    </div>
  );
}

export function FichaTorneoView({ torneo, onGuardar, club }) {
  const [ficha, setFicha] = useState(conDefectoFicha(torneo?.ficha));
  const [fecha, setFecha] = useState(torneo?.fecha || "");
  const [estado, setEstado] = useState("");
  const set = (k) => (e) => { setFicha(f => ({ ...f, [k]: e.target.value })); setEstado(""); };
  const guardar = async () => {
    setEstado("Guardando...");
    try { await onGuardar({ fecha, ficha }); setEstado("✓ Guardado"); } catch (err) { setEstado("Error: " + err.message); }
  };
  const largo = torneo?.calendario === "largo";
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Ficha del torneo</div>
        <div className="row g8">
          {estado && <span className={`badge ${estado.startsWith("✓") ? "bg" : estado.startsWith("Error") ? "by" : "bx"}`}>{estado}</span>}
          <button className="btn btn-primary" onClick={guardar}>Guardar</button>
        </div>
      </div>
      <div className="card mb16" style={{ fontSize: 12, color: "var(--muted)" }}>
        La información que van a ver los jugadores en la página del torneo. Las categorías se toman de las que creaste.
      </div>
      {torneo && <LinkPublico torneo={torneo} ficha={conDefectoFicha(torneo.ficha)} club={club} />}
      <div className="grid2">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">El evento</div>
          <Campo label="Descripción" ayuda="Formato, qué incluye la inscripción, cómo se juega.">
            <textarea className="inp" rows={6} value={ficha.descripcion} onChange={set("descripcion")} style={{ resize: "vertical" }} />
          </Campo>
          <div className="grid2">
            <Campo label="Fecha de inicio" ayuda={largo ? "En torneo largo es la semana 1 del armado." : null}><input className="inp" type="date" value={fecha} onChange={e => { setFecha(e.target.value); setEstado(""); }} /></Campo>
            <Campo label="Fecha de fin (opcional)"><input className="inp" type="date" value={ficha.fechaFin} onChange={set("fechaFin")} /></Campo>
          </div>
          <Campo label="Premios"><textarea className="inp" rows={3} value={ficha.premios} onChange={set("premios")} style={{ resize: "vertical" }} /></Campo>
          <Campo label="Notas (opcional)"><textarea className="inp" rows={2} value={ficha.notas} onChange={set("notas")} style={{ resize: "vertical" }} /></Campo>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">Inscripción</div>
          <div className="grid2">
            <Campo label="Precio"><input className="inp" inputMode="numeric" value={ficha.precio} onChange={set("precio")} placeholder="Ej: 200.000 Gs" /></Campo>
            <Campo label="Por">
              <select className="inp" value={ficha.precioPor} onChange={set("precioPor")}>
                <option value="pareja">Pareja</option>
                <option value="jugador">Jugador</option>
              </select>
            </Campo>
          </div>
          <div className="grid2">
            <Campo label="Cupo (parejas por categoría)"><input className="inp" type="number" min={0} value={ficha.cupo} onChange={set("cupo")} /></Campo>
            <Campo label="Cierre de inscripción"><input className="inp" type="date" value={ficha.fechaLimite} onChange={set("fechaLimite")} /></Campo>
          </div>
          {ficha.fechaLimite && fecha && ficha.fechaLimite > fecha && <div className="alert alert-warn">⚠️ El cierre de inscripción ({formatearFecha(ficha.fechaLimite)}) es después del inicio del torneo.</div>}
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Los datos de pago y contacto se toman de 🏟️ Club.</div>
        </div>
      </div>
    </div>
  );
}
