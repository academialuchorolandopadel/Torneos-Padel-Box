// Imagen de los partidos de la semana: se dibuja en un canvas con la identidad
// del club y se comparte (menú de compartir del teléfono) o se descarga como PNG.
import React, { useState, useEffect, useRef } from "react";
import { FORMATOS, partidosParaImagen, paginar, tituloDia, rangoSemana } from "../logica/imagen.js";
import { paletaDelClub, conDefectoClub } from "../logica/club.js";
import { lunesDeSemana, sumarDias } from "../logica/calendario.js";
import { fechaHoyISO, formatearFecha } from "../logica/fechas.js";

const PAD = 70;
const UNIDAD = 108; // alto de una fila de partido (un encabezado de día ocupa 0.6)

// "#8DC73F" + opacidad -> "rgba(141,199,63,0.5)"
function rgba(hex, a) {
  const h = (hex || "#000000").replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
  return `rgba(${r},${g},${b},${a})`;
}
// Recorta un texto con "…" para que entre en un ancho
function ajustar(ctx, texto, anchoMax) {
  if (ctx.measureText(texto).width <= anchoMax) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + "…").width > anchoMax) t = t.slice(0, -1);
  return t + "…";
}
// Parte un texto en hasta N líneas que entren en el ancho
function lineas(ctx, texto, anchoMax, max) {
  const palabras = texto.split(/\s+/), out = [];
  let linea = "";
  for (const p of palabras) {
    const prueba = linea ? linea + " " + p : p;
    if (ctx.measureText(prueba).width <= anchoMax || !linea) linea = prueba;
    else { out.push(linea); linea = p; }
  }
  if (linea) out.push(linea);
  if (out.length > max) { out.length = max; out[max - 1] = ajustar(ctx, out[max - 1] + "…", anchoMax); }
  return out;
}
function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const cargarImagen = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// Dibuja una página completa
function dibujarPagina(ctx, { formato, pagina, nro, total, torneo, club, pal, logo, etiqueta, subtitulo, largo }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const post = formato === "post";
  ctx.fillStyle = pal.fondo; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  let y = post ? 56 : 80;
  // Logo (o el nombre del club si no hay logo)
  const cajaW = 520, cajaH = post ? 130 : 170;
  if (logo) {
    const e = Math.min(cajaW / logo.width, cajaH / logo.height);
    const w = logo.width * e, h = logo.height * e;
    ctx.drawImage(logo, (W - w) / 2, y + (cajaH - h) / 2, w, h);
  } else {
    ctx.fillStyle = pal.texto; ctx.font = "700 64px Oswald, sans-serif"; ctx.textAlign = "center";
    ctx.fillText((club.nombre || "TORNEOS").toUpperCase(), W / 2, y + cajaH / 2 + 22);
  }
  y += cajaH + (post ? 40 : 60);
  // Nombre del torneo (hasta 2 líneas)
  ctx.fillStyle = pal.texto; ctx.textAlign = "center";
  const tam = post ? 62 : 74;
  ctx.font = `700 ${tam}px Oswald, sans-serif`;
  for (const l of lineas(ctx, (torneo.nombre || "").toUpperCase(), W - 2 * PAD, 2)) { ctx.fillText(l, W / 2, y + tam * 0.8); y += tam * 1.05; }
  y += 18;
  // Etiqueta en el color principal
  ctx.font = "700 30px 'DM Sans', sans-serif";
  const ew = ctx.measureText(etiqueta).width + 56;
  ctx.fillStyle = pal.acento; rectRedondeado(ctx, (W - ew) / 2, y, ew, 54, 27); ctx.fill();
  ctx.fillStyle = "#1a1a1a"; ctx.fillText(etiqueta, W / 2, y + 38);
  y += 54 + 46;
  if (subtitulo) { ctx.fillStyle = rgba(pal.texto === "#FFFFFF" ? "#FFFFFF" : pal.texto, 0.8); ctx.font = "500 34px 'DM Sans', sans-serif"; ctx.fillText(subtitulo, W / 2, y); }
  y += post ? 36 : 56;
  // Cuerpo: días y partidos
  ctx.textAlign = "left";
  const suave = rgba(pal.texto, 0.07), tenue = rgba(pal.texto, 0.65);
  for (const g of pagina.grupos) {
    const hDia = UNIDAD * 0.6;
    ctx.fillStyle = pal.acento; ctx.font = "600 38px Oswald, sans-serif";
    ctx.fillText(tituloDia(g.clave, largo), PAD, y + hDia - 22);
    ctx.fillStyle = rgba(pal.acento, 0.35); ctx.fillRect(PAD, y + hDia - 10, W - 2 * PAD, 2);
    y += hDia;
    for (const f of g.filas) {
      const h = UNIDAD - 12;
      ctx.fillStyle = suave; rectRedondeado(ctx, PAD, y, W - 2 * PAD, h, 16); ctx.fill();
      // hora y cancha
      ctx.fillStyle = pal.texto; ctx.font = "700 46px Oswald, sans-serif"; ctx.fillText(f.hora, PAD + 26, y + 52);
      ctx.fillStyle = tenue; ctx.font = "500 24px 'DM Sans', sans-serif"; ctx.fillText(f.cancha, PAD + 28, y + 82);
      // parejas (y resultado si ya se jugó)
      const x = PAD + 230, anchoDer = f.resultado ? 190 : 0, anchoTxt = W - PAD - 24 - x - anchoDer;
      const meta = [f.categoria, f.etiqueta && !/^Z\d+$/.test(f.etiqueta) ? f.etiqueta : ""].filter(Boolean).join(" · ");
      if (meta) { ctx.fillStyle = pal.acento; ctx.font = "600 21px 'DM Sans', sans-serif"; ctx.fillText(ajustar(ctx, meta.toUpperCase(), anchoTxt), x, y + 26); }
      const y1 = meta ? y + 54 : y + 42, y2 = meta ? y + 84 : y + 78;
      ctx.fillStyle = pal.texto; ctx.font = "600 31px 'DM Sans', sans-serif"; ctx.fillText(ajustar(ctx, f.pareja1, anchoTxt), x, y1);
      ctx.fillStyle = tenue; ctx.font = "500 24px 'DM Sans', sans-serif"; ctx.fillText("vs", x, y2);
      const vs = ctx.measureText("vs ").width;
      ctx.fillStyle = pal.texto; ctx.font = "600 31px 'DM Sans', sans-serif"; ctx.fillText(ajustar(ctx, f.pareja2, anchoTxt - vs), x + vs, y2);
      if (f.resultado) { ctx.fillStyle = pal.acento; ctx.font = "700 30px Oswald, sans-serif"; ctx.textAlign = "right"; ctx.fillText(f.resultado, W - PAD - 24, y + h / 2 + 11); ctx.textAlign = "left"; }
      y += UNIDAD;
    }
  }
  // Pie
  ctx.textAlign = "center"; ctx.fillStyle = tenue; ctx.font = "500 26px 'DM Sans', sans-serif";
  const pie = [club.instagram, club.textoApoyo].filter(Boolean).join("  ·  ");
  if (pie) ctx.fillText(ajustar(ctx, pie, W - 2 * PAD - 120), W / 2, H - 56);
  if (total > 1) { ctx.textAlign = "right"; ctx.fillText(`${nro}/${total}`, W - PAD, H - 56); }
}

