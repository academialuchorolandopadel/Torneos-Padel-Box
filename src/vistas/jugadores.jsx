// Pantallas de jugadores: ranking, historial, "Mi Torneo" y reglamento.
import React, { useState } from "react";
import { STAGE_LABEL, CAT_LABELS, CAT_COLORS, GENERO_COLORS, FIP_LINKS } from "../logica/constantes.js";
import { calcStandings, calcPlayerStats } from "../logica/resultados.js";
import { getRoundNames, calcPairStages } from "../logica/llave.js";

export function ReglamentoView(){
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Reglamento</div><span className="badge bb">FIP oficial</span></div>
      <div className="card mb16">
        <div className="card-title">Federación Internacional de Pádel</div>
        <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.5,margin:0}}>Este torneo se rige por los reglamentos y códigos oficiales de la FIP. Tocá cualquiera para abrirlo en una pestaña nueva.</p>
      </div>
      {FIP_LINKS.map((l,i)=>(
        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="card" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textDecoration:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <span style={{fontSize:24,flexShrink:0}}>📄</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{l.label}</div>
              <div style={{fontSize:11,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.archivo}</div>
            </div>
          </div>
          <span className="badge bg" style={{flexShrink:0}}>Abrir ↗</span>
        </a>
      ))}
    </div>
  );
}

