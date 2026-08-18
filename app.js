/* Murdoku Planer – Layout-, Notizen- und Lösungsmodus für Murdoku-Rätsel. */
(() => {
'use strict';

/* ------------------------------------------------------------------ */
/* Konstanten                                                          */
/* ------------------------------------------------------------------ */

const LS_CURRENT = 'murdoku.current.v1';
const LS_SAVES   = 'murdoku.saves.v1';
const NS = 'http://www.w3.org/2000/svg';

const MIN = 6, MAX = 12;

const FURN = {
  tisch:     { label:'Tisch',     occupiable:false },
  pflanze:   { label:'Pflanze',   occupiable:false },
  fernseher: { label:'Fernseher', occupiable:false },
  regal:     { label:'Regal',     occupiable:false },
  statue:    { label:'Statue',    occupiable:false },
  bett:      { label:'Bett',      occupiable:true  },
  stuhl:     { label:'Stuhl',     occupiable:true  },
  teppich:   { label:'Teppich',   occupiable:true  },
};
const BLOCKERS   = ['tisch','pflanze','fernseher','regal','statue'];
const OCCUPIABLE = ['bett','stuhl','teppich'];

const COLORS = ['#6b46c1','#1f8a70','#c2571f','#2b6cb0','#b0206b','#7a6a1f',
                '#158b8b','#a03030','#4b5aa8','#5f7a1f','#8a4f0f','#3a7d2c'];
const VICTIM_COLOR = '#b3261e';

const LETTERS = 'ABCDEFGHIJKL';

/* ------------------------------------------------------------------ */
/* Zustand                                                             */
/* ------------------------------------------------------------------ */

function newState(cols = 9, rows = 9, suspectCount = 6) {
  const s = {
    version: 1,
    title: '',
    cols, rows,
    furniture: new Array(cols * rows).fill(null),
    vEdges: new Array(rows * (cols + 1)).fill(0),
    hEdges: new Array((rows + 1) * cols).fill(0),
    suspects: [],
    victim: { id: 'v', name: 'Opfer' },
    positions: {},      // tokenId -> cellIndex
    marks: {},          // cellIndex -> {c:{id:1}, n:{id:1}, x:0|1}
    culprit: '',
    opts: { lockLines: true, victimLocks: true },
  };
  setSuspectCount(s, suspectCount);
  setOuterWalls(s);
  return s;
}

function setSuspectCount(s, n) {
  n = clamp(n, 1, 12);
  while (s.suspects.length > n) {
    const gone = s.suspects.pop();
    delete s.positions[gone.id];
    for (const k in s.marks) { delete s.marks[k].c[gone.id]; delete s.marks[k].n[gone.id]; }
    if (s.culprit === gone.id) s.culprit = '';
  }
  while (s.suspects.length < n) {
    const i = s.suspects.length;
    s.suspects.push({ id: 's' + (i + 1), name: 'Verdächtige/r ' + (i + 1), color: COLORS[i % COLORS.length] });
  }
}

function setOuterWalls(s) {
  for (let r = 0; r < s.rows; r++) {
    s.vEdges[vIdx(s, r, 0)] = s.vEdges[vIdx(s, r, 0)] || 1;
    s.vEdges[vIdx(s, r, s.cols)] = s.vEdges[vIdx(s, r, s.cols)] || 1;
  }
  for (let c = 0; c < s.cols; c++) {
    s.hEdges[hIdx(s, 0, c)] = s.hEdges[hIdx(s, 0, c)] || 1;
    s.hEdges[hIdx(s, s.rows, c)] = s.hEdges[hIdx(s, s.rows, c)] || 1;
  }
}

const vIdx = (s, r, c) => r * (s.cols + 1) + c;         // senkrechte Kante links von Spalte c
const hIdx = (s, r, c) => r * s.cols + c;               // waagerechte Kante oben von Zeile r
const cIdx = (s, r, c) => r * s.cols + c;
const rowOf = (s, i) => Math.floor(i / s.cols);
const colOf = (s, i) => i % s.cols;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resizeGrid(cols, rows) {
  cols = clamp(cols, MIN, MAX); rows = clamp(rows, MIN, MAX);
  if (cols === state.cols && rows === state.rows) return;
  const old = state;
  const s = newState(cols, rows, old.suspects.length);
  s.title = old.title;
  s.victim = { ...old.victim };
  s.opts = { ...old.opts };
  s.suspects = old.suspects.map(x => ({ ...x }));
  s.culprit = old.culprit;

  for (let r = 0; r < Math.min(rows, old.rows); r++)
    for (let c = 0; c < Math.min(cols, old.cols); c++)
      s.furniture[cIdx(s, r, c)] = old.furniture[cIdx(old, r, c)];

  for (let r = 0; r < Math.min(rows, old.rows); r++)
    for (let c = 0; c <= Math.min(cols, old.cols); c++)
      if (c > 0 && c < cols) s.vEdges[vIdx(s, r, c)] = old.vEdges[vIdx(old, r, c)] || 0;
  for (let r = 0; r <= Math.min(rows, old.rows); r++)
    for (let c = 0; c < Math.min(cols, old.cols); c++)
      if (r > 0 && r < rows) s.hEdges[hIdx(s, r, c)] = old.hEdges[hIdx(old, r, c)] || 0;
  setOuterWalls(s);

  for (const [tid, idx] of Object.entries(old.positions)) {
    const r = rowOf(old, idx), c = colOf(old, idx);
    if (r < rows && c < cols) s.positions[tid] = cIdx(s, r, c);
  }
  for (const [key, m] of Object.entries(old.marks)) {
    const idx = +key, r = rowOf(old, idx), c = colOf(old, idx);
    if (r < rows && c < cols) s.marks[cIdx(s, r, c)] = m;
  }
  state = s;
}

/* Token-Hilfen ------------------------------------------------------ */

function tokens() {
  return [ { ...state.victim, color: VICTIM_COLOR, short: '☠', victim: true },
           ...state.suspects.map((s, i) => ({ ...s, short: String(i + 1), victim: false })) ];
}
const tokenById = id => tokens().find(t => t.id === id) || null;

function cellToken(idx) {
  for (const [tid, i] of Object.entries(state.positions)) if (i === idx) return tokenById(tid);
  return null;
}

function lockedLines() {
  const rows = new Set(), cols = new Set();
  if (!state.opts.lockLines) return { rows, cols };
  for (const [tid, idx] of Object.entries(state.positions)) {
    if (tid === 'v' && !state.opts.victimLocks) continue;
    rows.add(rowOf(state, idx)); cols.add(colOf(state, idx));
  }
  return { rows, cols };
}

const occupiable = idx => {
  const f = state.furniture[idx];
  return !f || FURN[f].occupiable;
};

function markFor(idx) {
  if (!state.marks[idx]) state.marks[idx] = { c: {}, n: {}, x: 0 };
  const m = state.marks[idx];
  m.c = m.c || {}; m.n = m.n || {};
  return m;
}
function pruneMark(idx) {
  const m = state.marks[idx];
  if (!m) return;
  if (!m.x && !Object.keys(m.c).length && !Object.keys(m.n).length) delete state.marks[idx];
}

/* ------------------------------------------------------------------ */
/* Persistenz                                                          */
/* ------------------------------------------------------------------ */

function save() { try { localStorage.setItem(LS_CURRENT, JSON.stringify(state)); } catch (e) {} }

function loadCurrent() {
  try {
    const raw = localStorage.getItem(LS_CURRENT);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch (e) { return null; }
}

function getSaves() {
  try { return JSON.parse(localStorage.getItem(LS_SAVES) || '{}'); } catch (e) { return {}; }
}
function putSaves(obj) { try { localStorage.setItem(LS_SAVES, JSON.stringify(obj)); } catch (e) { toast('Speicher voll'); } }

function sanitize(o) {
  if (!o || typeof o !== 'object') return null;
  const cols = clamp(+o.cols || 9, MIN, MAX), rows = clamp(+o.rows || 9, MIN, MAX);
  const s = newState(cols, rows, Array.isArray(o.suspects) ? o.suspects.length : 6);
  s.title = typeof o.title === 'string' ? o.title : '';
  if (Array.isArray(o.furniture) && o.furniture.length === cols * rows)
    s.furniture = o.furniture.map(f => (f && FURN[f]) ? f : null);
  if (Array.isArray(o.vEdges) && o.vEdges.length === s.vEdges.length) s.vEdges = o.vEdges.map(v => clamp(+v || 0, 0, 2));
  if (Array.isArray(o.hEdges) && o.hEdges.length === s.hEdges.length) s.hEdges = o.hEdges.map(v => clamp(+v || 0, 0, 2));
  if (Array.isArray(o.suspects))
    s.suspects = o.suspects.map((x, i) => ({
      id: 's' + (i + 1),
      name: String(x && x.name || 'Verdächtige/r ' + (i + 1)).slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(x && x.color) ? x.color : COLORS[i % COLORS.length],
    }));
  if (o.victim && typeof o.victim.name === 'string') s.victim.name = o.victim.name.slice(0, 40);
  const ids = new Set(tokensOf(s).map(t => t.id));
  if (o.positions && typeof o.positions === 'object')
    for (const [tid, idx] of Object.entries(o.positions))
      if (ids.has(tid) && Number.isInteger(idx) && idx >= 0 && idx < cols * rows) s.positions[tid] = idx;
  if (o.marks && typeof o.marks === 'object')
    for (const [k, m] of Object.entries(o.marks)) {
      const idx = +k;
      if (!Number.isInteger(idx) || idx < 0 || idx >= cols * rows || !m) continue;
      const out = { c: {}, n: {}, x: m.x ? 1 : 0 };
      for (const id of Object.keys(m.c || {})) if (ids.has(id)) out.c[id] = 1;
      for (const id of Object.keys(m.n || {})) if (ids.has(id)) out.n[id] = 1;
      if (out.x || Object.keys(out.c).length || Object.keys(out.n).length) s.marks[idx] = out;
    }
  if (typeof o.culprit === 'string' && (o.culprit === '' || ids.has(o.culprit))) s.culprit = o.culprit;
  if (o.opts) s.opts = { lockLines: o.opts.lockLines !== false, victimLocks: o.opts.victimLocks !== false };
  return s;
}
function tokensOf(s) { return [{ id: 'v' }, ...s.suspects]; }

/* ------------------------------------------------------------------ */
/* Undo / Redo                                                         */
/* ------------------------------------------------------------------ */

let undoStack = [], redoStack = [];

function commit(fn) {
  const before = JSON.stringify(state);
  fn();
  const after = JSON.stringify(state);
  if (before === after) return;
  undoStack.push(before);
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  render();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = sanitize(JSON.parse(undoStack.pop()));
  render();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = sanitize(JSON.parse(redoStack.pop()));
  render();
}

/* ------------------------------------------------------------------ */
/* UI-Zustand                                                          */
/* ------------------------------------------------------------------ */

let state = loadCurrent() || newState();
let mode = 'layout';
let tool = { layout: 'wall', draft: 'cand', solution: 'place' };
let selected = 's1';

const $  = sel => document.querySelector(sel);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  document.body.classList.toggle('edit-edges', mode === 'layout' && tool.layout === 'wall');
  for (const b of document.querySelectorAll('.mode')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
  $('#puzzle-title').value = state.title;
  $('#btn-undo').disabled = !undoStack.length;
  $('#btn-redo').disabled = !redoStack.length;
  renderToolbar();
  renderBoard();
  renderPanel();
  renderCulprit();
  renderHint();
  save();
}

/* --- Werkzeugleiste --- */

function toolBtn(id, label, iconId, extra) {
  const b = el('button', 'tool');
  b.type = 'button';
  b.dataset.tool = id;
  b.setAttribute('aria-pressed', String(tool[mode] === id));
  if (iconId) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('viewBox', '0 0 24 24');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#' + iconId);
    svg.appendChild(use); b.appendChild(svg);
  }
  if (extra) b.appendChild(extra);
  b.appendChild(document.createTextNode(label));
  b.onclick = () => { tool[mode] = id; render(); };
  return b;
}

function tokenBtn(t) {
  const dot = el('span', 'swatch');
  dot.style.background = t.color;
  const b = el('button', 'tool');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(selected === t.id && tool[mode] !== 'erase' && tool[mode] !== 'x'));
  b.appendChild(dot);
  b.appendChild(document.createTextNode(t.victim ? t.name : `${t.short} · ${t.name}`));
  b.onclick = () => {
    selected = t.id;
    if (mode === 'solution') tool.solution = 'place';
    if (mode === 'draft' && (tool.draft === 'x' || tool.draft === 'erase')) tool.draft = 'cand';
    render();
  };
  return b;
}

function group(label, nodes) {
  const g = el('div', 'tgroup');
  if (label) g.appendChild(el('span', 'tgroup-label', label));
  nodes.forEach(n => g.appendChild(n));
  return g;
}

function renderToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = '';

  if (mode === 'layout') {
    tb.appendChild(group('Wände', [
      toolBtn('wall', 'Wand / Fenster'),
      btn('Außenwände', () => commit(() => setOuterWalls(state)), 'small ghost'),
      btn('Wände löschen', () => commit(() => {
        state.vEdges.fill(0); state.hEdges.fill(0); setOuterWalls(state);
      }), 'small ghost'),
    ]));
    tb.appendChild(group('Blocker', BLOCKERS.map(k => toolBtn(k, FURN[k].label, 'ic-' + k))));
    tb.appendChild(group('Belegbar', OCCUPIABLE.map(k => toolBtn(k, FURN[k].label, 'ic-' + k))));
    const vic = tokens()[0];
    tb.appendChild(group('Sonst', [
      (() => { const b = toolBtn('victim', vic.name); const d = el('span', 'swatch'); d.style.background = VICTIM_COLOR; b.insertBefore(d, b.firstChild); return b; })(),
      toolBtn('erase', 'Radierer'),
    ]));
  }

  if (mode === 'draft') {
    tb.appendChild(group('Art', [
      toolBtn('cand', 'Kandidat'),
      toolBtn('no', 'Ausschluss'),
      toolBtn('x', 'X (Feld frei)'),
      toolBtn('erase', 'Radierer'),
    ]));
    tb.appendChild(group('Person', tokens().map(tokenBtn)));
  }

  if (mode === 'solution') {
    tb.appendChild(group('Person', tokens().map(tokenBtn)));
    tb.appendChild(group('', [
      toolBtn('erase', 'Entfernen'),
      btn('Prüfen', checkSolution, 'small ghost'),
    ]));
  }
}

