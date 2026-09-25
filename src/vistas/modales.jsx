// Ventanas emergentes: login, cargar resultado, editar pareja/partido/cruce.
import React, { useState, useEffect } from "react";
import { COURTS, n, MIN_GAP, MIN_GAP_KO_SAME_DAY, MIN_GAP_KO_DIFF_DAY, SLOT_DEFS } from "../logica/constantes.js";

export function PinModal({ onSuccess, onClose }) {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const handleSubmit=async()=>{
    if(!email.trim()||!pass||busy)return;
    setBusy(true);setError("");
    try{
      await window.firebaseAuth.signInWithEmailAndPassword(window.auth,email.trim(),pass);
      onSuccess();
    }catch(err){
      console.error(err);
      setError(err.code==="auth/too-many-requests"?"Demasiados intentos. Espera unos minutos.":"Email o contrasena incorrectos");
    }finally{setBusy(false);}
  };
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Acceso Administrador</div>
      <div className="col mb12"><label className="lbl">Email</label>
        <input className="inp" type="email" autoComplete="username" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} autoFocus />
      </div>
      <div className="col mb12"><label className="lbl">Contrasena</label>
        <input className="inp" type="password" autoComplete="current-password" value={pass} onChange={e=>{setPass(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
      </div>
      {error&&<div style={{color:"var(--danger)",fontSize:12,marginBottom:12}}>{error}</div>}
      <div className="row g8"><button className="btn btn-primary f1" onClick={handleSubmit} disabled={busy}>{busy?"Verificando...":"Entrar como admin"}</button><button className="btn btn-ghost" onClick={onClose}>Cancelar</button></div>
    </div></div>
  );
}

export function PlayerLoginModal({ error, onClearError, onSubmit, onClose }) {
  const [cedula,setCedula]=useState("");
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Acceso Jugador</div>
      <div className="col mb12"><label className="lbl">Ingresá tu cédula</label>
        <input className="inp" type="text" inputMode="numeric" value={cedula} onChange={e=>{setCedula(e.target.value);onClearError();}} onKeyDown={e=>e.key==="Enter"&&(onClearError(),onSubmit(cedula.trim()))} autoFocus />
      </div>
      {error&&<div style={{color:"var(--danger)",fontSize:12,marginBottom:12}}>{error}</div>}
      <div className="row g8"><button className="btn btn-primary f1" onClick={()=>{onClearError();onSubmit(cedula.trim());}}>Entrar</button><button className="btn btn-ghost" onClick={onClose}>Cancelar</button></div>
    </div></div>
  );
}

