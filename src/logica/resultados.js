// Cálculo de ganadores, tablas de posiciones, clasificados y estadísticas.
// Funciones puras: reciben datos y devuelven datos. No tocan Firebase ni React.
import { n } from "./constantes.js";

// Criterio de orden de una tabla: puntos, luego diferencia de sets, luego
// diferencia de games. Única definición: la usan la tabla de cada zona, el
// desempate por enfrentamiento directo y la elección de los mejores terceros.
export function compararPosiciones(a,b){
  return b.pts-a.pts||(b.sg-b.sp)-(a.sg-a.sp)||(b.gg-b.gp)-(a.gg-a.gp);
}

// Sets y games de un partido de zona desde el punto de vista de cada pareja.
// Americano: un solo set (los games son los del set 1).
// Estándar: 2 sets + super tie-break si quedan 1-1 (los games no incluyen el TB).
export function contarSetsYGames(m,esAmericano=false){
  let sa=0,sb=0,ga,gb;
  if(esAmericano){
    ga=n(m.s1p1);gb=n(m.s1p2);
    if(ga>gb)sa++;else sb++;
  }else{
    if(n(m.s1p1)>n(m.s1p2))sa++;else sb++;
    if(n(m.s2p1)>n(m.s2p2))sa++;else sb++;
    if(sa===sb){if(n(m.tbp1)>n(m.tbp2))sa++;else sb++;}
    ga=n(m.s1p1)+n(m.s2p1);gb=n(m.s1p2)+n(m.s2p2);
  }
  return {sa,sb,ga,gb};
}

export function calcMatchResult(m, bestOf3=false, esAmericano=false) {
  if(esAmericano){if(n(m.s1p1)>n(m.s1p2))return m.p1id;if(n(m.s1p2)>n(m.s1p1))return m.p2id;return null;}
  let sa=0, sb=0;
  if (bestOf3) {
    // 3 sets: solo cuenta el set cuando hay un ganador claro
    if (n(m.s1p1)>n(m.s1p2)) sa++; else if (n(m.s1p2)>n(m.s1p1)) sb++;
    if (n(m.s2p1)>n(m.s2p2)) sa++; else if (n(m.s2p2)>n(m.s2p1)) sb++;
    if (n(m.s3p1)>n(m.s3p2)) sa++; else if (n(m.s3p2)>n(m.s3p1)) sb++;
  } else {
    // 2 sets + super tie-break (formato de zona y rondas tempranas)
    if (n(m.s1p1)>n(m.s1p2)) sa++; else sb++;
    if (n(m.s2p1)>n(m.s2p2)) sa++; else sb++;
    if (sa===sb) { if (n(m.tbp1)>n(m.tbp2)) sa++; else sb++; }
  }
  return sa>sb ? m.p1id : m.p2id;
}

// Desempate por enfrentamiento directo (head-to-head).
// Para grupos de 2: gana quien ganó el partido directo.
// Para grupos de 3+: sub-tabla usando solo los partidos entre empatados.
export function resolveH2H(sorted, doneBetween, esAmericano=false) {
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&compararPosiciones(sorted[i],sorted[j])===0)j++;
    if(j-i>1){
      const group=sorted.slice(i,j);
      const gIds=new Set(group.map(s=>s.id));
      const subMs=doneBetween.filter(m=>gIds.has(m.p1id)&&gIds.has(m.p2id));
      const sub={};group.forEach(s=>{sub[s.id]={pts:0,sg:0,sp:0,gg:0,gp:0};});
      subMs.forEach(m=>{
        const a=sub[m.p1id],b=sub[m.p2id];if(!a||!b)return;
        const {sa,sb,ga,gb}=contarSetsYGames(m,esAmericano);
        a.sg+=sa;a.sp+=sb;b.sg+=sb;b.sp+=sa;
        a.gg+=ga;a.gp+=gb;
        b.gg+=gb;b.gp+=ga;
        if(sa>sb)a.pts+=2;else b.pts+=2;
      });
      group.sort((a,b)=>compararPosiciones(sub[a.id],sub[b.id]));
      for(let k=0;k<group.length;k++)sorted[i+k]=group[k];
    }
    i=j;
  }
  return sorted;
}