function btn(label, onClick, cls) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.type = 'button'; b.onclick = onClick;
  return b;
}

/* --- Spielfeld --- */

function renderBoard() {
  const board = $('#board'), cells = $('#cells');
  board.style.setProperty('--cols', state.cols);
  board.style.setProperty('--rows', state.rows);
  $('.boardwrap').style.setProperty('--cols', state.cols);
  $('.boardwrap').style.setProperty('--rows', state.rows);

  const cl = $('#collabels'), rl = $('#rowlabels');
  cl.innerHTML = ''; rl.innerHTML = '';
  for (let c = 0; c < state.cols; c++) cl.appendChild(el('span', null, LETTERS[c]));
  for (let r = 0; r < state.rows; r++) rl.appendChild(el('span', null, String(r + 1)));

  const locked = lockedLines();
  cells.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const idx = cIdx(state, r, c);
      const cell = el('div', 'cell');
      cell.dataset.idx = idx;
      if ((r + c) % 2) cell.classList.add('alt');
      if (c === state.cols - 1) cell.classList.add('no-right');
      if (r === state.rows - 1) cell.classList.add('no-bottom');

      const tok = cellToken(idx);
      if (!tok && (locked.rows.has(r) || locked.cols.has(c))) cell.classList.add('dim');

      const f = state.furniture[idx];
      if (f) {
        if (!FURN[f].occupiable) cell.classList.add('notoccupy');
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'furn'); svg.setAttribute('viewBox', '0 0 24 24');
        const use = document.createElementNS(NS, 'use');
        use.setAttribute('href', '#ic-' + f);
        svg.appendChild(use);
        cell.appendChild(svg);
        cell.title = FURN[f].label + (FURN[f].occupiable ? ' (belegbar)' : ' (nicht belegbar)');
      }

      const m = state.marks[idx];
      if (m && m.x) cell.appendChild(el('div', 'xmark', '✕'));
      if (m && (Object.keys(m.c).length || Object.keys(m.n).length)) {
        const wrap = el('div', 'marks');
        for (const t of tokens()) {
          if (m.c[t.id]) { const d = el('div', 'mark', t.short); d.style.background = t.color; wrap.appendChild(d); }
        }
        for (const t of tokens()) {
          if (m.n[t.id]) { const d = el('div', 'mark no', t.short); d.style.color = t.color; wrap.appendChild(d); }
        }
        cell.appendChild(wrap);
      }

      if (tok) {
        const d = el('div', 'token' + (tok.victim ? ' victim' : ''), tok.short);
        d.style.background = tok.color;
        d.title = tok.name;
        cell.appendChild(d);
      }

      frag.appendChild(cell);
    }
  }
  cells.appendChild(frag);
  renderEdges();
}