async function generarPaginas({ torneo, club, formato, lunes, categoriaId }) {
  const c = conDefectoClub(club), pal = paletaDelClub(c), largo = torneo?.calendario === "largo";
  const filas = partidosParaImagen(torneo, { lunes: largo ? lunes : null, categoriaId });
  const paginas = paginar(filas, formato);
  // Las fuentes de la app se cargan antes de dibujar (si no hay internet, usa las del sistema)
  try { await Promise.all(["700 74px Oswald", "600 38px Oswald", "500 30px 'DM Sans'", "600 31px 'DM Sans'", "700 30px 'DM Sans'"].map(f => document.fonts.load(f))); } catch (e) { /* sigue con fuentes del sistema */ }
  const logo = await cargarImagen(pal.logo);
  const { ancho, alto } = FORMATOS[formato];
  return paginas.map((pagina, i) => {
    const lienzo = document.createElement("canvas"); lienzo.width = ancho; lienzo.height = alto;
    dibujarPagina(lienzo.getContext("2d"), {
      formato, pagina, nro: i + 1, total: paginas.length, torneo, club: c, pal, logo, largo,
      etiqueta: largo ? "PARTIDOS DE LA SEMANA" : "CRONOGRAMA",
      subtitulo: largo ? rangoSemana(lunes) : (torneo.fecha ? formatearFecha(torneo.fecha) : ""),
    });
    return lienzo;
  });
}