export function calcStandings(pairIds, pairs, matches, esAmericano=false) {
  const byId = Object.fromEntries(pairs.map((p) => [p.id, p]));
  const s = {};
  pairIds.forEach((id) => (s[id] = { id, pts:0, pj:0, g:0, per:0, sg:0, sp:0, gg:0, gp:0 }));
  const anyZona4 = matches.some(m => m.zona4 && pairIds.includes(m.p1id) && pairIds.includes(m.p2id));
  const processMatch = (m) => {
    const a=s[m.p1id], b=s[m.p2id];
    if (!a||!b) return;
    const {sa,sb,ga,gb}=contarSetsYGames(m,esAmericano);
    a.pj++; b.pj++; a.sg+=sa; a.sp+=sb; b.sg+=sb; b.sp+=sa; a.gg+=ga; a.gp+=gb; b.gg+=gb; b.gp+=ga;
    if (sa>sb) { a.g++; a.pts+=2; b.per++; } else { b.g++; b.pts+=2; a.per++; }
  };
  if (anyZona4) {
    matches.filter(m=>m.done&&pairIds.includes(m.p1id)&&pairIds.includes(m.p2id)).forEach(processMatch);
    const matchC=matches.find(m=>m.zona4Tipo==="C"&&m.done);
    const matchD=matches.find(m=>m.zona4Tipo==="D"&&m.done);
    const order=[];
    if (matchC) { const w=calcMatchResult(matchC,false,esAmericano); const l=w===matchC.p1id?matchC.p2id:matchC.p1id; order[0]=w; order[1]=l; }
    if (matchD) { const w=calcMatchResult(matchD,false,esAmericano); const l=w===matchD.p1id?matchD.p2id:matchD.p1id; order[2]=w; order[3]=l; }
    const remaining=pairIds.filter(id=>!order.includes(id));
    for (let i=0;i<4;i++) { if (!order[i]&&remaining.length) order[i]=remaining.shift(); }
    return order.filter(id=>id!==undefined).map(id=>({...s[id],pair:byId[id]}));
  } else {
    const doneMs=matches.filter(m=>m.done&&pairIds.includes(m.p1id)&&pairIds.includes(m.p2id));
    doneMs.forEach(processMatch);
    const sorted=pairIds.map(id=>({...s[id],pair:byId[id]})).sort(compararPosiciones);
    return resolveH2H(sorted,doneMs,esAmericano);
  }
}

export function calcClassified(cat, allowPartial=false) {
  const zonaStatus = cat.grupos.map(g => {
    const partidos = cat.partidos.filter(m => m.grupoId===g.id && m.p1id && m.p2id);
    const done = partidos.filter(m=>m.done).length;
    return { grupo:g, total:partidos.length, done, completa: partidos.length>0 && done===partidos.length };
  });
  const todasCompletas = zonaStatus.length>0 && zonaStatus.every(z=>z.completa);
  const pendientes = zonaStatus.filter(z=>!z.completa).map(z=>z.grupo.nombre);
  if (!todasCompletas && !allowPartial) return { listo:false, pendientes, classified:[] };
  const primeros=[], segundos=[], terceros=[];
  cat.grupos.forEach(g => {
    const zonaCompleta=zonaStatus.find(z=>z.grupo.id===g.id)?.completa||false;
    const gIds = cat.parejas.filter(p=>p.grupoId===g.id).map(p=>p.id);
    if(!gIds.length)return;
    const st = calcStandings(gIds, cat.parejas, cat.partidos.filter(m=>m.grupoId===g.id), cat.modalidad==="americano_zonas");
    if (st[0]) primeros.push({...st[0], grupo:g.nombre, pos:1, provisorio:!zonaCompleta});
    if (st[1]) segundos.push({...st[1], grupo:g.nombre, pos:2, provisorio:!zonaCompleta});
    if (st[2]) terceros.push({...st[2], grupo:g.nombre, pos:3, provisorio:!zonaCompleta});
  });
  terceros.sort(compararPosiciones);
  let bracketSize=4;
  while (bracketSize < primeros.length+segundos.length) bracketSize*=2;
  const tercerosNeeded = Math.max(0, bracketSize-primeros.length-segundos.length);
  const tercerosClasificados = terceros.slice(0, tercerosNeeded);
  const classified = [
    ...primeros.map(s=>({pairId:s.id, grupo:s.grupo, pos:1, pts:s.pts, sg:s.sg, sp:s.sp, provisorio:s.provisorio})),
    ...segundos.map(s=>({pairId:s.id, grupo:s.grupo, pos:2, pts:s.pts, sg:s.sg, sp:s.sp, provisorio:s.provisorio})),
    ...tercerosClasificados.map(s=>({pairId:s.id, grupo:s.grupo, pos:3, pts:s.pts, sg:s.sg, sp:s.sp, provisorio:s.provisorio})),
  ];
  return { listo:todasCompletas, pendientes, classified, bracketSize, zonaStatus, provisorio:!todasCompletas };
}