function renderEdges() {
  const svg = $('#edges');
  svg.setAttribute('viewBox', `0 0 ${state.cols} ${state.rows}`);
  svg.innerHTML = '';

  const line = (cls, x1, y1, x2, y2) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('class', cls);
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    svg.appendChild(l);
    return l;
  };
  const drawWall = (v, x1, y1, x2, y2) => {
    if (v === 1) { line('wall', x1, y1, x2, y2); return; }
    // Fenster: Wand mit ausgespartem Mittelteil + Glasstrich
    line('win-base', x1, y1, x2, y2);
    const ax = x1 + (x2 - x1) * 0.25, ay = y1 + (y2 - y1) * 0.25;
    const bx = x1 + (x2 - x1) * 0.75, by = y1 + (y2 - y1) * 0.75;
    line('win-gap', ax, ay, bx, by);
    line('win-glass', ax, ay, bx, by);
    // Kappen an den Fensterenden
    const nx = (y2 - y1) * 0.09, ny = (x2 - x1) * 0.09;
    line('win-tick', ax - nx, ay - ny, ax + nx, ay + ny);
    line('win-tick', bx - nx, by - ny, bx + nx, by + ny);
  };

  for (let r = 0; r < state.rows; r++)
    for (let c = 0; c <= state.cols; c++) {
      const v = state.vEdges[vIdx(state, r, c)];
      if (v) drawWall(v, c, r, c, r + 1);
    }
  for (let r = 0; r <= state.rows; r++)
    for (let c = 0; c < state.cols; c++) {
      const v = state.hEdges[hIdx(state, r, c)];
      if (v) drawWall(v, c, r, c + 1, r);
    }

  // Klickflächen zuletzt (liegen oben)
  for (let r = 0; r < state.rows; r++)
    for (let c = 0; c <= state.cols; c++) {
      const l = line('hit', c, r, c, r + 1);
      l.dataset.kind = 'v'; l.dataset.r = r; l.dataset.c = c;
    }
  for (let r = 0; r <= state.rows; r++)
    for (let c = 0; c < state.cols; c++) {
      const l = line('hit', c, r, c + 1, r);
      l.dataset.kind = 'h'; l.dataset.r = r; l.dataset.c = c;
    }
}