export function JugadoresView({ jugadores, torneos, onDeleteJugador, onUpdateCategoria, onUpdateGenero, onCreateJugador, isAdmin, onDeleteHistorialEntry=()=>{}, onAjustarPuntos=()=>{} }) {
  const [sel,setSel]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [newCed,setNewCed]=useState("");
  const [newNom,setNewNom]=useState("");
  const handleCreate=()=>{
    const ced=newCed.trim(),nom=newNom.trim();
    if(!ced||!nom)return;
    if(jugadores[ced]){alert("Ya existe un jugador con esa cedula: "+jugadores[ced].nombre);return;}
    onCreateJugador(ced,nom);setNewCed("");setNewNom("");setShowNew(false);
  };
  const [editingCat,setEditingCat]=useState(null);
  const [editingGenero,setEditingGenero]=useState(null);
  const [ajusteVal,setAjusteVal]=useState("");
  const [ajusteDesc,setAjusteDesc]=useState("");
  const [confirmDeleteIdx,setConfirmDeleteIdx]=useState(null);
  const list=Object.values(jugadores).sort((a,b)=>b.totalPts-a.totalPts);
  const jug=sel?jugadores[sel]:null;
  const handleDelete=(cedula,e)=>{e.stopPropagation();if(!isAdmin)return;if(window.confirm(`¿Eliminar a ${jugadores[cedula]?.nombre} del ranking?`)){onDeleteJugador(cedula);if(sel===cedula)setSel(null);}};
  const handleCatChange=(cedula,val)=>{onUpdateCategoria(cedula,val?Number(val):null);setEditingCat(null);};
  // Derivar género: override manual primero, luego del historial
  const getGenero=(j)=>{
    if(j.genero)return j.genero;
    const cats=(j.historial||[]).map(h=>(h.catNombre||"").toLowerCase());
    if(cats.some(c=>c.includes("damas")))return "F";
    if(cats.some(c=>c.includes("caballeros")))return "M";
    return null;
  };
  // Clave de categoría para agrupar: usa campo categoria si está definido, sino el último historial
  const getCatKey=(j,genero)=>{
    if(j.categoria){const label=CAT_LABELS[j.categoria]||"";const gl=genero==="F"?"Damas":genero==="M"?"Caballeros":"";return gl?`${label} ${gl}`:label;}
    const hist=j.historial||[];if(!hist.length)return null;
    return hist[hist.length-1].catNombre||null;
  };
  const parseCatNum=(key)=>{const m=(key||"").match(/(\d+)/);return m?parseInt(m[1]):99;};
  const groupsM={},groupsF={},noGen=[];
  list.forEach(j=>{
    const g=getGenero(j),catKey=getCatKey(j,g)||"Sin categoría";
    if(g==="M"){if(!groupsM[catKey])groupsM[catKey]=[];groupsM[catKey].push(j);}
    else if(g==="F"){if(!groupsF[catKey])groupsF[catKey]=[];groupsF[catKey].push(j);}
    else noGen.push(j);
  });
  const sortKeys=(obj)=>Object.keys(obj).sort((a,b)=>parseCatNum(a)-parseCatNum(b));
  const renderRow=(j,rank)=>(
    <div key={j.cedula} className="rank-row" style={{borderColor:sel===j.cedula?"var(--accent)":"var(--border)",padding:"8px 10px"}} onClick={()=>{setSel(sel===j.cedula?null:j.cedula);setConfirmDeleteIdx(null);}}>
      <div className={`rank-pos${rank===1?" p1":rank===2?" p2":rank===3?" p3":""}`} style={{fontSize:16,minWidth:24}}>{rank}</div>
      <div className="f1" style={{minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.nombre}</div>
        {isAdmin&&<div style={{fontSize:10,color:"var(--muted)"}}>CI: {j.cedula}</div>}
      </div>
      <div style={{fontFamily:"Oswald",fontWeight:700,fontSize:18,color:"var(--accent)",flexShrink:0,textAlign:"right"}}>
        {j.totalPts}<span style={{fontFamily:"DM Sans",fontSize:8,color:"var(--muted)",display:"block",letterSpacing:1,textTransform:"uppercase"}}>pts</span>
      </div>
      {isAdmin&&(editingCat===j.cedula?(
        <select className="inp" style={{width:70,fontSize:10,padding:"2px 4px"}} autoFocus value={j.categoria||""} onChange={e=>{e.stopPropagation();handleCatChange(j.cedula,e.target.value);}} onClick={e=>e.stopPropagation()} onBlur={()=>setEditingCat(null)}>
          <option value="">—</option>
          {[8,7,6,5,4,3,2,1].map(n=><option key={n} value={n}>{CAT_LABELS[n]}</option>)}
        </select>
      ):(
        <button className="btn btn-ghost btn-xs" onClick={e=>{e.stopPropagation();setEditingCat(j.cedula);}} title="Categoría">🏷️</button>
      ))}
      {isAdmin&&(editingGenero===j.cedula?(
        <select className="inp" style={{width:78,fontSize:10,padding:"2px 4px"}} autoFocus value={j.genero||""} onChange={e=>{e.stopPropagation();onUpdateGenero(j.cedula,e.target.value||null);setEditingGenero(null);}} onClick={e=>e.stopPropagation()} onBlur={()=>setEditingGenero(null)}>
          <option value="">Auto</option>
          <option value="M">Cab.</option>
          <option value="F">Dam.</option>
        </select>
      ):(
        <button className="btn btn-ghost btn-xs" onClick={e=>{e.stopPropagation();setEditingGenero(j.cedula);}} title="Género" style={{color:getGenero(j)==="M"?"var(--accent2)":getGenero(j)==="F"?"#ff64b4":"var(--muted)"}}>{getGenero(j)==="M"?"♂":getGenero(j)==="F"?"♀":"⚧"}</button>
      ))}
      {isAdmin&&<button className="btn btn-danger btn-xs" onClick={e=>handleDelete(j.cedula,e)}>🗑️</button>}
    </div>
  );
  const renderCol=(groups,color)=>{
    const keys=sortKeys(groups);
    if(!keys.length)return <div style={{color:"var(--muted)",fontSize:12,padding:"12px 8px",textAlign:"center"}}>Sin jugadores aún</div>;
    return keys.map(key=>(
      <div key={key} style={{marginBottom:14}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:color?.text||"var(--muted)",padding:"3px 8px",background:color?.bg||"transparent",borderRadius:5,marginBottom:6,display:"inline-block"}}>{key.replace(/\s*(caballeros|damas)\s*/i,"").trim()||key}</div>
        {groups[key].map((j,i)=>renderRow(j,i+1))}
      </div>
    ));
  };
  const colHdr=(label,color,count)=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 12px",borderRadius:9,background:color.bg,border:`1px solid ${color.border}`,marginBottom:12,fontFamily:"Oswald",fontSize:13,fontWeight:600,letterSpacing:2,textTransform:"uppercase",color:color.text}}>
      {label}<span style={{fontFamily:"DM Sans",fontSize:11,fontWeight:400,letterSpacing:0,opacity:.7}}>{count}</span>
    </div>
  );
  return (
    <div>
      <div className="sec-hdr"><div className="sec-title">Ranking</div>
        <div className="row g8 wrap">
          <span className="badge bb">{list.length} jugadores</span>
          {isAdmin&&<button className="btn btn-primary btn-sm" onClick={()=>setShowNew(s=>!s)}>{showNew?"✕ Cancelar":"+ Nuevo Jugador"}</button>}
        </div>
      </div>
      {isAdmin&&showNew&&(
        <div className="card mb16">
          <div className="card-title">Nuevo Jugador</div>
          <div className="grid2 mb12">
            <div className="col"><label className="lbl">Cedula</label><input className="inp" autoFocus value={newCed} onChange={e=>setNewCed(e.target.value)} placeholder="1234567"/></div>
            <div className="col"><label className="lbl">Nombre y apellido</label><input className="inp" value={newNom} onChange={e=>setNewNom(e.target.value)} placeholder="Juan Perez" onKeyDown={e=>e.key==="Enter"&&handleCreate()}/></div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>Crear jugador</button>
        </div>
      )}
      {list.length===0?(
        <div className="empty"><div className="empty-ico">🏅</div><p>Los jugadores aparecen aquí al finalizar un torneo y otorgar puntos</p><p style={{fontSize:12,marginTop:8}}>El género y categoría se asignan automáticamente del nombre de la categoría</p></div>
      ):(
        <>
          <div className="grid2">
            <div>
              {colHdr("♂ Caballeros",GENERO_COLORS.M,list.filter(j=>getGenero(j)==="M").length)}
              {renderCol(groupsM,GENERO_COLORS.M)}
            </div>
            <div>
              {colHdr("♀ Damas",GENERO_COLORS.F,list.filter(j=>getGenero(j)==="F").length)}
              {renderCol(groupsF,GENERO_COLORS.F)}
            </div>
          </div>
          {noGen.length>0&&(
            <div style={{marginTop:16}}>
              <div style={{fontSize:9,fontWeight:600,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>⚧ Sin género ({noGen.length})</div>
              <div className="grid2"><div>{noGen.map((j,i)=>renderRow(j,i+1))}</div><div/></div>
            </div>
          )}
          {jug&&(
            <div className="card" style={{marginTop:16}}>
              <div className="card-title">Historial — {jug.nombre}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                {isAdmin&&<div style={{fontSize:12,color:"var(--muted)"}}>CI: {jug.cedula}</div>}
                {jug.categoria&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,background:CAT_COLORS[jug.categoria]||"var(--bg3)",color:"var(--text)"}}>{CAT_LABELS[jug.categoria]}</span>}
              </div>
              <div style={{fontFamily:"Oswald",fontSize:36,fontWeight:700,color:"var(--accent)",marginBottom:2}}>{jug.totalPts}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:16,letterSpacing:1,textTransform:"uppercase"}}>puntos totales</div>
              {(()=>{const d=(jug.historial||[]).filter(h=>h.torneoEdicion).reduce((s,h)=>s+(h.pts||0),0);return d>0&&<div style={{fontSize:11,color:"var(--gold)",marginBottom:12,display:"flex",alignItems:"center",gap:4}}>🛡️ <span><b>{d}</b> pts a defender en próximas ediciones</span></div>;})()}
              {(()=>{const st=calcPlayerStats(jug.cedula,torneos);if(!st.pj)return null;return(
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20}}>{st.pj}</div><div className="stat-lbl">Partidos</div></div>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20}}>{st.g}</div><div className="stat-lbl">Ganados</div></div>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20,color:"var(--danger)"}}>{st.per}</div><div className="stat-lbl">Perdidos</div></div>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20,color:"var(--gold)"}}>{st.pct}%</div><div className="stat-lbl">Victorias</div></div>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20,color:"var(--accent2)"}}>{st.rachaActual}</div><div className="stat-lbl">Racha actual</div></div>
                  <div className="stat-box"><div className="stat-val" style={{fontSize:20,color:"var(--accent2)"}}>{st.mejorRacha}</div><div className="stat-lbl">Mejor racha</div></div>
                </div>
              );})()}
              {jug.historial.map((h,i)=>(
                <div key={i} className="hist-item">
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:"var(--text)",fontWeight:600,marginBottom:2}}>{h.torneoNombre}{h.manual&&<span style={{fontSize:9,color:"var(--muted)",marginLeft:4}}>(manual)</span>}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{h.catNombre} · {h.fecha}</div>
                  </div>
                  <div className="col" style={{alignItems:"flex-end",gap:3}}>
                    <span className="badge bg">{STAGE_LABEL[h.stage]||"✏️ Manual"}</span>
                    {h.torneoEdicion&&<span style={{fontSize:9,color:"var(--gold)",marginTop:2}}>🛡️</span>}
                    <span style={{fontFamily:"Oswald",fontWeight:700,color:h.pts>=0?"var(--gold)":"var(--danger)",fontSize:15}}>{h.pts>=0?"+":""}{h.pts}</span>
                    {isAdmin&&(
                      confirmDeleteIdx===i ? (
                        <div className="row g8" style={{marginTop:4}}>
                          <span style={{fontSize:10,color:"var(--danger)"}}>¿Borrar?</span>
                          <button className="btn btn-danger btn-xs" onClick={()=>{onDeleteHistorialEntry(jug.cedula,i);setConfirmDeleteIdx(null);}}>✓ Sí</button>
                          <button className="btn btn-ghost btn-xs" onClick={()=>setConfirmDeleteIdx(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-danger btn-xs" style={{marginTop:2}} title="Eliminar entrada" onClick={()=>setConfirmDeleteIdx(i)}>🗑️</button>
                      )
                    )}
                  </div>
                </div>
              ))}
              {isAdmin&&(
                <div style={{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Ajuste manual de puntos</div>
                  <div className="row g8 wrap">
                    <input className="inp" type="number" style={{width:80}} placeholder="+/-pts" value={ajusteVal} onChange={e=>setAjusteVal(e.target.value)}/>
                    <input className="inp f1" placeholder="Descripcion (ej: correccion)" value={ajusteDesc} onChange={e=>setAjusteDesc(e.target.value)}/>
                    <button className="btn btn-secondary btn-sm" disabled={!ajusteVal||parseInt(ajusteVal)===0||isNaN(parseInt(ajusteVal))} onClick={()=>{const d=parseInt(ajusteVal);if(!isNaN(d)&&d!==0){onAjustarPuntos(jug.cedula,d,ajusteDesc.trim());setAjusteVal("");setAjusteDesc("");}}}>Aplicar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function MiTorneo({ torneo, playerCedula }) {
  const DAY_SHORT={"JUEVES":"JUE","VIERNES":"VIE","SÁBADO":"SÁB","DOMINGO":"DOM"};
  if(!playerCedula)return<div className="empty"><div className="empty-ico">👤</div><p>No se pudo identificar tu jugador</p></div>;
  const misData=[];
  (torneo?.categorias||[]).forEach(cat=>{
    const miPareja=cat.parejas?.find(p=>p.j1cedula===playerCedula||p.j2cedula===playerCedula);
    if(!miPareja)return;
    const byId=Object.fromEntries((cat.parejas||[]).map(p=>[p.id,p]));
    const misPartidos=(cat.partidos||[]).filter(m=>(m.p1id===miPareja.id||m.p2id===miPareja.id)&&m.p1id&&m.p2id).sort((a,b)=>(a.mins||0)-(b.mins||0));
    const roundNames=getRoundNames(cat.knockoutRounds);
    const misKO=(cat.knockoutRounds||[]).map((round,ri)=>{
      const m=round.find(m=>!m.auto&&(m.p1id===miPareja.id||m.p2id===miPareja.id));
      return m?{m,roundName:roundNames[ri]||`Ronda ${ri+1}`}:null;
    }).filter(Boolean);
    const miGrupo=cat.grupos?.find(g=>g.id===miPareja.grupoId);
    const zonaIds=(cat.parejas||[]).filter(p=>p.grupoId===miPareja.grupoId).map(p=>p.id);
    const standing=miGrupo?calcStandings(zonaIds,cat.parejas,(cat.partidos||[]).filter(m=>m.grupoId===miPareja.grupoId),cat.modalidad==="americano_zonas"):[];
    const stages=cat.knockoutGenerated?calcPairStages(cat):{};
    const miStage=stages[miPareja.id];
    misData.push({cat,miPareja,misPartidos,misKO,miGrupo,standing,byId,miStage});
  });
  if(misData.length===0)return<div className="empty"><div className="empty-ico">🎾</div><p>No estás inscripto en ninguna categoria de este torneo</p></div>;
  return(
    <div>
      {misData.map(({cat,miPareja,misPartidos,misKO,miGrupo,standing,byId,miStage})=>(
        <div key={cat.id}>
          <div className="sec-hdr">
            <div className="sec-title">{cat.nombre}</div>
            {miStage&&<span className="badge bg">{STAGE_LABEL[miStage]}</span>}
          </div>
          <div className="card mb16">
            <div className="card-title">Mis Partidos</div>
            {misPartidos.length===0?<div style={{color:"var(--muted)",fontSize:13,padding:"8px 0"}}>No hay partidos asignados aún</div>
            :misPartidos.map(m=>{
              const rival=m.p1id===miPareja.id?byId[m.p2id]:byId[m.p1id];
              const esP1=m.p1id===miPareja.id;
              const gane=m.done&&m.winner===miPareja.id;
              const s1a=esP1?m.s1p1:m.s1p2,s1b=esP1?m.s1p2:m.s1p1;
              const s2a=esP1?m.s2p1:m.s2p2,s2b=esP1?m.s2p2:m.s2p1;
              return(
                <div key={m.id} style={{background:m.done?(gane?"rgba(61,255,160,.06)":"rgba(255,51,85,.04)"):"var(--bg3)",border:`1px solid ${m.done?(gane?"rgba(61,255,160,.3)":"rgba(255,51,85,.2)"):"var(--border)"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{textAlign:"center",minWidth:52}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",letterSpacing:1}}>{DAY_SHORT[m.dia]||m.dia||"—"}</div>
                    <div style={{fontFamily:"Oswald",fontSize:22,fontWeight:700,color:"var(--text)",lineHeight:1.1}}>{m.hora||"—"}</div>
                    <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{m.cancha||""}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"var(--muted)",marginBottom:2,letterSpacing:1,textTransform:"uppercase"}}>vs</div>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{rival?.nombre||"Por definir"}</div>
                    {m.done&&<div style={{fontSize:12,fontWeight:700,marginTop:4,color:gane?"var(--accent)":"var(--danger)"}}>{gane?"✓ Ganado":"✗ Perdido"} <span style={{color:"var(--text)",fontFamily:"Oswald"}}>{s1a}-{s1b} {s2a}-{s2b}{m.tbp1!==undefined&&m.tbp1!==""?` TB:${esP1?m.tbp1:m.tbp2}-${esP1?m.tbp2:m.tbp1}`:""}</span></div>}
                    {!m.done&&m.dia&&<div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{m.code}</div>}
                  </div>
                  {!m.done&&<div style={{fontSize:10,color:"var(--gold)",fontWeight:700,padding:"3px 8px",background:"rgba(255,203,71,.08)",borderRadius:5,border:"1px solid rgba(255,203,71,.2)",whiteSpace:"nowrap"}}>PENDIENTE</div>}
                </div>
              );
            })}
          </div>
          {cat.knockoutGenerated&&misKO.length>0&&(
            <div className="card mb16">
              <div className="card-title">🏆 Llave Final</div>
              {misKO.map(({m,roundName})=>{
                const rival=m.p1id===miPareja.id?byId[m.p2id]:byId[m.p1id];
                const esP1=m.p1id===miPareja.id;
                const gane=m.done&&m.winner===miPareja.id;
                const s1a=esP1?m.s1p1:m.s1p2,s1b=esP1?m.s1p2:m.s1p1;
                const s2a=esP1?m.s2p1:m.s2p2,s2b=esP1?m.s2p2:m.s2p1;
                return(
                  <div key={m.id} style={{background:m.done?(gane?"rgba(61,255,160,.06)":"rgba(255,51,85,.04)"):"var(--bg3)",border:`1px solid ${m.done?(gane?"rgba(61,255,160,.3)":"rgba(255,51,85,.2)"):"rgba(0,212,255,.2)"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{textAlign:"center",minWidth:60}}>
                      <div style={{fontSize:9,fontWeight:700,color:"var(--accent2)",letterSpacing:1,textTransform:"uppercase"}}>{roundName}</div>
                      <div style={{fontFamily:"Oswald",fontSize:18,fontWeight:700,color:"var(--text)",lineHeight:1.2}}>{m.dia?m.dia.slice(0,3):"—"}</div>
                      <div style={{fontFamily:"Oswald",fontSize:14,fontWeight:600,color:"var(--muted)"}}>{m.hora||"—"}</div>
                      <div style={{fontSize:9,color:"var(--muted)"}}>{m.cancha||""}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:"var(--muted)",marginBottom:2,letterSpacing:1,textTransform:"uppercase"}}>vs</div>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{rival?.nombre||"Por definir"}</div>
                      {m.done&&<div style={{fontSize:12,fontWeight:700,marginTop:4,color:gane?"var(--accent)":"var(--danger)"}}>{gane?"✓ Ganado":"✗ Perdido"} <span style={{color:"var(--text)",fontFamily:"Oswald"}}>{s1a}-{s1b} {s2a}-{s2b}{m.tbp1!==undefined&&m.tbp1!==""?` TB:${esP1?m.tbp1:m.tbp2}-${esP1?m.tbp2:m.tbp1}`:""}</span></div>}
                    </div>
                    {!m.done&&<div style={{fontSize:10,color:"var(--accent2)",fontWeight:700,padding:"3px 8px",background:"rgba(0,212,255,.08)",borderRadius:5,border:"1px solid rgba(0,212,255,.2)",whiteSpace:"nowrap"}}>PRÓXIMO</div>}
                  </div>
                );
              })}
            </div>
          )}
          {miGrupo&&standing.length>0&&(
            <div className="card mb16">
              <div className="card-title">{miGrupo.nombre} — Mi posición</div>
              {standing.map((s,i)=>{
                const esMio=s.id===miPareja.id;
                return(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:8,marginBottom:4,background:esMio?"rgba(61,255,160,.08)":"transparent",border:esMio?"1px solid rgba(61,255,160,.25)":"1px solid transparent"}}>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:18,color:i===0?"var(--gold)":i===1?"var(--silver)":"var(--muted)",minWidth:24,textAlign:"center"}}>{i+1}</span>
                    <span style={{flex:1,fontSize:13,fontWeight:esMio?700:400,color:esMio?"var(--accent)":"var(--text)"}}>{s.pair?.nombre}{esMio?" 👈":""}</span>
                    <span style={{fontSize:11,color:"var(--muted)"}}>{s.g}G {s.per}P</span>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:15,color:"var(--gold)",minWidth:28,textAlign:"right"}}>{s.pts}</span>
                  </div>
                );
              })}
              {standing.findIndex(s=>s.id===miPareja.id)<2&&<div style={{fontSize:11,color:"var(--accent)",marginTop:10,textAlign:"center",padding:"6px",background:"rgba(61,255,160,.05)",borderRadius:6}}>✓ En zona de clasificación a llave final</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
