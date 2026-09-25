// Pantallas de las modalidades americano individual y americano parejas.
import React, { useState } from "react";
import { AMERICANO_POS_PTS } from "../logica/constantes.js";
import { calcAmericanoIndStandings, calcAmericanoParejasStandings } from "../logica/resultados.js";

export function InscripcionAmericanoIndividual({cat,isAdmin,jugadoresGlobal,onAgregar,onEliminar,onTogglePago,onGenerarFixture}){
  const [cedula,setCedula]=useState("");
  const [found,setFound]=useState(null);
  const jugadores=cat.jugadoresAmericano||[];
  const N=jugadores.length;
  const warn=N>0&&N%4!==0;
  const canGen=N>=4&&N%4===0&&!cat.americanoFixtureGenerado;
  const buscar=()=>{
    const ced=cedula.trim();if(!ced)return;
    if(jugadores.some(j=>j.cedula===ced)){alert("Este jugador ya esta inscripto.");return;}
    const j=jugadoresGlobal[ced];
    setFound(j?{cedula:ced,nombre:j.nombre,exists:true}:{cedula:ced,nombre:"",exists:false});
  };
  return(
    <div>
      <div className="sec-hdr"><div className="sec-title">Jugadores</div><span className="badge bb">{N} inscriptos</span></div>
      {jugadores.map((j,i)=>(
        <div key={j.cedula} className="rank-row">
          <div className="rank-pos">{i+1}</div>
          <div className="f1"><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{j.nombre}</div>{isAdmin&&<div style={{fontSize:10,color:"var(--muted)"}}>CI: {j.cedula}</div>}</div>
          {isAdmin&&<button className={"pago-pill "+(j.pago?"pago-ok":"pago-no")} style={{cursor:"pointer",fontSize:10}} onClick={()=>onTogglePago&&onTogglePago(j.cedula)}>{j.pago?"✓ Pago":"Pendiente"}</button>}
          {isAdmin&&!cat.americanoFixtureGenerado&&<button className="btn btn-danger btn-xs" onClick={()=>onEliminar(j.cedula)}>🗑️</button>}
        </div>
      ))}
      {isAdmin&&!cat.americanoFixtureGenerado&&(
        <div style={{marginTop:16}}>
          <div className="divider"/>
          <div className="row g8 mt12">
            <input className="inp f1" placeholder="Cedula del jugador" value={cedula} onChange={e=>setCedula(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscar()}/>
            <button className="btn btn-secondary btn-sm" onClick={buscar}>Buscar</button>
          </div>
          {found&&(found.exists?(
            <div className="card mt8 row g8"><div className="f1" style={{fontWeight:600}}>{found.nombre}</div><button className="btn btn-primary btn-sm" onClick={()=>{onAgregar(found);setCedula("");setFound(null);}}>+ Agregar</button></div>
          ):(
            <div className="card mt8">
              <input className="inp mb8" placeholder="Nombre del jugador" value={found.nombre} onChange={e=>setFound(p=>({...p,nombre:e.target.value}))}/>
              <button className="btn btn-primary btn-sm" style={{width:"100%"}} onClick={()=>{if(found.nombre.trim()){onAgregar({...found,nombre:found.nombre.trim()});setCedula("");setFound(null);}}}>+ Crear y agregar</button>
            </div>
          ))}
        </div>
      )}
      {warn&&<div className="alert alert-warn" style={{marginTop:12}}>⚠️ Se necesita multiplo de 4 jugadores. Faltan {4-N%4} para llegar a {Math.ceil(N/4)*4}.</div>}
      {isAdmin&&canGen&&<button className="btn btn-primary mt16" style={{width:"100%"}} onClick={onGenerarFixture}>⚡ Generar Fixture — {N} jugadores · {N-1} rondas · {(N-1)*(N/4)} partidos</button>}
      {cat.americanoFixtureGenerado&&<div className="alert mt12" style={{background:"rgba(61,255,160,.06)",border:"1px solid rgba(61,255,160,.2)",color:"var(--accent)"}}>Fixture generado — {N-1} rondas</div>}
    </div>
  );
}

export function AmericanoIndividualView({cat,isAdmin,jugadoresGlobal,onGuardarResultado,onOtorgarPuntos,onGenerarFixture,pointsAwarded}){
  const [rondaIdx,setRondaIdx]=useState(0);
  const [editId,setEditId]=useState(null);
  const [fA,setFA]=useState("");
  const [fB,setFB]=useState("");
  const jugadores=cat.jugadoresAmericano||[];
  const partidos=cat.americanoPartidos||[];
  const byC=Object.fromEntries(jugadores.map(j=>[j.cedula,j]));
  const numRondas=jugadores.length>0?jugadores.length-1:0;
  const totalDone=partidos.filter(m=>m.done).length;
  const standings=calcAmericanoIndStandings(cat);
  const rondaPartidos=partidos.filter(m=>m.ronda===rondaIdx);
  const handleSave=()=>{if(!editId||fA===""||fB==="")return;onGuardarResultado(editId,parseInt(fA),parseInt(fB));setEditId(null);setFA("");setFB("");};
  if(!cat.americanoFixtureGenerado)return(
    <div className="empty"><div className="empty-ico">🎯</div><p>Inscribi los jugadores y genera el fixture para comenzar.</p></div>
  );
  return(
    <div>
      <div className="sec-hdr">
        <div className="sec-title">🎯 Americano Individual</div>
        <div className="row g8 wrap">
          <span className="badge bb">{totalDone}/{partidos.length}</span>
          {pointsAwarded&&<span className="badge bg">Puntos otorgados</span>}
          {isAdmin&&totalDone===partidos.length&&partidos.length>0&&<button className="btn btn-cyan btn-sm" onClick={onOtorgarPuntos}>{pointsAwarded?"🔄 Actualizar puntos":"🏅 Otorgar puntos"}</button>}
          {isAdmin&&<button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>{if(window.confirm("Regenerar borra los resultados actuales. Continuar?"))onGenerarFixture();}}>🔄 Regenerar</button>}
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="card-title mb8">Rondas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
            {Array.from({length:numRondas},(_,r)=>{
              const done=partidos.filter(m=>m.ronda===r).every(m=>m.done);
              return<button key={r} className={"btn btn-sm "+(rondaIdx===r?"btn-primary":"btn-ghost")} onClick={()=>{setRondaIdx(r);setEditId(null);}}>R{r+1}{done?" ✓":""}</button>;
            })}
          </div>
          {rondaPartidos.map(m=>{
            const j1a=byC[m.j1a],j2a=byC[m.j2a],j1b=byC[m.j1b],j2b=byC[m.j2b];
            const isEdit=editId===m.id;
            return(
              <div key={m.id} className="card mb8">
                <div style={{fontSize:12,marginBottom:6}}>
                  <span style={{fontWeight:600,color:"var(--text)"}}>{j1a?.nombre||"?"} / {j2a?.nombre||"?"}</span>
                  <span style={{color:"var(--muted)",margin:"0 6px"}}>vs</span>
                  <span style={{fontWeight:600,color:"var(--text)"}}>{j1b?.nombre||"?"} / {j2b?.nombre||"?"}</span>
                </div>
                {m.done&&!isEdit&&(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:22,color:m.juegosA>m.juegosB?"var(--accent)":"var(--text)"}}>{m.juegosA}</span>
                    <span style={{color:"var(--muted)"}}>-</span>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:22,color:m.juegosB>m.juegosA?"var(--accent)":"var(--text)"}}>{m.juegosB}</span>
                    {isAdmin&&<button className="btn btn-ghost btn-xs" style={{marginLeft:"auto"}} onClick={()=>{setEditId(m.id);setFA(String(m.juegosA));setFB(String(m.juegosB));}}>✏️</button>}
                  </div>
                )}
                {(!m.done||isEdit)&&isAdmin&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <input className="inp score-inp" type="number" min={0} max={99} value={isEdit?fA:""} placeholder="-" style={{width:50,textAlign:"center"}} onChange={e=>{setEditId(m.id);setFA(e.target.value);if(!isEdit)setFB("");}}/>
                    <span style={{color:"var(--muted)"}}>-</span>
                    <input className="inp score-inp" type="number" min={0} max={99} value={isEdit?fB:""} placeholder="-" style={{width:50,textAlign:"center"}} onChange={e=>{setEditId(m.id);setFB(e.target.value);if(!isEdit)setFA("");}}/>
                    {isEdit&&<><button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button><button className="btn btn-ghost btn-sm" onClick={()=>{setEditId(null);setFA("");setFB("");}}>X</button></>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="card-title mb8">Posiciones</div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Jugador</th><th>G</th><th>P</th><th>Dif</th><th>Pts</th></tr></thead>
            <tbody>
              {standings.map((s,i)=>{
                const pos=i+1,pts=AMERICANO_POS_PTS[pos]||5,dif=s.ganados-s.perdidos;
                return<tr key={s.cedula}>
                  <td style={{fontFamily:"Oswald",fontWeight:700}}>{pos}</td>
                  <td className="em">{s.nombre}</td>
                  <td style={{color:"var(--accent)",fontWeight:600}}>{s.ganados}</td>
                  <td style={{color:"var(--muted)"}}>{s.perdidos}</td>
                  <td style={{fontFamily:"Oswald",fontWeight:700,color:dif>=0?"var(--accent)":"var(--danger)"}}>{dif>=0?"+":""}{dif}</td>
                  <td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--gold)",fontSize:15}}>{pts}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AmericanoParejasView({cat,isAdmin,onGuardarResultado,onGenerarFixture,onOtorgarPuntos,pointsAwarded}){
  const [rondaIdx,setRondaIdx]=useState(0);
  const [editId,setEditId]=useState(null);
  const [fA,setFA]=useState("");
  const [fB,setFB]=useState("");
  const byId=Object.fromEntries(cat.parejas.map(p=>[p.id,p]));
  const partidos=cat.americanoPartidos||[];
  const N=cat.parejas.length;
  const numRondas=N%2===0?N-1:N;
  const totalDone=partidos.filter(m=>m.done).length;
  const standings=calcAmericanoParejasStandings(cat);
  const rondaPartidos=partidos.filter(m=>m.ronda===rondaIdx);
  const handleSave=()=>{if(!editId||fA===""||fB==="")return;onGuardarResultado(editId,parseInt(fA),parseInt(fB));setEditId(null);setFA("");setFB("");};
  if(!cat.americanoFixtureGenerado)return(
    <div>
      <div className="sec-hdr"><div className="sec-title">🎾 Americano Parejas</div></div>
      <div className="card" style={{textAlign:"center",padding:40}}>
        <div className="empty-ico">🎾</div>
        <p style={{color:"var(--muted)",marginBottom:16}}>{N<2?"Inscribi al menos 2 parejas":`${N} parejas · ${N*(N-1)/2} partidos · ${numRondas} rondas`}</p>
        {isAdmin&&N>=2&&<button className="btn btn-primary" onClick={onGenerarFixture}>⚡ Generar Fixture Americano</button>}
      </div>
    </div>
  );
  return(
    <div>
      <div className="sec-hdr">
        <div className="sec-title">🎾 Americano Parejas</div>
        <div className="row g8 wrap">
          <span className="badge bb">{totalDone}/{partidos.length}</span>
          {pointsAwarded&&<span className="badge bg">Puntos otorgados</span>}
          {isAdmin&&totalDone===partidos.length&&partidos.length>0&&<button className="btn btn-cyan btn-sm" onClick={onOtorgarPuntos}>{pointsAwarded?"🔄 Actualizar puntos":"🏅 Otorgar puntos"}</button>}
          {isAdmin&&<button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>{if(window.confirm("Regenerar borra los resultados actuales. Continuar?"))onGenerarFixture();}}>🔄 Regenerar</button>}
        </div>
      </div>
      <div className="grid2">
        <div>
          <div className="card-title mb8">Rondas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
            {Array.from({length:numRondas},(_,r)=>{
              const done=partidos.filter(m=>m.ronda===r).every(m=>m.done);
              return<button key={r} className={"btn btn-sm "+(rondaIdx===r?"btn-primary":"btn-ghost")} onClick={()=>{setRondaIdx(r);setEditId(null);}}>R{r+1}{done?" ✓":""}</button>;
            })}
          </div>
          {rondaPartidos.map(m=>{
            const p1=byId[m.p1id],p2=byId[m.p2id];
            if(!p1||!p2)return null;
            const isEdit=editId===m.id;
            return(
              <div key={m.id} className="card mb8">
                <div style={{fontSize:12,marginBottom:6}}>
                  <span style={{fontWeight:600,color:"var(--text)"}}>{p1.nombre}</span>
                  <span style={{color:"var(--muted)",margin:"0 6px"}}>vs</span>
                  <span style={{fontWeight:600,color:"var(--text)"}}>{p2.nombre}</span>
                </div>
                {m.done&&!isEdit&&(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:22,color:m.juegosA>m.juegosB?"var(--accent)":"var(--text)"}}>{m.juegosA}</span>
                    <span style={{color:"var(--muted)"}}>-</span>
                    <span style={{fontFamily:"Oswald",fontWeight:700,fontSize:22,color:m.juegosB>m.juegosA?"var(--accent)":"var(--text)"}}>{m.juegosB}</span>
                    {isAdmin&&<button className="btn btn-ghost btn-xs" style={{marginLeft:"auto"}} onClick={()=>{setEditId(m.id);setFA(String(m.juegosA));setFB(String(m.juegosB));}}>✏️</button>}
                  </div>
                )}
                {(!m.done||isEdit)&&isAdmin&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <input className="inp score-inp" type="number" min={0} max={99} value={isEdit?fA:""} placeholder="-" style={{width:50,textAlign:"center"}} onChange={e=>{setEditId(m.id);setFA(e.target.value);if(!isEdit)setFB("");}}/>
                    <span style={{color:"var(--muted)"}}>-</span>
                    <input className="inp score-inp" type="number" min={0} max={99} value={isEdit?fB:""} placeholder="-" style={{width:50,textAlign:"center"}} onChange={e=>{setEditId(m.id);setFB(e.target.value);if(!isEdit)setFA("");}}/>
                    {isEdit&&<><button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button><button className="btn btn-ghost btn-sm" onClick={()=>{setEditId(null);setFA("");setFB("");}}>X</button></>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="card-title mb8">Posiciones</div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Pareja</th><th>G</th><th>P</th><th>Dif</th><th>Pts</th></tr></thead>
            <tbody>
              {standings.map((s,i)=>{
                const pos=i+1,pts=AMERICANO_POS_PTS[pos]||5,dif=s.ganados-s.perdidos,p=byId[s.id];
                return<tr key={s.id}>
                  <td style={{fontFamily:"Oswald",fontWeight:700}}>{pos}</td>
                  <td><div className="em">{s.nombre}</div><div style={{fontSize:10,color:"var(--muted)"}}>{p?.j1nombre||p?.j1} · {p?.j2nombre||p?.j2}</div></td>
                  <td style={{color:"var(--accent)",fontWeight:600}}>{s.ganados}</td>
                  <td style={{color:"var(--muted)"}}>{s.perdidos}</td>
                  <td style={{fontFamily:"Oswald",fontWeight:700,color:dif>=0?"var(--accent)":"var(--danger)"}}>{dif>=0?"+":""}{dif}</td>
                  <td style={{fontFamily:"Oswald",fontWeight:700,color:"var(--gold)",fontSize:15}}>{pts}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