/* --- Seitenleiste --- */

function section(title, nodes) {
  const s = el('section');
  if (title) s.appendChild(el('h2', null, title));
  nodes.forEach(n => s.appendChild(n));
  return s;
}

function stepper(label, value, onChange) {
  const f = el('div', 'field');
  f.appendChild(el('label', null, label));
  const wrap = el('div', 'stepper');
  const minus = btn('−', () => onChange(value - 1), 'small ghost');
  const inp = el('input'); inp.type = 'number'; inp.value = value; inp.min = MIN; inp.max = MAX;
  inp.onchange = () => onChange(+inp.value);
  const plus = btn('+', () => onChange(value + 1), 'small ghost');
  wrap.append(minus, inp, plus);
  f.appendChild(wrap);
  return f;
}

function checkbox(label, checked, onChange) {
  const l = el('label', 'checkbox');
  const i = el('input'); i.type = 'checkbox'; i.checked = checked;
  i.onchange = () => onChange(i.checked);
  l.append(i, document.createTextNode(label));
  return l;
}

function renderPanel() {
  const p = $('#panel');
  p.innerHTML = '';

  if (mode === 'layout') {
    p.appendChild(section('Raster', [
      stepper('Spalten', state.cols, v => commit(() => resizeGrid(v, state.rows))),
      stepper('Zeilen',  state.rows, v => commit(() => resizeGrid(state.cols, v))),
      (() => { const r = el('div', 'row'); r.style.marginTop = '8px';
        r.appendChild(btn('Möbel löschen', () => commit(() => { state.furniture.fill(null); }), 'small ghost'));
        r.appendChild(btn('Neues Rätsel', () => {
          if (!confirm('Alles zurücksetzen?')) return;
          commit(() => { state = newState(state.cols, state.rows, state.suspects.length); });
        }, 'small ghost danger'));
        return r; })(),
    ]));

    const list = el('div');
    const vicRow = el('div', 'suspect-row');
    const vsw = el('div', 'swatch'); vsw.style.background = VICTIM_COLOR; vsw.style.borderRadius = '20%';
    const vin = el('input'); vin.type = 'text'; vin.value = state.victim.name; vin.maxLength = 40;
    vin.onchange = () => commit(() => { state.victim.name = vin.value.trim() || 'Opfer'; });
    vicRow.append(vsw, vin);
    list.appendChild(vicRow);

    state.suspects.forEach((s, i) => {
      const row = el('div', 'suspect-row');
      const col = el('input', 'swatch'); col.type = 'color'; col.value = s.color;
      const origColor = s.color;
      col.oninput = () => { s.color = col.value; renderBoard(); };
      col.onchange = () => { const v = col.value; s.color = origColor; commit(() => { s.color = v; }); };
      const name = el('input'); name.type = 'text'; name.value = s.name; name.maxLength = 40;
      name.onchange = () => commit(() => { s.name = name.value.trim() || 'Verdächtige/r ' + (i + 1); });
      const num = el('span', null, String(i + 1)); num.style.cssText = 'font-weight:800;width:14px;text-align:center';
      row.append(num, col, name);
      list.appendChild(row);
    });

    p.appendChild(section('Personen', [
      stepper('Verdächtige', state.suspects.length, v => commit(() => setSuspectCount(state, v))),
      list,
    ]));

    p.appendChild(section('Regeln', [
      checkbox('Reihe & Spalte nach Lösung sperren', state.opts.lockLines, v => commit(() => { state.opts.lockLines = v; })),
      checkbox('Opfer sperrt Reihe & Spalte', state.opts.victimLocks, v => commit(() => { state.opts.victimLocks = v; })),
    ]));
  }

  if (mode === 'draft') {
    const legend = el('div', 'legend');
    const add = (txt, node) => { const d = el('div'); if (node) d.appendChild(node); d.appendChild(document.createTextNode(txt)); legend.appendChild(d); };
    const chip = (cls, color) => { const m = el('div', 'mark ' + (cls || ''), '1'); m.style.cssText = `width:20px;height:20px;min-width:20px;flex:0 0 auto;${cls === 'no' ? 'color:' + color : 'background:' + color}`; return m; };
    add(' Kandidat: Person kommt hier in Frage', chip('', COLORS[0]));
    add(' Ausschluss: Person kann hier nicht stehen', chip('no', COLORS[0]));
    add(' X: Feld bleibt leer', el('span', null, '✕'));
    p.appendChild(section('Legende', [legend]));
    p.appendChild(section('Aufräumen', [
      btn('Alle Notizen löschen', () => commit(() => { state.marks = {}; }), 'small ghost danger'),
      btn('Notizen in gesperrten Reihen löschen', () => commit(() => {
        const locked = lockedLines();
        for (const key of Object.keys(state.marks)) {
          const i = +key;
          if (state.positions && cellToken(i)) continue;
          if (locked.rows.has(rowOf(state, i)) || locked.cols.has(colOf(state, i))) delete state.marks[key];
        }
      }), 'small ghost'),
    ]));
  }

  if (mode === 'solution') {
    const list = el('div', 'placed-list');
    for (const t of tokens()) {
      const idx = state.positions[t.id];
      const row = el('div', 'pl');
      const dot = el('div', 'dot'); dot.style.background = t.color;
      if (t.victim) dot.style.borderRadius = '20%';
      const label = el('span', null, `${t.victim ? '' : t.short + ' · '}${t.name}: ` +
        (idx == null ? '—' : `${LETTERS[colOf(state, idx)]}${rowOf(state, idx) + 1}`));
      row.append(dot, label);
      if (idx != null) row.appendChild(btn('×', () => commit(() => { delete state.positions[t.id]; }), 'small ghost'));
      list.appendChild(row);
    }
    p.appendChild(section('Platzierungen', [list]));
    p.appendChild(section('Aufräumen', [
      btn('Lösung löschen', () => commit(() => { state.positions = {}; state.culprit = ''; }), 'small ghost danger'),
    ]));
  }

  /* Datei-Sektion in jedem Modus */
  const saves = getSaves();
  const nameInput = el('input', 'text-input'); nameInput.type = 'text'; nameInput.placeholder = 'Name'; nameInput.value = state.title || '';
  const saveRow = el('div', 'row');
  saveRow.append(nameInput, btn('Speichern', () => {
    const n = (nameInput.value.trim() || state.title.trim() || 'Rätsel ' + new Date().toLocaleDateString('de-DE'));
    const all = getSaves(); all[n] = JSON.parse(JSON.stringify(state)); putSaves(all);
    toast('Gespeichert: ' + n); renderPanel();
  }, 'small'));

  const savesList = el('div', 'saves');
  const names = Object.keys(saves).sort();
  if (!names.length) savesList.appendChild(el('div', null, 'Noch nichts gespeichert.'));
  names.forEach(n => {
    const row = el('div', 'save-row');
    row.appendChild(el('span', null, n));
    row.appendChild(btn('Laden', () => {
      commit(() => { const s = sanitize(getSaves()[n]); if (s) state = s; });
      toast('Geladen: ' + n);
    }, 'small ghost'));
    row.appendChild(btn('×', () => {
      const all = getSaves(); delete all[n]; putSaves(all); renderPanel();
    }, 'small ghost danger'));
    savesList.appendChild(row);
  });

  const io = el('div', 'row');
  io.append(
    btn('Export', exportJSON, 'small ghost'),
    btn('Import', () => $('#file-import').click(), 'small ghost'),
  );

  p.appendChild(section('Rätsel speichern', [saveRow, savesList, io]));
}

