// Puntos de ranking: una sola regla para todas las modalidades.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
//
// El proceso tiene dos pasos separados a propósito:
//   1. calcularAsignaciones: cuántos puntos gana cada jugador en esta categoría.
//      Es lo único que cambia según la modalidad.
//   2. aplicarPuntos: cómo esos puntos impactan en el ranking (historial,
//      defensa de edición, género y categoría automáticos). Igual para todas.
import { STAGE_PTS, AMERICANO_STAGE_PTS, AMERICANO_POS_PTS, AMERICANO_POS_STAGE, CAT_NUM } from "./constantes.js";
import { calcPairStages } from "./llave.js";
import { calcAmericanoIndStandings, calcAmericanoParejasStandings } from "./resultados.js";

// ---- Paso 1: qué gana cada jugador ----
// Devuelve [{cedula, nombre, stage, pts}] en el orden de la categoría.
export function calcularAsignaciones(cat){
  const out=[];
  const deLaPareja=(pair,stage,pts)=>{
    [pair.j1cedula,pair.j2cedula].forEach(cedula=>{
      if(!cedula)return;
      const nombre=cedula===pair.j1cedula?(pair.j1nombre||pair.j1):(pair.j2nombre||pair.j2);
      out.push({cedula,nombre,stage,pts});
    });
  };
  if(cat.modalidad==="americano_individual"){
    // Todos contra todos individual: puntos por posición final
    calcAmericanoIndStandings(cat).forEach((s,idx)=>{
      const pos=idx+1;
      out.push({cedula:s.cedula,nombre:s.nombre,stage:AMERICANO_POS_STAGE[pos]||"zona",pts:AMERICANO_POS_PTS[pos]||5});
    });
  }else if(cat.modalidad==="americano_pareja"){
    // Todos contra todos por parejas: puntos por posición final de la pareja
    calcAmericanoParejasStandings(cat).forEach((s,idx)=>{
      const pos=idx+1;
      const pair=cat.parejas.find(p=>p.id===s.id);if(!pair)return;
      deLaPareja(pair,AMERICANO_POS_STAGE[pos]||"zona",AMERICANO_POS_PTS[pos]||5);
    });
  }else{
    // Zonas + llave (estándar o americano por zonas): puntos por etapa alcanzada
    const esAmericano=cat.modalidad==="americano_zonas";
    const tabla=esAmericano?AMERICANO_STAGE_PTS:STAGE_PTS;
    const stages=calcPairStages(cat);
    cat.parejas.forEach(pair=>{
      const stage=stages[pair.id]||"zona";
      deLaPareja(pair,stage,tabla[stage]||(esAmericano?5:0));
    });
  }
  return out;
}

// ---- Paso 2: cómo impacta en el ranking ----
// Devuelve {jugadores, modificadas, ptsFallen} sin modificar lo recibido.
//  - jugadores: el ranking completo actualizado
//  - modificadas: cédulas que cambiaron (las únicas que hay que guardar)
//  - ptsFallen: cuántos jugadores perdieron puntos de la edición anterior por no jugar
export function aplicarPuntos({jugadores,asignaciones,torneo,cat,hoy}){
  const nxt={...jugadores};
  const modificadas=new Set();
  const edicion=torneo.edicion||"";
  // La fecha del historial es la del torneo (fija); si no tiene, la de hoy
  const fecha=torneo.fecha||hoy;
  // Género y categoría se deducen del nombre de la categoría ("6ta Damas")
  const catNombreLow=cat.nombre.toLowerCase();
  const derivedGenero=catNombreLow.includes("damas")?"F":catNombreLow.includes("caballeros")?"M":null;
  const catLabelMatch=cat.nombre.match(/^(\w+)/);
  const derivedCat=catLabelMatch?CAT_NUM[catLabelMatch[1].toLowerCase()]:null;
  // Entradas que la nueva reemplaza: la de esta misma categoría (si se
  // re-otorga) y la de la edición anterior del mismo torneo (defensa de puntos).
  // Se reemplazan TODAS por una sola: si hubiera más de una (por ejemplo, si la
  // edición se cargó después de otorgar), los puntos no se cuentan dos veces.
  const esReemplazable=(h)=>(h.torneoId===torneo.id&&h.catId===cat.id)||
    (edicion&&h.torneoEdicion===edicion&&h.catNombre===cat.nombre&&h.torneoId!==torneo.id);

  asignaciones.forEach(({cedula,nombre,stage,pts})=>{
    if(!nxt[cedula])nxt[cedula]={cedula,nombre,totalPts:0,historial:[]};
    const jug=nxt[cedula];
    const historial=jug.historial||[];
    const nuevaEntry={torneoId:torneo.id,catId:cat.id,torneoNombre:torneo.nombre,torneoEdicion:edicion,catNombre:cat.nombre,stage,pts,fecha};
    // La nueva entrada ocupa el lugar de la primera reemplazada (o va al final)
    let ptsPrevios=0,puesta=false;
    const nuevoHistorial=[];
    historial.forEach(h=>{
      if(!esReemplazable(h)){nuevoHistorial.push(h);return;}
      ptsPrevios+=h.pts||0;
      if(!puesta){nuevoHistorial.push(nuevaEntry);puesta=true;}
    });
    if(!puesta)nuevoHistorial.push(nuevaEntry);
    nxt[cedula]={...jug,
      nombre:nombre||jug.nombre,
      totalPts:jug.totalPts-ptsPrevios+pts,
      historial:nuevoHistorial};
    if(derivedGenero&&!nxt[cedula].genero)nxt[cedula]={...nxt[cedula],genero:derivedGenero};
    if(derivedCat&&!nxt[cedula].categoria)nxt[cedula]={...nxt[cedula],categoria:derivedCat};
    modificadas.add(cedula);
  });

  // Los puntos caen: quien tenía puntos de la edición anterior en esta
  // categoría y no jugó esta vez, los pierde.
  let ptsFallen=0;
  if(edicion){
    Object.values(nxt).forEach(jug=>{
      if(modificadas.has(jug.cedula))return;
      const prevIdx=(jug.historial||[]).findIndex(h=>h.torneoEdicion===edicion&&h.catNombre===cat.nombre&&h.torneoId!==torneo.id);
      if(prevIdx===-1)return;
      const prevPts=jug.historial[prevIdx].pts||0;
      nxt[jug.cedula]={...jug,totalPts:Math.max(0,jug.totalPts-prevPts),historial:jug.historial.filter((_,i)=>i!==prevIdx)};
      modificadas.add(jug.cedula);
      ptsFallen++;
    });
  }
  return {jugadores:nxt,modificadas:[...modificadas],ptsFallen};
}
