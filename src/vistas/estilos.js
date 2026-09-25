// Estilos globales de la app.

export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--bg:#060d18;--bg2:#0c1a2e;--bg3:#071422;--border:#0e2540;--accent:#3dffa0;--accent2:#00d4ff;--text:#ddeeff;--muted:#3a6080;--danger:#ff3355;--gold:#ffcb47;--silver:#b8c8d8;--bronze:#cd8e5a}
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
  *{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
  .app{min-height:100vh;display:flex;flex-direction:column}
  .hdr{background:rgba(6,13,24,.95);border-bottom:1px solid var(--border);padding:10px 20px;position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .logo{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--accent);letter-spacing:2px}
  .logo em{color:var(--text);font-style:normal}
  .hdr-name-wrap{display:flex;align-items:center;gap:6px;border-left:2px solid var(--border);padding-left:12px}
  .hdr-name{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--text);letter-spacing:1px;text-transform:uppercase}
  .edit-inline{background:transparent;border:1px solid var(--accent);border-radius:6px;color:var(--text);font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;padding:3px 8px;outline:none;width:200px}
  .icon-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;padding:3px 5px;border-radius:5px;font-size:13px}
  .icon-btn:hover{color:var(--accent)}
  .nav-tabs{display:flex;gap:3px;background:var(--bg2);border-radius:10px;padding:3px;flex-wrap:wrap;margin-left:auto}
  .nav-tab{padding:7px 13px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
  .nav-tab:hover{color:var(--text)}
  .nav-tab.on{background:var(--accent);color:#060d18;font-weight:700}
  .nav-tab.jug.on{background:var(--accent2);color:#060d18}
  .main{flex:1;padding:24px 20px;max-width:1140px;margin:0 auto;width:100%}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px}
  .card+.card{margin-top:16px}
  .card-title{font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .inp{background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;padding:9px 12px;outline:none;width:100%;transition:border-color .15s}
  .inp:focus{border-color:var(--accent)}
  .inp::placeholder{color:var(--muted)}
  .inp[type=number]{-moz-appearance:textfield}
  .inp[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
  .btn{padding:9px 18px;border-radius:9px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .btn-primary{background:var(--accent);color:#060d18}
  .btn-primary:hover:not(:disabled){filter:brightness(1.1)}
  .btn-secondary{background:var(--bg3);color:var(--text);border:1px solid var(--border)}
  .btn-secondary:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
  .btn-danger{background:rgba(255,51,85,.15);color:var(--danger);border:1px solid rgba(255,51,85,.3)}
  .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
  .btn-ghost:hover:not(:disabled){color:var(--text)}
  .btn-cyan{background:rgba(0,212,255,.1);color:var(--accent2);border:1px solid rgba(0,212,255,.3)}
  .btn-sm{padding:5px 11px;font-size:12px;border-radius:7px}
  .btn-xs{padding:3px 8px;font-size:11px;border-radius:5px}
  .tbl{width:100%;border-collapse:collapse;font-size:13px}
  .tbl th{text-align:left;padding:9px 10px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border)}
  .tbl td{padding:9px 10px;border-bottom:1px solid rgba(14,37,64,.5);color:#a0bcd0;vertical-align:middle}
  .tbl tr:last-child td{border-bottom:none}
  .tbl .em{color:var(--text);font-weight:500}
  .badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;font-family:'Oswald',sans-serif;letter-spacing:.5px}
  .bg{background:rgba(61,255,160,.12);color:var(--accent)}.bb{background:rgba(0,212,255,.12);color:var(--accent2)}
  .by{background:rgba(255,203,71,.12);color:var(--gold)}.bx{background:rgba(100,130,160,.1);color:var(--muted)}
  .row{display:flex;align-items:center;gap:10px}.col{display:flex;flex-direction:column;gap:5px}
  .wrap{flex-wrap:wrap}.f1{flex:1;min-width:0}
  .g8{gap:8px}.g12{gap:12px}
  .mb8{margin-bottom:8px}.mb12{margin-bottom:12px}.mb16{margin-bottom:16px}
  .mt8{margin-top:8px}.mt12{margin-top:12px}
  .just-between{justify-content:space-between}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .lbl{font-size:10px;font-weight:600;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;display:block}
  .sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
  .sec-title{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;color:var(--text);letter-spacing:1px;text-transform:uppercase}
  .empty{text-align:center;padding:48px 20px;color:var(--muted)}
  .empty-ico{font-size:40px;margin-bottom:12px}
  .stat-box{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 16px;text-align:center;min-width:70px}
  .stat-val{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--accent);line-height:1}
  .stat-lbl{font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:3px}
  .hero{text-align:center;padding:56px 20px 36px}
  .hero-title{font-family:'Oswald',sans-serif;font-size:52px;font-weight:700;color:var(--text);letter-spacing:4px;text-transform:uppercase;line-height:1;margin-bottom:6px}
  .hero-title span{color:var(--accent)}
  .hero-sub{color:var(--muted);font-size:14px;margin-bottom:28px}
  .t-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all .2s;text-align:left;display:block;width:100%;position:relative}
  .t-card:hover{border-color:var(--accent);transform:translateY(-2px)}
  .t-card-name{font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
  .t-card-meta{font-size:12px;color:var(--muted);margin-bottom:10px}
  .t-card-del{position:absolute;top:12px;right:12px;opacity:0;transition:opacity .15s}
  .t-card:hover .t-card-del{opacity:1}
  .cat-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
  .cat-tab{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
  .cat-tab.on{background:rgba(61,255,160,.08);border-color:var(--accent);color:var(--accent)}
  .cat-tab.add{border-style:dashed}
  .sched-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .court-hdr{font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;color:var(--accent);letter-spacing:2px;text-align:center;padding:10px;background:rgba(61,255,160,.06);border:1px solid rgba(61,255,160,.2);border-radius:10px 10px 0 0}
  .court-body{border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;overflow:hidden}
  .court-slot{padding:9px 12px;border-bottom:1px solid rgba(14,37,64,.6);display:flex;align-items:center;justify-content:space-between}
  .court-slot:last-child{border-bottom:none}
  .slot-day{font-size:9px;color:var(--muted);font-weight:600;letter-spacing:1px;text-transform:uppercase}
  .slot-time{font-size:13px;color:var(--text);font-weight:600;margin-bottom:2px}
  .slot-match{font-size:11px;color:var(--muted);line-height:1.3;max-width:120px}
  .slot-code{background:rgba(61,255,160,.12);color:var(--accent);padding:2px 7px;border-radius:4px;font-family:'Oswald',sans-serif;font-size:12px;font-weight:700}
  .ctag{font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;background:rgba(255,203,71,.15);color:var(--gold)}
  .ctag-r{background:rgba(255,51,85,.12);color:var(--danger)}
  .pos-g{color:var(--gold)}.pos-s{color:var(--silver)}.pos-b{color:var(--bronze)}
  .classif{font-size:9px;color:var(--accent);margin-left:3px}
  .res-set{font-family:'Oswald',sans-serif;font-size:12px;color:var(--text);font-weight:600;background:var(--bg3);padding:2px 7px;border-radius:5px;display:inline-block;margin-right:4px}
  .bracket-wrap{overflow-x:auto;padding-bottom:8px}
  .bracket{display:flex;min-width:max-content}
  .br-round{display:flex;flex-direction:column;width:200px;flex-shrink:0}
  .br-round-hdr{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;color:var(--accent);letter-spacing:2px;text-transform:uppercase;text-align:center;padding:8px 4px;border-bottom:1px solid var(--border)}
  .br-matches{display:flex;flex-direction:column;justify-content:space-around;flex:1;padding:12px 8px;gap:8px}
  .br-match{background:var(--bg3);border:1px solid var(--border);border-radius:9px;overflow:hidden;cursor:pointer;transition:border-color .15s}
  .br-match:hover{border-color:var(--accent)}.br-match.done{border-color:rgba(61,255,160,.3)}
  .br-team{padding:7px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:11px}
  .br-team:last-child{border-bottom:none}
  .br-team.win{color:var(--accent);font-weight:700}.br-team.tbd{color:var(--muted);font-style:italic}
  .br-score{font-family:'Oswald',sans-serif;font-size:11px;font-weight:600}
  .br-schedule{font-size:9px;color:var(--muted);padding:2px 8px;background:rgba(0,0,0,0.2);text-align:center}
  .overlay{position:fixed;inset:0;background:rgba(6,13,24,.9);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:480px;margin:auto}
  .modal-lg{max-width:600px}
  .modal-title{font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;color:var(--text);margin-bottom:20px;letter-spacing:1px;text-transform:uppercase}
  .match-info{background:var(--bg3);border-radius:9px;padding:12px;margin-bottom:20px}
  .match-teams{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
  .match-meta{font-size:11px;color:var(--muted)}
  .score-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px}
  .score-inp{width:52px;text-align:center;font-family:'Oswald',sans-serif;font-size:20px;font-weight:700}
  .score-vs{color:var(--muted);font-size:14px}
  .score-lbl{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);text-align:center;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .winner-banner{text-align:center;padding:10px;background:rgba(61,255,160,.08);border:1px solid rgba(61,255,160,.2);border-radius:9px;margin-bottom:16px}
  .winner-text{font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;color:var(--accent)}
  .set-section{margin-bottom:16px}
  .set-title{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:10px}
  .tb .set-title{color:var(--gold)}
  .pago-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:'DM Sans',sans-serif}
  .pago-ok{background:rgba(61,255,160,.1);color:var(--accent);border:1px solid rgba(61,255,160,.3)}
  .pago-no{background:rgba(255,51,85,.08);color:var(--danger);border:1px solid rgba(255,51,85,.2)}
  .rank-row{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg3);border-radius:10px;margin-bottom:8px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s}
  .rank-row:hover{border-color:var(--accent)}
  .rank-pos{font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:var(--muted);min-width:32px;text-align:center}
  .rank-pos.p1{color:var(--gold)}.rank-pos.p2{color:var(--silver)}.rank-pos.p3{color:var(--bronze)}
  .rank-pts{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:var(--accent)}
  .rank-pts-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  .hist-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-radius:8px;margin-bottom:6px;border:1px solid var(--border)}
  .alert{padding:10px 14px;border-radius:9px;font-size:12px;margin-bottom:16px}
  .alert-warn{background:rgba(255,203,71,.08);border:1px solid rgba(255,203,71,.25);color:var(--gold)}
  .divider{height:1px;background:var(--border);margin:16px 0}
  .restr-toggle{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:9px;border:1px dashed var(--border);background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;width:100%;text-align:left;margin-bottom:12px}
  .restr-toggle.active{background:rgba(61,255,160,.06);border-color:var(--accent);color:var(--accent);border-style:solid}
  .restr-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600;background:rgba(255,51,85,.08);color:var(--danger);border:1px solid rgba(255,51,85,.2);margin:1px 0}
  .restr-ok{background:rgba(61,255,160,.08);color:var(--accent);border-color:rgba(61,255,160,.2)}
  @media(max-width:700px){.grid2,.grid3,.sched-grid{grid-template-columns:1fr}.hero-title{font-size:38px}.nav-tabs{width:100%}}
  .slot-grid{display:flex;gap:12px;overflow-x:auto}
  .slot-day-col{min-width:140px}
  .slot-day-title{font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;color:var(--accent);letter-spacing:1px;margin-bottom:8px;text-transform:uppercase}
  .slot-btn{display:block;width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--muted);font-size:11px;font-weight:500;cursor:pointer;margin-bottom:4px;transition:all .15s;text-align:center}
  .slot-btn:hover{border-color:var(--muted);color:var(--text)}
  .slot-btn.blocked{background:rgba(255,51,85,.12);border-color:rgba(255,51,85,.4);color:var(--danger)}
  .mini-bracket{display:flex;flex-direction:column;gap:6px;margin-top:12px}
  .mini-match{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11px}
  .mini-match-header{font-size:10px;color:var(--accent);font-weight:700;margin-bottom:4px}
  .mini-team{display:flex;justify-content:space-between}
  .mini-team .tbd{color:var(--muted);font-style:italic}
  .zona-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;margin:3px}
  .zona-pill.done{background:rgba(61,255,160,.08);border:1px solid rgba(61,255,160,.3);color:var(--accent)}
  .zona-pill.pending{background:rgba(255,203,71,.06);border:1px solid rgba(255,203,71,.3);color:var(--gold)}
`;