function renderCulprit() {
  const sel = $('#culprit-select');
  sel.innerHTML = '';
  const none = el('option', null, '—'); none.value = '';
  sel.appendChild(none);
  for (const t of state.suspects) {
    const o = el('option', null, t.name); o.value = t.id;
    sel.appendChild(o);
  }
  sel.value = state.culprit || '';
}

const HINTS = {
  layout: 'Klick auf eine Kante: Wand → Fenster → weg. Rechtsklick löscht die Kante. Möbel-Werkzeug wählen und ins Feld klicken (nochmal klicken entfernt).',
  draft:  'Person wählen, dann ins Feld klicken: Kandidat bzw. Ausschluss setzen. Rechtsklick setzt immer einen Ausschluss.',
  solution: 'Person wählen und Feld anklicken. Gelöste Reihen und Spalten werden ausgegraut. Rechtsklick entfernt eine Platzierung.',
};
function renderHint() { $('#hint').textContent = HINTS[mode]; }

/* ------------------------------------------------------------------ */
/* Interaktion                                                         */
/* ------------------------------------------------------------------ */

function onCell(idx, secondary) {
  const t = tool[mode];

  if (mode === 'layout') {
    if (t === 'victim') {
      commit(() => {
        if (secondary || state.positions.v === idx) { delete state.positions.v; return; }
        if (!occupiable(idx)) { toast('Feld ist blockiert'); return; }
        state.positions.v = idx;
      });
      return;
    }
    if (t === 'erase') { commit(() => { state.furniture[idx] = null; }); return; }
    if (FURN[t]) {
      commit(() => {
        if (secondary || state.furniture[idx] === t) { state.furniture[idx] = null; return; }
        state.furniture[idx] = t;
        if (!FURN[t].occupiable) {
          for (const [tid, i] of Object.entries(state.positions)) if (i === idx) delete state.positions[tid];
          const m = state.marks[idx]; if (m) { m.c = {}; m.n = {}; pruneMark(idx); }
        }
      });
      return;
    }
    return;
  }

  if (mode === 'draft') {
    commit(() => {
      if (t === 'erase' || (secondary && t === 'x')) { delete state.marks[idx]; return; }
      if (t === 'x') { const m = markFor(idx); m.x = m.x ? 0 : 1; pruneMark(idx); return; }
      const tok = tokenById(selected);
      if (!tok) return;
      if (!occupiable(idx) && !secondary && t === 'cand') { toast('Feld kann nicht besetzt werden'); return; }
      const m = markFor(idx);
      const kind = (secondary || t === 'no') ? 'n' : 'c';
      const other = kind === 'c' ? 'n' : 'c';
      if (m[kind][tok.id]) delete m[kind][tok.id];
      else { m[kind][tok.id] = 1; delete m[other][tok.id]; }
      pruneMark(idx);
    });
    return;
  }

  if (mode === 'solution') {
    const existing = cellToken(idx);
    if (t === 'erase' || secondary) {
      if (existing) commit(() => { delete state.positions[existing.id]; });
      return;
    }
    const tok = tokenById(selected);
    if (!tok) return;
    if (existing && existing.id === tok.id) { commit(() => { delete state.positions[tok.id]; }); return; }
    if (!occupiable(idx)) { toast('Dieses Feld kann nicht besetzt werden'); return; }
    if (existing) { toast('Feld ist schon belegt'); return; }
    const locked = lockedLines();
    const r = rowOf(state, idx), c = colOf(state, idx);
    const cur = state.positions[tok.id];
    const curR = cur == null ? -1 : rowOf(state, cur), curC = cur == null ? -1 : colOf(state, cur);
    const rowBusy = locked.rows.has(r) && r !== curR;
    const colBusy = locked.cols.has(c) && c !== curC;
    if (state.opts.lockLines && (rowBusy || colBusy)) {
      toast('Reihe/Spalte ist bereits belegt');
      return;
    }
    commit(() => {
      state.positions[tok.id] = idx;
      const m = state.marks[idx]; if (m) { m.c = {}; m.n = {}; pruneMark(idx); }
    });
  }
}