const aArchivo = (lienzo, nombre) => new Promise(res => lienzo.toBlob(b => res(new File([b], nombre, { type: "image/png" })), "image/png"));
const slug = (t) => (t || "torneo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function ImagenSemanaModal({ torneo, club, onClose }) {
  const largo = torneo?.calendario === "largo";
  const [formato, setFormato] = useState("historia");
  const [categoriaId, setCategoriaId] = useState("");
  // Arranca en la semana actual; si no tiene partidos, en la del próximo partido programado
  const [lunes, setLunes] = useState(() => {
    const hoy = fechaHoyISO(), actual = lunesDeSemana(hoy);
    if (!largo || partidosParaImagen(torneo, { lunes: actual }).length) return actual;
    const proximas = (torneo?.categorias || []).flatMap(c => [...(c.partidos || []), ...(c.knockoutRounds || []).flat()])
      .map(m => m.fecha).filter(f => f && f >= hoy).sort();
    return proximas.length ? lunesDeSemana(proximas[0]) : actual;
  });
  const [vistas, setVistas] = useState(null); // data URLs para mostrar
  const [estado, setEstado] = useState("");
  const lienzos = useRef([]);
  useEffect(() => {
    let vigente = true; setVistas(null);
    generarPaginas({ torneo, club, formato, lunes, categoriaId: categoriaId || null }).then(ls => {
      if (!vigente) return; lienzos.current = ls; setVistas(ls.map(l => l.toDataURL("image/png")));
    });
    return () => { vigente = false; };
  }, [torneo, club, formato, lunes, categoriaId]);
  const nombres = () => lienzos.current.map((_, i) => `partidos-${slug(torneo.nombre)}-${largo ? lunes : "cronograma"}${lienzos.current.length > 1 ? `-${i + 1}de${lienzos.current.length}` : ""}.png`);
  const puedeCompartir = typeof navigator !== "undefined" && !!navigator.canShare;
  const compartir = async () => {
    const files = await Promise.all(lienzos.current.map((l, i) => aArchivo(l, nombres()[i])));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: torneo.nombre }); setEstado(""); }
      catch (e) { if (e.name !== "AbortError") setEstado("No se pudo compartir: " + e.message); }
    } else { setEstado("Este dispositivo no permite compartir imágenes: usá Descargar."); }
  };
  const descargar = async () => {
    const files = await Promise.all(lienzos.current.map((l, i) => aArchivo(l, nombres()[i])));
    files.forEach(f => { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  };
  const cats = (torneo?.categorias || []).filter(c => (c.partidos || []).length || (c.knockoutRounds || []).length);
  return (
    <div className="overlay" onClick={onClose}><div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto" }}>
      <div className="modal-title">Imagen de la semana</div>
      <div className="row wrap g8 mb12">
        {Object.entries(FORMATOS).map(([k, f]) => <button key={k} className={`btn btn-sm ${formato === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setFormato(k)}>{f.nombre}</button>)}
        <select className="inp" style={{ width: "auto", padding: "5px 10px" }} value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      {largo && <div className="row g8 mb12">
        <button className="btn btn-ghost btn-sm" onClick={() => setLunes(sumarDias(lunes, -7))}>‹</button>
        <span style={{ fontSize: 13, flex: 1, textAlign: "center" }}>Semana {rangoSemana(lunes).toLowerCase()}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setLunes(sumarDias(lunes, 7))}>›</button>
      </div>}
      {!vistas && <div className="empty" style={{ padding: 30 }}>Armando la imagen…</div>}
      {vistas && vistas.length === 0 && <div className="empty" style={{ padding: 30 }}>No hay partidos con horario {largo ? "en esta semana" : "en el cronograma"}.</div>}
      {vistas && vistas.length > 0 && <>
        {vistas.length > 1 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No entran en una sola imagen: se armaron {vistas.length}.</div>}
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
          {vistas.map((src, i) => <img key={i} src={src} alt={`Imagen ${i + 1}`} style={{ height: formato === "historia" ? 420 : 300, borderRadius: 10, border: "1px solid var(--border)", flexShrink: 0 }} />)}
        </div>
        <div className="row wrap g8">
          {puedeCompartir && <button className="btn btn-primary f1" onClick={compartir}>📤 Compartir</button>}
          <button className={`btn ${puedeCompartir ? "btn-secondary" : "btn-primary f1"}`} onClick={descargar}>⬇️ Descargar</button>
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
        {estado && <div style={{ fontSize: 12, color: "var(--gold)", marginTop: 8 }}>{estado}</div>}
      </>}
    </div></div>
  );
}
