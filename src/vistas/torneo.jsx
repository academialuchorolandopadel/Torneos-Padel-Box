// Pantallas de un torneo por zonas: inscripción, fixture, resultados,
// posiciones, llave final y agenda de canchas.
import React, { useState } from "react";
import { uid, COURTS, SLOT_DEFS, STAGE_PTS, STAGE_LABEL, AMERICANO_STAGE_PTS, CATEGORY_COLORS } from "../logica/constantes.js";
import { calcZoneDistribution } from "../logica/programacion.js";
import { calcStandings } from "../logica/resultados.js";
import { getRoundNames, calcPairStages } from "../logica/llave.js";

export function Inscripcion({ cat, onAdd, onDelete, onEditPair, onTogglePago, isAdmin, jugadoresGlobal }) {
  const empty={nombre:"",j1nombre:"",j1cedula:"",j2nombre:"",j2cedula:""};
  const [form,setForm]=useState(empty);const [showAdd,setShowAdd]=useState(true);
  if (!cat||!cat.parejas||!cat.grupos) return <div className="empty">Cargando datos de la categoria...</div>;
  const gName=Object.fromEntries(cat.grupos.map(g=>[g.id,g.nombre]));
  function handleAdd(){
    if(!form.nombre.trim()||!form.j1nombre.trim()||!form.j2nombre.trim())return;
    onAdd({id:uid(),nombre:form.nombre.trim(),j1nombre:form.j1nombre.trim(),j1cedula:form.j1cedula.trim(),j2nombre:form.j2nombre.trim(),j2cedula:form.j2cedula.trim(),j1:form.j1nombre.trim(),j2:form.j2nombre.trim(),grupoId:null,pagoJ1:false,pagoJ2:false,sinProblemas:true,restriccionesSlots:[],notasLibres:""});
    setForm(empty);
  }
  const s=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  // Autocompletar nombre desde la base de jugadores al ingresar la cedula
  const sCed=(cedKey,nomKey)=>e=>{
    const v=e.target.value;
    setForm(p=>{
      const n={...p,[cedKey]:v};
      const j=jugadoresGlobal?.[v.trim()];
      if(j&&!p[nomKey].trim())n[nomKey]=j.nombre;
      return n;
    });
  };
  const totalPagos=cat.parejas.reduce((acc,p)=>acc+(p.pagoJ1?1:0)+(p.pagoJ2?1:0),0);
  const formatSlots=(pair)=>{
    if(pair.sinProblemas!==false&&!pair.restriccionesSlots?.length)return <span className="restr-badge restr-ok">✓ Sin problemas</span>;
    const slots=pair.restriccionesSlots||[];if(!slots.length)return <span className="restr-badge restr-ok">✓ Sin problemas</span>;
    const byDay={};slots.forEach(s=>{const[dia,hora]=s.split("|");if(!byDay[dia])byDay[dia]=[];byDay[dia].push(hora);});
    return <div className="col" style={{gap:2}}>{Object.entries(byDay).map(([dia,horas])=><div key={dia} style={{fontSize:9,lineHeight:1.3}}>🚫 {dia.slice(0,3)} {horas.join(", ")}</div>)}{pair.notasLibres&&<div style={{fontSize:10,color:"var(--muted)"}}>{pair.notasLibres}</div>}</div>;
  };
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Inscripción</div>
        <div className="row g8 wrap">
          <div className="stat-box"><div className="stat-val">{cat.parejas.length}</div><div className="stat-lbl">Parejas</div></div>
          <div className="stat-box"><div className="stat-val">{cat.parejas.length*2}</div><div className="stat-lbl">Jugadores</div></div>
          <div className="stat-box"><div className="stat-val" style={{color:"var(--gold)"}}>{totalPagos}/{cat.parejas.length*2}</div><div className="stat-lbl">Pagos</div></div>
        </div>
      </div>
      {cat.fixtureGenerado&&<div className="alert alert-warn">⚠️ Fixture generado. Nuevas parejas se asignan a la zona con menos integrantes.</div>}
      {showAdd?(
        <div className="card mb16">
          <div className="row just-between mb12"><div className="card-title" style={{margin:0}}>Agregar Pareja</div>{cat.fixtureGenerado&&<button className="icon-btn" onClick={()=>setShowAdd(false)} disabled={!isAdmin}>✕</button>}</div>
          <div className="col f1 mb12"><label className="lbl">Nombre pareja</label><input className="inp" placeholder="González / Martínez" value={form.nombre} onChange={s("nombre")}/></div>
          <div className="grid2 mb12">
            <div className="col"><label className="lbl">J1 — Nombre</label><input className="inp" value={form.j1nombre} onChange={s("j1nombre")}/></div>
            <div className="col"><label className="lbl">J1 — Cédula</label><input className="inp" value={form.j1cedula} onChange={sCed("j1cedula","j1nombre")} placeholder="1234567"/></div>
            <div className="col"><label className="lbl">J2 — Nombre</label><input className="inp" value={form.j2nombre} onChange={s("j2nombre")}/></div>
            <div className="col"><label className="lbl">J2 — Cédula</label><input className="inp" value={form.j2cedula} onChange={sCed("j2cedula","j2nombre")} placeholder="7654321" onKeyDown={e=>e.key==="Enter"&&handleAdd()}/></div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>+ Agregar pareja</button>
        </div>
      ):(
        <div className="row mb16"><button className="btn btn-secondary" onClick={()=>setShowAdd(true)} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>+ Agregar pareja al fixture</button></div>
      )}
      {cat.parejas.length===0?<div className="empty"><div className="empty-ico">👥</div><p>No hay parejas inscriptas aún</p></div>:(
        <div className="card" style={{overflowX:"auto"}}>
          <table className="tbl">
            <thead><tr><th>#</th><th>Pareja</th><th>J1</th><th>CI</th><th>Pago J1</th><th>J2</th><th>CI</th><th>Pago J2</th><th>Horarios</th><th>Zona</th><th></th></tr></thead>
            <tbody>
              {cat.parejas.map((p,i)=>(
                <tr key={p.id}>
                  <td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--muted)",fontSize:13}}>{i+1}</td>
                  <td className="em">{p.nombre}</td><td>{p.j1nombre||p.j1}</td>
                  <td style={{fontSize:11,color:"var(--muted)"}}>{p.j1cedula||"—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ1?"pago-ok":"pago-no"}`} onClick={()=>onTogglePago(p.id,"pagoJ1")} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>{p.pagoJ1?"✓ Pagado":"✗ Pendiente"}</button></td>
                  <td>{p.j2nombre||p.j2}</td>
                  <td style={{fontSize:11,color:"var(--muted)"}}>{p.j2cedula||"—"}</td>
                  <td><button className={`pago-pill ${p.pagoJ2?"pago-ok":"pago-no"}`} onClick={()=>onTogglePago(p.id,"pagoJ2")} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>{p.pagoJ2?"✓ Pagado":"✗ Pendiente"}</button></td>
                  <td>{formatSlots(p)}</td>
                  <td>{p.grupoId?<span className="badge bg">{gName[p.grupoId]||"?"}</span>:<span className="badge bx">—</span>}</td>
                  <td><div className="row g8">
                    <button className="btn btn-secondary btn-xs" onClick={()=>onEditPair(p)} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>✏️</button>
                    {!cat.fixtureGenerado&&<button className="btn btn-danger btn-xs" onClick={()=>onDelete(p.id)} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>✕</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Fixture({ cat, onGenerate, isAdmin, onEditMatch }) {
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  if (!cat.fixtureGenerado) return (
    <div><div className="sec-hdr"><div className="sec-title">Fixture</div></div>
      <div className="card" style={{textAlign:"center",padding:48}}>
        <div className="empty-ico">📅</div>
        <p className="mb16" style={{color:"var(--muted)"}}>{cat.parejas.length<3?`Necesitás al menos 3 parejas (tenés ${cat.parejas.length})`:`${cat.parejas.length} parejas · Zonas: ${calcZoneDistribution(cat.parejas.length).zonasDe3} de 3, ${calcZoneDistribution(cat.parejas.length).zonasDe4} de 4`}</p>
        {cat.parejas.length>=3&&<button className="btn btn-primary" onClick={onGenerate} disabled={!isAdmin} style={{opacity:isAdmin?1:0.4,cursor:isAdmin?'pointer':'not-allowed'}}>⚡ Generar Fixture</button>}
      </div>
    </div>
  );
  const byCourt=Object.fromEntries(COURTS.map(c=>[c,[]]));
  cat.partidos.forEach(m=>{if(byCourt[m.cancha])byCourt[m.cancha].push(m);});
  const conflictos=cat.partidos.filter(m=>m.conflict).length;
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Fixture</div>
        <div className="row g8 wrap">
          <span className="badge bg">{cat.grupos.length} Zonas</span>
          <span className="badge bb">{cat.partidos.length} Partidos</span>
          <span className="badge by">{cat.partidos.filter(m=>m.done).length} Completados</span>
          {conflictos>0&&<span className="badge by">⚠️ {conflictos} advertencias</span>}
        </div>
      </div>
      {conflictos>0&&<div className="alert alert-warn">⚠️ Algunos partidos tienen conflictos de descanso (⚠️) o restricción (🚫). Se resolvieron lo mejor posible.</div>}
      <div className="grid3 mb16">
        {cat.grupos.map(g=>{
          const gp=cat.parejas.filter(p=>p.grupoId===g.id);
          const gm=cat.partidos.filter(m=>m.grupoId===g.id);
          const isZona4=gm.some(m=>m.zona4);
          return (
            <div key={g.id} className="card" style={{margin:0}}>
              <div className="card-title">{g.nombre}</div>
              {gp.map((p,i)=>(
                <div key={p.id} className="row g8" style={{padding:"6px 0",borderBottom:i<gp.length-1?"1px solid var(--border)":"none"}}>
                  <span style={{fontFamily:"Oswald",fontWeight:700,color:"var(--muted)",fontSize:12,minWidth:16}}>{i+1}</span>
                  <div><div style={{fontSize:13,color:"var(--text)"}}>{p.nombre}</div>{p.restriccionesSlots?.length>0&&<span style={{fontSize:10,color:"var(--danger)"}}>🚫 {p.restriccionesSlots.length} restricción{p.restriccionesSlots.length>1?"es":""}</span>}</div>
                </div>
              ))}
              {isZona4&&<div style={{marginTop:12}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Partidos (mini‑playoff):</div>
                {gm.map(m=>{const tipo=m.zona4Tipo;const p1=m.p1id?byId[m.p1id]?.nombre:"Por definir";const p2=m.p2id?byId[m.p2id]?.nombre:"Por definir";const dep=(tipo==="C"||tipo==="D")?" (depende de A y B)":"";return <div key={m.id} style={{fontSize:11,marginBottom:4}}><span style={{fontWeight:700,color:"var(--accent)"}}>{tipo}:</span> {p1} vs {p2}{dep}</div>;})}
              </div>}
            </div>
          );
        })}
      </div>
      {!cat.modalidad?.startsWith("americano")&&<div className="card"><div className="card-title">Cronograma por Cancha</div>
        <div className="sched-grid">
          {COURTS.map(court=>(
            <div key={court}>
              <div className="court-hdr">{court}</div>
              <div className="court-body">
                {byCourt[court].length===0&&<div style={{padding:16,textAlign:"center",color:"var(--muted)",fontSize:12}}>Sin partidos</div>}
                {byCourt[court].map(m=>(
                  <div key={m.id} className="court-slot">
                    <div><div className="slot-day">{m.dia}</div><div className="slot-time">{m.hora}</div><div className="slot-match">{byId[m.p1id]?.nombre||"?"} vs {byId[m.p2id]?.nombre||"?"}</div></div>
                    <div className="col" style={{alignItems:"flex-end",gap:4}}>
                      <div className="row g8"><span className="slot-code">{m.code}</span>{isAdmin&&<button className="btn btn-ghost btn-xs" onClick={()=>onEditMatch(m)}>⚙️</button>}</div>
                      {m.done&&<span style={{fontSize:9,color:"var(--accent)"}}>✓</span>}
                      {m.conflict&&!m.restrictionConflict&&<span className="ctag">⚠️ Descanso</span>}
                      {m.restrictionConflict&&<span className="ctag ctag-r">🚫 Restricción</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

export function Resultados({ cat, onOpen, isAdmin, onEditMatch }) {
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  if (!cat.fixtureGenerado) return <div className="empty"><div className="empty-ico">⚡</div><p>Generá el fixture primero</p></div>;
  if (!cat.partidos||cat.partidos.length===0) return <div className="empty"><div className="empty-ico">📋</div><p>No hay partidos cargados.</p></div>;
  const isPendiente=m=>m.zona4&&(m.zona4Tipo==="C"||m.zona4Tipo==="D")&&(!m.p1id||!m.p2id);
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Resultados</div><span className="badge bg">{cat.partidos.filter(m=>m.done).length}/{cat.partidos.length} completados</span></div>
      {cat.grupos.map(g=>{
        const gm=cat.partidos.filter(m=>m.grupoId===g.id);
        if (!gm.length) return null;
        return (
          <div key={g.id} className="card">
            <div className="card-title">{g.nombre}</div>
            <table className="tbl">
              <thead><tr><th>Cód</th><th>Pareja 1</th><th>Resultado</th><th>Pareja 2</th>{!cat.modalidad?.startsWith("americano")&&<th>Horario</th>}{isAdmin&&<th></th>}{isAdmin&&<th></th>}</tr></thead>
              <tbody>
                {gm.map(m=>{
                  const p1=m.p1id?byId[m.p1id]:null,p2=m.p2id?byId[m.p2id]:null;
                  const pend=isPendiente(m),w=m.done?(m.winner===m.p1id?1:2):null;
                  return (
                    <tr key={m.id}>
                      <td><span className="slot-code">{m.code}</span></td>
                      <td className={w===1?"em":""} style={w===1?{color:"var(--accent)",fontWeight:700}:{}}>{pend?"Por definir":(p1?.nombre||"?")}</td>
                      <td>{m.done?<span><span className="res-set">{m.s1p1}-{m.s1p2}</span><span className="res-set">{m.s2p1}-{m.s2p2}</span>{m.tbp1!==""&&m.tbp2!==""&&<span className="res-set" style={{color:"var(--gold)"}}>TB:{m.tbp1}-{m.tbp2}</span>}</span>:<span style={{color:"var(--muted)",fontSize:12}}>Pendiente</span>}</td>
                      <td className={w===2?"em":""} style={w===2?{color:"var(--accent)",fontWeight:700}:{}}>{pend?"Por definir":(p2?.nombre||"?")}</td>
                      {!cat.modalidad?.startsWith("americano")&&<td style={{fontSize:11,color:"var(--muted)"}}>{m.dia} {m.hora} · {m.cancha}</td>}
                      {isAdmin&&<td><button className="btn btn-ghost btn-xs" onClick={()=>onEditMatch(m)}>⚙️</button></td>}
                      {isAdmin&&<td><button className="btn btn-secondary btn-sm" onClick={()=>onOpen(m)} disabled={pend} style={{cursor:pend?'not-allowed':'pointer'}}>{m.done?"✏️":(pend?"⏳":"+ Resultado")}</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function Posiciones({ cat }) {
  if (!cat.fixtureGenerado) return <div className="empty"><div className="empty-ico">📊</div><p>Generá el fixture para ver las posiciones</p></div>;
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  const MiniBracket=({groupId})=>{
    const gm=cat.partidos.filter(m=>m.grupoId===groupId&&m.zona4);
    const mA=gm.find(m=>m.zona4Tipo==="A"),mB=gm.find(m=>m.zona4Tipo==="B"),mC=gm.find(m=>m.zona4Tipo==="C"),mD=gm.find(m=>m.zona4Tipo==="D");
    const renderTeam=(match,isP1)=>{const pid=isP1?match?.p1id:match?.p2id;const name=pid?byId[pid]?.nombre:"Por definir";const score=match?.done?(isP1?`${match.s1p1} ${match.s2p1}`:`${match.s1p2} ${match.s2p2}`):null;return <div className={`mini-team ${!pid?"tbd":""}`}><span>{name}</span>{score&&<span className="br-score">{score}</span>}</div>;};
    return <div className="mini-bracket">
      <div className="mini-match"><div className="mini-match-header">A (Ronda 1)</div>{renderTeam(mA,true)}{renderTeam(mA,false)}</div>
      <div className="mini-match"><div className="mini-match-header">B (Ronda 1)</div>{renderTeam(mB,true)}{renderTeam(mB,false)}</div>
      <div className="mini-match"><div className="mini-match-header">C (1° y 2° puesto)</div>{mC?.done?<>{renderTeam(mC,true)}{renderTeam(mC,false)}</>:<div className="mini-team tbd">Pendiente de A y B</div>}</div>
      <div className="mini-match"><div className="mini-match-header">D (3° y 4° puesto)</div>{mD?.done?<>{renderTeam(mD,true)}{renderTeam(mD,false)}</>:<div className="mini-team tbd">Pendiente de A y B</div>}</div>
    </div>;
  };
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Posiciones</div></div>
      <div className="grid2">
        {cat.grupos.map(g=>{
          const ids=cat.parejas.filter(p=>p.grupoId===g.id).map(p=>p.id);
          const st=calcStandings(ids,cat.parejas,cat.partidos.filter(m=>m.grupoId===g.id),cat.modalidad==="americano_zonas");
          const isZona4=cat.partidos.some(m=>m.grupoId===g.id&&m.zona4);
          return (
            <div key={g.id} className="card" style={{margin:0}}>
              <div className="card-title">{g.nombre}</div>
              {isZona4&&<MiniBracket groupId={g.id}/>}
              <table className="tbl">
                <thead><tr><th>Pos</th><th>Pareja</th><th>PJ</th><th>G</th><th>P</th><th>S+</th><th>S-</th><th>G+</th><th>G-</th><th>Pts</th></tr></thead>
                <tbody>
                  {st.map((s,i)=>(
                    <tr key={s.id} style={i<2?{background:"rgba(61,255,160,.03)"}:{}}>
                      <td><span className={i===0?"pos-g":i===1?"pos-s":"pos-b"} style={{fontFamily:"Oswald",fontWeight:700,fontSize:15}}>{i+1}</span>{i<2&&<span className="classif">✓</span>}</td>
                      <td className="em" style={{fontSize:12}}>{s.pair?.nombre}</td>
                      <td>{s.pj}</td><td style={{color:"var(--accent)",fontWeight:600}}>{s.g}</td><td style={{color:"var(--danger)"}}>{s.per}</td>
                      <td>{s.sg}</td><td>{s.sp}</td><td>{s.gg}</td><td>{s.gp}</td>
                      <td style={{fontFamily:"Oswald",fontWeight:700,fontSize:16,color:"var(--gold)"}}>{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LlaveFinal({ cat, allMatches, onGenerarLlave, onOpen, onAwardPoints, pointsAwarded, isAdmin, onEditMatch, onEditKOPair }) {
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  const zonaStatus=cat.fixtureGenerado?cat.grupos.map(g=>{
    const partidos=cat.partidos.filter(m=>m.grupoId===g.id&&m.p1id&&m.p2id);
    const done=partidos.filter(m=>m.done).length;
    return {nombre:g.nombre,done,total:partidos.length,completa:partidos.length>0&&done===partidos.length};
  }):[];
  const todasCompletas=zonaStatus.length>0&&zonaStatus.every(z=>z.completa);
  const puedeGenerar=cat.fixtureGenerado&&cat.grupos.length>0;
  const roundNames=getRoundNames(cat.knockoutRounds);
  // Los horarios ya vienen calculados y guardados en cat.knockoutRounds
  const knockoutRoundsWithSchedules=cat.knockoutRounds||[];
  const koFlat=knockoutRoundsWithSchedules.flat();
  const koDone=koFlat.filter(m=>m.done&&!m.auto).length;
  const koTotal=koFlat.filter(m=>!m.auto).length;
  const stages=calcPairStages(cat);
  const campeon=cat.parejas.find(p=>stages[p.id]==="campeon");
  const isAmericano=cat.modalidad==="americano_zonas";
  let arrastrePodium=null;
  if(isAmericano&&(cat.knockoutRounds||[]).length>=2){
    const rds=cat.knockoutRounds;
    const finalM=rds[rds.length-1]?.[0];
    if(finalM?.done&&finalM.winner){
      const champ=finalM.winner;
      const sub=champ===finalM.p1id?finalM.p2id:finalM.p1id;
      let pos3=null,pos4=null;
      (rds[rds.length-2]||[]).forEach(sm=>{
        if(!sm.done||!sm.winner)return;
        const loser=sm.winner===sm.p1id?sm.p2id:sm.p1id;
        if(sm.winner===champ)pos3=loser;else if(sm.winner===sub)pos4=loser;
      });
      arrastrePodium={champ,sub,pos3,pos4};
    }
  }
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Llave Final{isAmericano&&<span className="badge bg" style={{marginLeft:6,fontSize:10,verticalAlign:"middle"}}>🎯 Americano</span>}</div>
        <div className="row g8 wrap">
          {cat.knockoutGenerated&&<span className="badge bb">{koDone}/{koTotal}</span>}
          {isAdmin&&koDone===koTotal&&koTotal>0&&<button className="btn btn-cyan btn-sm" onClick={onAwardPoints}>{pointsAwarded?"🔄 Actualizar puntos":"🏅 Otorgar puntos"}</button>}
          {pointsAwarded&&<span className="badge bg">✓ Puntos otorgados</span>}
          {isAdmin&&<button className={`btn btn-sm ${puedeGenerar?"btn-primary":"btn-secondary"}`} onClick={onGenerarLlave} disabled={!puedeGenerar} title={puedeGenerar?"Generar llave":"Generá el fixture primero"} style={{opacity:puedeGenerar?1:0.4,cursor:puedeGenerar?'pointer':'not-allowed'}}>{cat.knockoutGenerated?(todasCompletas?"🔄 Regenerar Llave":"🔄 Actualizar Llave"):(todasCompletas?"🏆 Generar Llave Final":"⚡ Llave Provisional")}</button>}
        </div>
      </div>
      {cat.fixtureGenerado&&(
        <div className="card mb16">
          <div className="card-title" style={{marginBottom:10}}>Estado de Zonas</div>
          <div style={{display:"flex",flexWrap:"wrap"}}>
            {zonaStatus.map(z=><span key={z.nombre} className={`zona-pill ${z.completa?"done":"pending"}`}>{z.completa?"✅":"⏳"} {z.nombre} — {z.done}/{z.total}</span>)}
          </div>
          {todasCompletas&&<div className="alert" style={{marginTop:12,marginBottom:0,background:"rgba(61,255,160,.06)",border:"1px solid rgba(61,255,160,.2)",color:"var(--accent)"}}>✓ Zonas completadas. La llave es definitiva.</div>}
          {!todasCompletas&&cat.knockoutGenerated&&<div className="alert alert-warn" style={{marginTop:12,marginBottom:0}}>⚡ Llave provisional — se actualiza automáticamente al completar cada zona.</div>}
          {!todasCompletas&&!cat.knockoutGenerated&&(isAdmin?<div className="alert" style={{marginTop:12,marginBottom:0,background:"rgba(0,212,255,.05)",border:"1px solid rgba(0,212,255,.2)",color:"var(--accent2)"}}>💡 Podés generar una llave provisional para planificar los horarios.</div>:<div className="alert" style={{marginTop:12,marginBottom:0,background:"rgba(0,212,255,.05)",border:"1px solid rgba(0,212,255,.2)",color:"var(--accent2)"}}>⏳ La llave final se publicará al completar todas las zonas.</div>)}
        </div>
      )}
      {campeon&&(
        <div className="card mb16" style={{background:"rgba(255,203,71,.06)",borderColor:"rgba(255,203,71,.3)",textAlign:"center",padding:28}}>
          <div style={{fontSize:32}}>🏆</div>
          <div style={{fontFamily:"Oswald",fontSize:24,fontWeight:700,color:"var(--gold)",letterSpacing:2,textTransform:"uppercase"}}>CAMPEÓN</div>
          <div style={{fontSize:18,color:"var(--text)",fontWeight:600,marginTop:6}}>{campeon.nombre}</div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{campeon.j1nombre||campeon.j1} · {campeon.j2nombre||campeon.j2}</div>
        </div>
      )}
      {cat.knockoutGenerated&&knockoutRoundsWithSchedules.length>0&&(
        <div className="card mb16">
          <div className="bracket-wrap"><div className="bracket">
            {knockoutRoundsWithSchedules.map((round,ri)=>(
              <div key={ri} className="br-round">
                <div className="br-round-hdr">{roundNames[ri]||`Ronda ${ri+1}`}</div>
                <div className="br-matches">
                  {round.map(m=>{
                    const p1=m.p1id?byId[m.p1id]:null,p2=m.p2id?byId[m.p2id]:null;
                    const canPlay=m.p1id&&m.p2id&&!m.auto&&isAdmin;
                    return (
                      <div key={m.id} className={`br-match${m.done?" done":""}`} onClick={()=>canPlay&&onOpen(m)} style={{cursor:canPlay?'pointer':'default',opacity:m.auto?0.5:1}}>
                        <div className={`br-team${!p1?" tbd":m.done&&m.winner===m.p1id?" win":""}`}>
                          <span style={{display:"flex",flexDirection:"column",gap:1,flex:1}}>
                            <span style={{display:"flex",alignItems:"center",gap:4}}>{p1?p1.nombre:m.p1label||"TBD"}{m.p1provisorio&&!m.done&&<span style={{fontSize:8,color:"var(--gold)",fontWeight:700,padding:"1px 4px",background:"rgba(255,203,71,.15)",borderRadius:3,flexShrink:0}}>PROV</span>}</span>
                            {p1&&m.p1label&&<span style={{fontSize:9,color:"var(--muted)",letterSpacing:.5}}>{m.p1label}</span>}
                          </span>
                          {m.done&&!m.auto&&<span className="br-score">{isAmericano?m.s1p1:m.s1p1+" "+m.s2p1+(m.s3p1!=null&&m.s3p1!==""?" "+m.s3p1:"")}</span>}
                        </div>
                        <div className={`br-team${!p2?" tbd":m.done&&m.winner===m.p2id?" win":""}`}>
                          <span style={{display:"flex",flexDirection:"column",gap:1,flex:1}}>
                            <span style={{display:"flex",alignItems:"center",gap:4}}>{p2?p2.nombre:m.p2label||"TBD"}{m.p2provisorio&&!m.done&&<span style={{fontSize:8,color:"var(--gold)",fontWeight:700,padding:"1px 4px",background:"rgba(255,203,71,.15)",borderRadius:3,flexShrink:0}}>PROV</span>}</span>
                            {p2&&m.p2label&&<span style={{fontSize:9,color:"var(--muted)",letterSpacing:.5}}>{m.p2label}</span>}
                          </span>
                          {m.done&&!m.auto&&<span className="br-score">{isAmericano?m.s1p2:m.s1p2+" "+m.s2p2+(m.s3p2!=null&&m.s3p2!==""?" "+m.s3p2:"")}</span>}
                        </div>
                        {m.dia&&m.hora&&m.cancha&&!m.auto&&<div className="br-schedule">{m.dia} {m.hora} · {m.cancha}{isAdmin&&<button className="btn btn-ghost btn-xs" style={{marginLeft:8}} onClick={e=>{e.stopPropagation();onEditMatch(m);}}>⚙️</button>}{isAdmin&&!m.done&&<button className="btn btn-ghost btn-xs" style={{marginLeft:4}} onClick={e=>{e.stopPropagation();onEditKOPair&&onEditKOPair(m);}}>👥</button>}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div></div>
        </div>
      )}
      <div className="card">
        <div className="card-title">Posiciones Finales</div>
        {isAmericano&&arrastrePodium&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Podio — posiciones por arrastre</div>
            <table className="tbl"><tbody>
              {[{pos:"🥇 1º",pts:30,pid:arrastrePodium.champ},{pos:"🥈 2º",pts:20,pid:arrastrePodium.sub},{pos:"🥉 3º",pts:15,pid:arrastrePodium.pos3,note:true},{pos:"4º",pts:15,pid:arrastrePodium.pos4,note:true}].map(({pos,pts,pid,note})=>{
                const p=byId[pid];if(!p)return null;
                return <tr key={pid}><td><span style={{fontFamily:"Oswald",fontWeight:700,fontSize:13}}>{pos}</span>{note&&<span style={{fontSize:9,color:"var(--muted)",marginLeft:4}}>arrastre</span>}</td><td className="em">{p.nombre}</td><td style={{fontSize:11,color:"var(--muted)"}}>{p.j1nombre||p.j1} · {p.j2nombre||p.j2}</td><td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--gold)",fontSize:16}}>{pts}</td></tr>;
              })}
            </tbody></table>
            <div className="divider" style={{margin:"12px 0"}}/>
          </div>
        )}
        <table className="tbl">
          <thead><tr><th>Etapa</th><th>Pareja</th><th>Jugadores</th><th>Pts</th></tr></thead>
          <tbody>
            {Object.entries(stages).sort((a,b)=>{const m=isAmericano?AMERICANO_STAGE_PTS:STAGE_PTS;return (m[b[1]]||0)-(m[a[1]]||0);}).map(([pid,stage])=>{
              const p=byId[pid];if(!p)return null;
              const pts=isAmericano?(AMERICANO_STAGE_PTS[stage]||5):STAGE_PTS[stage];
              return <tr key={pid}><td><span className="badge bg">{STAGE_LABEL[stage]}</span></td><td className="em">{p.nombre}</td><td style={{fontSize:11,color:"var(--muted)"}}>{p.j1nombre||p.j1} · {p.j2nombre||p.j2}</td><td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--gold)",fontSize:16}}>{pts}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AgendaView({ torneo, allPartidos, isAdmin, onEditMatch, onToggleBloqueo }) {
  const byId=Object.fromEntries((torneo?.categorias||[]).flatMap(c=>c.parejas||[]).map(p=>[p.id,p]));
  const matchCatMap={};const catColorMap={};
  (torneo?.categorias||[]).forEach((c,i)=>{
    const color=CATEGORY_COLORS[i%CATEGORY_COLORS.length];catColorMap[c.id]=color;
    (c.partidos||[]).forEach(m=>{matchCatMap[m.id]=c.id;});
    (c.knockoutRounds||[]).flat().forEach(m=>{matchCatMap[m.id]=c.id;});
  });
  const slotsBoqueados=new Set(torneo?.slotsBoqueados||[]);
  const days=[...new Set(SLOT_DEFS.map(s=>s.dia))];
  const ppd={};
  days.forEach(dia=>{ppd[dia]={};COURTS.forEach(c=>{ppd[dia][c]=[];});});
  allPartidos.forEach(m=>{if(m.dia&&m.dia!=="?"&&ppd[m.dia]&&ppd[m.dia][m.cancha])ppd[m.dia][m.cancha].push(m);});
  days.forEach(dia=>COURTS.forEach(c=>ppd[dia][c].sort((a,b)=>(a.mins||0)-(b.mins||0))));
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Agenda</div><span className="badge bb">Vista diaria</span></div>
      <div className="card mb16">
        <div className="card-title" style={{marginBottom:10}}>Referencias</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {(torneo?.categorias||[]).map((c,i)=>{
            const color=CATEGORY_COLORS[i%CATEGORY_COLORS.length];
            return <span key={c.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:color.bg,border:`1px solid ${color.border}`,fontSize:12,fontWeight:600}}>{c.nombre}</span>;
          })}
          {slotsBoqueados.size>0&&<span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:"rgba(255,51,85,.12)",border:"1px solid rgba(255,51,85,.4)",fontSize:12,fontWeight:600}}>🚫 Bloqueado ({slotsBoqueados.size})</span>}
        </div>
        {isAdmin&&<div style={{fontSize:11,color:"var(--muted)",marginTop:8}}>💡 Clickeá un slot libre para bloquearlo o desbloquearlo</div>}
      </div>
      {days.map(dia=>{
        const slotsDia=SLOT_DEFS.filter(s=>s.dia===dia).sort((a,b)=>a.mins-b.mins);
        if (!slotsDia.length) return null;
        return (
          <div key={dia} className="card mb16">
            <div className="card-title">{dia}</div>
            <div className="sched-grid">
              {COURTS.map(cancha=>(
                <div key={cancha}>
                  <div className="court-hdr">{cancha}</div>
                  <div className="court-body">
                    {slotsDia.map(slot=>{
                      const key=`${dia}|${slot.hora}|${cancha}`;
                      const partido=(ppd[dia][cancha]||[]).find(m=>m.hora===slot.hora);
                      const catId=partido?matchCatMap[partido.id]:null;
                      const color=catId?catColorMap[catId]:null;
                      const bloqueado=slotsBoqueados.has(key);
                      return (
                        <div key={key} className="court-slot"
                          style={{
                            cursor:isAdmin?"pointer":"default",
                            background:bloqueado?"rgba(255,51,85,.08)":color?color.bg:"transparent",
                            borderLeft:bloqueado?"3px solid rgba(255,51,85,.5)":color?`3px solid ${color.border}`:"3px solid transparent",
                          }}
                          onClick={()=>{
                            if(!isAdmin)return;
                            if(partido){onEditMatch&&onEditMatch(partido);}
                            else{onToggleBloqueo&&onToggleBloqueo(key);}
                          }}>
                          {partido?(
                            <><div><div className="slot-day">{partido.dia}</div><div className="slot-time">{partido.hora}</div><div className="slot-match">{byId[partido.p1id]?.nombre||"?"} vs {byId[partido.p2id]?.nombre||"?"}</div></div>
                            <div className="col" style={{alignItems:"flex-end",gap:4}}><span className="slot-code">{partido.code}</span>{partido.done&&<span style={{fontSize:9,color:"var(--accent)"}}>✓</span>}</div></>
                          ):bloqueado?(
                            <><div><div className="slot-day">{dia}</div><div className="slot-time" style={{color:"var(--danger)"}}>{slot.hora}</div></div>
                            <span style={{fontSize:11,color:"var(--danger)",fontWeight:700}}>🚫 Bloqueado</span></>
                          ):(
                            <div style={{color:"var(--muted)",fontSize:12,padding:"4px 0",width:"100%"}}>{slot.hora} — Libre{isAdmin&&<span style={{float:"right",fontSize:10,opacity:.4}}>+ bloquear</span>}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