function onEdge(kind, r, c, secondary) {
  if (mode !== 'layout' || tool.layout !== 'wall') return;
  commit(() => {
    const arr = kind === 'v' ? state.vEdges : state.hEdges;
    const i = kind === 'v' ? vIdx(state, r, c) : hIdx(state, r, c);
    arr[i] = secondary ? 0 : (arr[i] + 1) % 3;
  });
}

function checkSolution() {
  const problems = [];
  const rows = {}, cols = {};
  for (const [tid, idx] of Object.entries(state.positions)) {
    const t = tokenById(tid); if (!t) continue;
    if (!occupiable(idx)) problems.push(`${t.name} steht auf einem blockierten Feld.`);
    const r = rowOf(state, idx), c = colOf(state, idx);
    (rows[r] = rows[r] || []).push(t.name);
    (cols[c] = cols[c] || []).push(t.name);
  }
  for (const [r, list] of Object.entries(rows)) if (list.length > 1) problems.push(`Zeile ${+r + 1}: ${list.join(', ')}`);
  for (const [c, list] of Object.entries(cols)) if (list.length > 1) problems.push(`Spalte ${LETTERS[c]}: ${list.join(', ')}`);
  const missing = tokens().filter(t => state.positions[t.id] == null);
  if (missing.length) problems.push(`Noch offen: ${missing.map(t => t.name).join(', ')}`);
  toast(problems.length ? problems.join(' · ') : 'Alles stimmig ✓');
}