export function ResultModal({ match, cat, onSave, onClose, bestOf3=false, isAmericano=false }) {
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  const [form,setForm]=useState({s1p1:match.s1p1||"",s1p2:match.s1p2||"",s2p1:match.s2p1||"",s2p2:match.s2p2||"",tbp1:match.tbp1||"",tbp2:match.tbp2||"",s3p1:match.s3p1||"",s3p2:match.s3p2||""});
  const set1w=n(form.s1p1)!==n(form.s1p2)?(n(form.s1p1)>n(form.s1p2)?1:2):null;
  const set2w=!isAmericano&&n(form.s2p1)!==n(form.s2p2)?(n(form.s2p1)>n(form.s2p2)?1:2):null;
  const set3w=!isAmericano&&bestOf3&&set1w&&set2w&&set1w!==set2w?n(form.s3p1)!==n(form.s3p2)?(n(form.s3p1)>n(form.s3p2)?1:2):null:null;
  const needTB=!isAmericano&&!bestOf3&&set1w&&set2w&&set1w!==set2w;
  const needSet3=!isAmericano&&bestOf3&&set1w&&set2w&&set1w!==set2w;
  const getWinner=()=>{if(isAmericano)return n(form.s1p1)>n(form.s1p2)?match.p1id:n(form.s1p2)>n(form.s1p1)?match.p2id:null;let sa=0,sb=0;if(set1w===1)sa++;else if(set1w===2)sb++;if(set2w===1)sa++;else if(set2w===2)sb++;if(bestOf3){if(set3w===1)sa++;else if(set3w===2)sb++;}else{if(sa===sb){if(n(form.tbp1)>n(form.tbp2))sa++;else if(n(form.tbp2)>n(form.tbp1))sb++;}}return sa>sb?match.p1id:sb>sa?match.p2id:null;};
  const winner=getWinner(),p1=byId[match.p1id],p2=byId[match.p2id];
  const f=k=>({className:"inp score-inp",type:"number",min:0,max:99,value:form[k],onChange:e=>setForm(p=>({...p,[k]:e.target.value}))});
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Resultado del Partido</div>
      <div className="match-info">
        <div className="match-teams">{p1?.nombre||"?"} <span style={{color:"var(--muted)",fontWeight:400}}>vs</span> {p2?.nombre||"?"}</div>
        <div className="match-meta">{[match.code,match.dia,match.hora,match.cancha].filter(Boolean).join(" · ")}</div>
      </div>
      {(isAmericano?[["Juegos","s1p1","s1p2"]]:[["Set 1","s1p1","s1p2"],["Set 2","s2p1","s2p2"]]).map(([lbl,k1,k2])=>(
        <div key={lbl} className="set-section"><div className="set-title">{lbl}</div>
          <div className="score-row"><span className="score-lbl" style={{textAlign:"right"}}>{p1?.nombre}</span><input {...f(k1)}/><span className="score-vs">-</span><input {...f(k2)}/><span className="score-lbl">{p2?.nombre}</span></div>
        </div>
      ))}
      {needSet3&&<div className="set-section"><div className="set-title">Set 3</div>
        <div className="score-row"><span className="score-lbl" style={{textAlign:"right"}}>{p1?.nombre}</span><input {...f("s3p1")}/><span className="score-vs">-</span><input {...f("s3p2")}/><span className="score-lbl">{p2?.nombre}</span></div>
      </div>}
      {needTB&&<div className="set-section tb"><div className="set-title">🔥 Super Tie-Break</div>
        <div className="score-row"><span className="score-lbl" style={{textAlign:"right"}}>{p1?.nombre}</span><input {...f("tbp1")}/><span className="score-vs">-</span><input {...f("tbp2")}/><span className="score-lbl">{p2?.nombre}</span></div>
      </div>}
      {winner&&<div className="winner-banner mb12"><div className="winner-text">🏆 {byId[winner]?.nombre}</div></div>}
      <div className="row g8">
        <button className="btn btn-primary f1" onClick={()=>winner&&onSave(match.id,{...form,done:true})} disabled={!winner}>Guardar</button>
        {match.done&&<button className="btn btn-danger btn-sm" onClick={()=>onSave(match.id,{s1p1:"",s1p2:"",s2p1:"",s2p2:"",tbp1:"",tbp2:"",s3p1:"",s3p2:"",done:false})}>Borrar</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div></div>
  );
}

