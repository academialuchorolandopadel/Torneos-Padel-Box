// Constantes del dominio: canchas, horarios, puntos por etapa, categorías.
// Si cambian los horarios del torneo o la tabla de puntos, se toca acá.

export const uid = () => Math.random().toString(36).slice(2, 9);

export const COURTS = ["BOX 3", "BOX 2", "BOX 1"];

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const n = (x) => parseInt(x) || 0;

export const MIN_GAP = 300;

export const MIN_GAP_KO_SAME_DAY = 120;

export const MIN_GAP_KO_DIFF_DAY = 180;

export const SLOT_DEFS = [
  { dia: "JUEVES", hora: "19:00", mins: 1140, bloque: "jue_noche" },
  { dia: "JUEVES", hora: "20:15", mins: 1215, bloque: "jue_noche" },
  { dia: "JUEVES", hora: "21:30", mins: 1290, bloque: "jue_noche" },
  { dia: "VIERNES", hora: "19:00", mins: 2580, bloque: "vie_noche" },
  { dia: "VIERNES", hora: "20:15", mins: 2655, bloque: "vie_noche" },
  { dia: "VIERNES", hora: "21:30", mins: 2730, bloque: "vie_noche" },
  { dia: "SÁBADO", hora: "9:00", mins: 3420, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "10:15", mins: 3495, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "11:30", mins: 3570, bloque: "sab_man" },
  { dia: "SÁBADO", hora: "13:00", mins: 3660, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "14:15", mins: 3735, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "15:30", mins: 3810, bloque: "sab_tarde" },
  { dia: "SÁBADO", hora: "17:00", mins: 3900, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "18:15", mins: 3975, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "19:30", mins: 4050, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "20:45", mins: 4125, bloque: "sab_noche" },
  { dia: "SÁBADO", hora: "22:00", mins: 4200, bloque: "sab_noche" },
  { dia: "DOMINGO", hora: "9:00", mins: 4860, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "10:15", mins: 4935, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "11:30", mins: 5010, bloque: "dom_man" },
  { dia: "DOMINGO", hora: "13:00", mins: 5100, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "14:15", mins: 5175, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "15:30", mins: 5250, bloque: "dom_tarde" },
  { dia: "DOMINGO", hora: "17:00", mins: 5340, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "18:15", mins: 5415, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "19:30", mins: 5490, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "20:45", mins: 5565, bloque: "dom_noche" },
  { dia: "DOMINGO", hora: "22:00", mins: 5640, bloque: "dom_noche" },
];

export const ALL_SLOTS = SLOT_DEFS.flatMap((s) => COURTS.map((c) => ({ ...s, cancha: c })));

export const BLOQUE_TO_SLOTS = {};

SLOT_DEFS.forEach(s => {
  if (!BLOQUE_TO_SLOTS[s.bloque]) BLOQUE_TO_SLOTS[s.bloque] = [];
  BLOQUE_TO_SLOTS[s.bloque].push(`${s.dia}|${s.hora}`);
});

export const STAGE_PTS = { campeon:100, finalista:75, semifinal:50, cuartos:25, octavos:15, dieciseisavos:12, zona:10 };

export const STAGE_LABEL = { campeon:"🥇 Campeón", finalista:"🥈 Finalista", semifinal:"🥉 Semifinal", cuartos:"⚡ Cuartos", octavos:"📋 Octavos", dieciseisavos:"🎯 16avos", zona:"📍 Zona" };

export const AMERICANO_STAGE_PTS={campeon:30,finalista:20,semifinal:15,cuartos:10,octavos:5,dieciseisavos:5,zona:5};

// Americanos todos contra todos: puntos y etapa según la posición final (índice = posición).
// Del 9° en adelante: 5 puntos, etapa "zona".
export const AMERICANO_POS_PTS=[0,30,20,15,15,10,10,5,5];

export const AMERICANO_POS_STAGE=["","campeon","finalista","semifinal","semifinal","cuartos","cuartos","zona","zona"];

export const ROUND_NAMES_BY_SIZE = {
  2: ["FINAL"],
  4: ["SEMIS", "FINAL"],
  8: ["CUARTOS", "SEMIS", "FINAL"],
  16: ["OCTAVOS", "CUARTOS", "SEMIS", "FINAL"],
  32: ["16avos", "OCTAVOS", "CUARTOS", "SEMIS", "FINAL"],
};

export const CATEGORY_COLORS = [
  { bg: "rgba(61,255,160,.12)", border: "rgba(61,255,160,.4)" },
  { bg: "rgba(255,100,180,.12)", border: "rgba(255,100,180,.4)" },
  { bg: "rgba(255,203,71,.12)", border: "rgba(255,203,71,.4)" },
  { bg: "rgba(0,212,255,.12)", border: "rgba(0,212,255,.4)" },
  { bg: "rgba(180,100,255,.12)", border: "rgba(180,100,255,.4)" },
  { bg: "rgba(255,140,60,.12)", border: "rgba(255,140,60,.4)" },
  { bg: "rgba(255,80,100,.12)", border: "rgba(255,80,100,.4)" },
  { bg: "rgba(100,200,255,.12)", border: "rgba(100,200,255,.4)" },
];

export const CAT_LABELS={1:"1ra",2:"2da",3:"3ra",4:"4ta",5:"5ta",6:"6ta",7:"7ma",8:"8va"};

export const CAT_COLORS={1:"rgba(255,80,100,.15)",2:"rgba(255,140,60,.15)",3:"rgba(255,203,71,.15)",4:"rgba(180,100,255,.15)",5:"rgba(0,212,255,.15)",6:"rgba(61,255,160,.15)",7:"rgba(100,200,255,.15)",8:"rgba(100,130,160,.15)"};

export const CAT_NUM=Object.fromEntries(Object.entries(CAT_LABELS).map(([k,v])=>[v.toLowerCase(),Number(k)]));

// Enlaces oficiales FIP — actualizar acá si la federación cambia alguna URL
export const GENERO_LABELS={M:"Hombres",F:"Mujeres"};

export const GENERO_COLORS={
  M:{bg:"rgba(0,212,255,.08)",border:"rgba(0,212,255,.35)",text:"var(--accent2)"},
  F:{bg:"rgba(255,100,180,.08)",border:"rgba(255,100,180,.35)",text:"#ff64b4"},
};

export const FIP_LINKS=[
  {label:"Reglamento de juego",archivo:"FIP_Reglas-del-Padel.pdf",url:"https://share.google/2VMryftojywfpxf2w"},
  {label:"Código de ética",archivo:"Codigo-Etico-FIP-2024-1.pdf",url:"https://share.google/LJMRIlu40aCpIr49x"},
  {label:"Código de disciplina",archivo:"Codigo-de-Disciplina-aprobado.pdf",url:"https://share.google/3Btq89O0s8USsq2mh"},
];