function exportJSON() {
  const name = (state.title.trim() || 'murdoku').replace(/[^\w\-äöüÄÖÜß ]+/g, '').replace(/\s+/g, '-');
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

$('#modes').addEventListener('click', e => {
  const b = e.target.closest('.mode');
  if (!b) return;
  mode = b.dataset.mode;
  render();
});

const board = $('#board');
board.addEventListener('contextmenu', e => { e.preventDefault(); handleBoard(e, true); });
board.addEventListener('click', e => handleBoard(e, false));

function handleBoard(e, secondary) {
  const hit = e.target.closest ? e.target.closest('.hit') : null;
  if (hit && hit.classList.contains('hit')) {
    onEdge(hit.dataset.kind, +hit.dataset.r, +hit.dataset.c, secondary || e.shiftKey);
    return;
  }
  const cell = e.target.closest('.cell');
  if (cell) onCell(+cell.dataset.idx, secondary || e.shiftKey);
}

$('#puzzle-title').addEventListener('change', e => commit(() => { state.title = e.target.value.slice(0, 60); }));
$('#culprit-select').addEventListener('change', e => commit(() => { state.culprit = e.target.value; }));
$('#btn-undo').onclick = undo;
$('#btn-redo').onclick = redo;
$('#btn-print').onclick = () => window.print();
$('#btn-panel').onclick = () => document.body.classList.toggle('panel-hidden');

$('#file-import').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const s = sanitize(JSON.parse(fr.result));
      if (!s) throw new Error('ungültig');
      commit(() => { state = s; });
      toast('Importiert');
    } catch (err) { toast('Datei konnte nicht gelesen werden'); }
  };
  fr.readAsText(file);
  e.target.value = '';
});

document.addEventListener('keydown', e => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) {
    const t = state.suspects[+e.key - 1];
    if (t) { selected = t.id; render(); }
    return;
  }
  if (e.key === '0') { selected = 'v'; render(); return; }
  const map = { l: 'layout', n: 'draft', s: 'solution' };
  if (map[e.key.toLowerCase()]) { mode = map[e.key.toLowerCase()]; render(); }
});

render();
})();