export function EditPairModal({ pair, onSave, onClose }) {
  const [form,setForm]=useState({nombre:pair.nombre||"",j1nombre:pair.j1nombre||pair.j1||"",j1cedula:pair.j1cedula||"",j2nombre:pair.j2nombre||pair.j2||"",j2cedula:pair.j2cedula||"",sinProblemas:pair.sinProblemas!==false,notasLibres:pair.notasLibres||""});
  const [slotsRestr,setSlotsRestr]=useState(new Set(pair.restriccionesSlots||[]));
  const s=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  function toggleSlot(k){setSlotsRestr(prev=>{const n=new Set(prev);n.has(k)?n.delete(k):n.add(k);return n;});if(form.sinProblemas)setForm(p=>({...p,sinProblemas:false}));}
  function toggleSP(){if(!form.sinProblemas)setSlotsRestr(new Set());setForm(p=>({...p,sinProblemas:!p.sinProblemas}));}
  const slotsByDay=SLOT_DEFS.reduce((acc,s)=>{if(!acc[s.dia])acc[s.dia]=[];acc[s.dia].push(s);return acc;},{});
  return (
    <div className="overlay" onClick={onClose}><div className="modal modal-lg" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto"}}>
      <div className="modal-title">Editar Pareja</div>
      <div className="col mb12"><label className="lbl">Nombre de la pareja</label><input className="inp" value={form.nombre} onChange={s("nombre")} placeholder="González / Martínez"/></div>
      <div className="divider"/>
      <div className="grid2 mb12">
        <div className="col"><label className="lbl">Jugador 1 — Nombre</label><input className="inp" value={form.j1nombre} onChange={s("j1nombre")}/></div>
        <div className="col"><label className="lbl">Jugador 1 — Cédula</label><input className="inp" value={form.j1cedula} onChange={s("j1cedula")} placeholder="Ej: 1234567"/></div>
      </div>
      <div className="grid2 mb12">
        <div className="col"><label className="lbl">Jugador 2 — Nombre</label><input className="inp" value={form.j2nombre} onChange={s("j2nombre")}/></div>
        <div className="col"><label className="lbl">Jugador 2 — Cédula</label><input className="inp" value={form.j2cedula} onChange={s("j2cedula")} placeholder="Ej: 7654321"/></div>
      </div>
      <div className="divider"/>
      <div className="card-title" style={{marginBottom:12}}>Restricciones de Horario</div>
      <button className={`restr-toggle${form.sinProblemas?" active":""}`} onClick={toggleSP}>{form.sinProblemas?"✅ Sin problemas de horario":"☐ Sin problemas de horario"}</button>
      {!form.sinProblemas&&<>
        <div className="lbl" style={{marginBottom:8}}>Marcá los slots donde NO pueden jugar</div>
        <div className="slot-grid">
          {Object.entries(slotsByDay).map(([day,slots])=>(
            <div key={day} className="slot-day-col"><div className="slot-day-title">{day}</div>
              {slots.map(slot=>{const k=`${slot.dia}|${slot.hora}`;const bl=slotsRestr.has(k);return <button key={k} className={`slot-btn${bl?" blocked":""}`} onClick={()=>toggleSlot(k)}>{bl?"🚫":"🕐"} {slot.hora}</button>;})}
            </div>
          ))}
        </div>
        <div className="col mb12 mt8"><label className="lbl">Notas adicionales</label><input className="inp" value={form.notasLibres} onChange={s("notasLibres")} placeholder="ej: solo pueden después de las 16hs el sábado"/></div>
      </>}
      <div className="row g8 mt8">
        <button className="btn btn-primary f1" onClick={()=>onSave({...pair,...form,j1:form.j1nombre,j2:form.j2nombre,restriccionesSlots:Array.from(slotsRestr),sinProblemas:form.sinProblemas,restricciones:undefined})}>Guardar cambios</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div></div>
  );
}