export function calcPlayerStats(cedula,torneos){
  const matches=[];
  (torneos||[]).forEach(t=>{
    const fecha=t.fecha||"";
    (t.categorias||[]).forEach(c=>{
      if(c.modalidad==="americano_individual"){
        (c.americanoPartidos||[]).forEach(m=>{
          if(!m.done)return;
          const enA=m.j1a===cedula||m.j2a===cedula;
          const enB=m.j1b===cedula||m.j2b===cedula;
          if(!enA&&!enB)return;
          const gA=Number(m.juegosA)||0,gB=Number(m.juegosB)||0;
          if(gA===gB)return;
          matches.push({fecha,ord:m.ronda||0,win:enA?gA>gB:gB>gA});
        });
      }else if(c.modalidad==="americano_pareja"){
        const myPairs=(c.parejas||[]).filter(p=>p.j1cedula===cedula||p.j2cedula===cedula).map(p=>p.id);
        if(!myPairs.length)return;
        (c.americanoPartidos||[]).forEach(m=>{
          if(!m.done)return;
          const esP1=myPairs.includes(m.p1id),esP2=myPairs.includes(m.p2id);
          if(!esP1&&!esP2)return;
          const gA=Number(m.juegosA)||0,gB=Number(m.juegosB)||0;
          if(gA===gB)return;
          matches.push({fecha,ord:m.ronda||0,win:esP1?gA>gB:gB>gA});
        });
      }else{
        const myPairs=(c.parejas||[]).filter(p=>p.j1cedula===cedula||p.j2cedula===cedula).map(p=>p.id);
        if(!myPairs.length)return;
        const all=[...(c.partidos||[]),...((c.knockoutRounds||[]).flat())];
        all.forEach(m=>{
          if(!m.done||m.auto||!m.winner)return;
          if(!myPairs.includes(m.p1id)&&!myPairs.includes(m.p2id))return;
          matches.push({fecha,ord:m.mins||0,win:myPairs.includes(m.winner)});
        });
      }
    });
  });
  matches.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||a.ord-b.ord);
  const pj=matches.length,g=matches.filter(m=>m.win).length,per=pj-g;
  const pct=pj?Math.round(g*100/pj):0;
  let rachaActual=0;
  for(let i=matches.length-1;i>=0;i--){if(matches[i].win)rachaActual++;else break;}
  let best=0,cur=0;
  matches.forEach(m=>{if(m.win){cur++;if(cur>best)best=cur;}else cur=0;});
  return {pj,g,per,pct,rachaActual,mejorRacha:best};
}

export function calcAmericanoIndStandings(cat){
  const jugList=cat.jugadoresAmericano||[];
  const partidos=cat.americanoPartidos||[];
  const stats=Object.fromEntries(jugList.map(j=>[j.cedula,{cedula:j.cedula,nombre:j.nombre,ganados:0,perdidos:0}]));
  partidos.forEach(m=>{
    if(!m.done)return;
    const gA=Number(m.juegosA)||0,gB=Number(m.juegosB)||0;
    [m.j1a,m.j2a].forEach(c=>{if(stats[c]){stats[c].ganados+=gA;stats[c].perdidos+=gB;}});
    [m.j1b,m.j2b].forEach(c=>{if(stats[c]){stats[c].ganados+=gB;stats[c].perdidos+=gA;}});
  });
  return Object.values(stats).sort((a,b)=>{
    if(b.ganados!==a.ganados)return b.ganados-a.ganados;
    const da=a.ganados-a.perdidos,db=b.ganados-b.perdidos;
    if(db!==da)return db-da;
    return a.nombre.localeCompare(b.nombre);
  });
}

export function calcAmericanoParejasStandings(cat){
  const partidos=cat.americanoPartidos||[];
  const stats=Object.fromEntries(cat.parejas.map(p=>[p.id,{id:p.id,nombre:p.nombre,ganados:0,perdidos:0}]));
  partidos.forEach(m=>{
    if(!m.done)return;
    const gA=Number(m.juegosA)||0,gB=Number(m.juegosB)||0;
    if(stats[m.p1id]){stats[m.p1id].ganados+=gA;stats[m.p1id].perdidos+=gB;}
    if(stats[m.p2id]){stats[m.p2id].ganados+=gB;stats[m.p2id].perdidos+=gA;}
  });
  return Object.values(stats).sort((a,b)=>{
    if(b.ganados!==a.ganados)return b.ganados-a.ganados;
    const da=a.ganados-a.perdidos,db=b.ganados-b.perdidos;
    if(db!==da)return db-da;
    return a.nombre.localeCompare(b.nombre);
  });
}