export function EditMatchModal({ match, cat, allPartidos, onSave, onClose }) {
  const days=[...new Set(SLOT_DEFS.map(s=>s.dia))];
  const [selectedDay,setSelectedDay]=useState(match.dia&&match.dia!=="?"?match.dia:(days[0]||""));
  const [selectedHour,setSelectedHour]=useState(match.hora&&match.hora!=="?"?match.hora:"");
  const [selectedCourt,setSelectedCourt]=useState(match.cancha||COURTS[0]);
  const [conflicts,setConflicts]=useState([]);
  const hoursForDay=SLOT_DEFS.filter(s=>s.dia===selectedDay).map(s=>s.hora);
  useEffect(()=>{if(!selectedHour&&hoursForDay.length)setSelectedHour(hoursForDay[0]);},[selectedDay,hoursForDay,selectedHour]);
  const getMins=(dia,hora)=>{const s=SLOT_DEFS.find(s=>s.dia===dia&&s.hora===hora);return s?s.mins:0;};
  // Detecta si el partido editado es de llave para usar el gap correcto (KO: 120/180 · zona: 300)
  const isKO=(cat.knockoutRounds||[]).flat().some(m=>m.id===match.id);
  const checkConflicts=()=>{
    const nc=[];const cm=getMins(selectedDay,selectedHour);
    // Conflicto de slot: revisa TODAS las categorías del torneo (las canchas son compartidas)
    const ss=allPartidos.find(p=>p.id!==match.id&&p.dia===selectedDay&&p.hora===selectedHour&&p.cancha===selectedCourt);
    if(ss)nc.push({type:'slot',match:ss});
    [match.p1id,match.p2id].filter(Boolean).forEach(jid=>{
      allPartidos.filter(p=>p.id!==match.id&&(p.p1id===jid||p.p2id===jid)).forEach(op=>{
        const gap=isKO?(op.dia===selectedDay?MIN_GAP_KO_SAME_DAY:MIN_GAP_KO_DIFF_DAY):MIN_GAP;
        if(Math.abs(cm-getMins(op.dia,op.hora))<gap)nc.push({type:'rest',match:op,jugador:jid});
      });
    });
    setConflicts(nc);
  };
  useEffect(()=>{checkConflicts();},[selectedDay,selectedHour,selectedCourt]);
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Editar Partido</div>
      <div className="match-info">
        <div className="match-teams">{cat.parejas.find(p=>p.id===match.p1id)?.nombre||"?"} vs {cat.parejas.find(p=>p.id===match.p2id)?.nombre||"?"}</div>
        <div className="match-meta">{match.code}</div>
      </div>
      <div className="col mb12"><label className="lbl">Día</label><select className="inp" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}>{days.map(d=><option key={d}>{d}</option>)}</select></div>
      <div className="col mb12"><label className="lbl">Hora</label><select className="inp" value={selectedHour} onChange={e=>setSelectedHour(e.target.value)}>{hoursForDay.map(h=><option key={h}>{h}</option>)}</select></div>
      <div className="col mb12"><label className="lbl">Cancha</label><select className="inp" value={selectedCourt} onChange={e=>setSelectedCourt(e.target.value)}>{COURTS.map(c=><option key={c}>{c}</option>)}</select></div>
      {conflicts.length===0?<div className="badge bg" style={{marginBottom:16}}>✓ Sin conflictos</div>
        :<div className="alert alert-warn" style={{marginBottom:16}}>{conflicts.map((c,i)=><div key={i}>{c.type==='slot'?`⚠️ Conflicto: el partido ${c.match.code} ya ocupa ese slot.`:`⚠️ Descanso insuficiente con el partido ${c.match.code}.`}</div>)}</div>}
      <div className="row g8"><button className="btn btn-primary f1" onClick={()=>onSave(match.id,{dia:selectedDay,hora:selectedHour,cancha:selectedCourt,conflict:conflicts.length>0,mins:getMins(selectedDay,selectedHour)})}>Guardar de todos modos</button><button className="btn btn-ghost" onClick={onClose}>Cancelar</button></div>
    </div></div>
  );
}

export function EditKOPairModal({ match, cat, onSave, onClose }) {
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  const [p1id,setP1id]=useState(match.p1id||"");
  const [p2id,setP2id]=useState(match.p2id||"");
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Editar Parejas del Cruce</div>
      <div className="match-info"><div className="match-meta">{match.p1label||"Equipo 1"} vs {match.p2label||"Equipo 2"}</div></div>
      <div className="col mb12"><label className="lbl">Equipo superior</label>
        <select className="inp" value={p1id} onChange={e=>setP1id(e.target.value)}>
          <option value="">Sin asignar</option>
          {cat.parejas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="col mb16"><label className="lbl">Equipo inferior</label>
        <select className="inp" value={p2id} onChange={e=>setP2id(e.target.value)}>
          <option value="">Sin asignar</option>
          {cat.parejas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="row g8"><button className="btn btn-primary f1" onClick={()=>onSave(match.id,{p1id:p1id||null,p2id:p2id||null})}>Guardar</button><button className="btn btn-ghost" onClick={onClose}>Cancelar</button></div>
    </div></div>
  );
}
