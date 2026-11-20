// Sudoku core: logical solver with technique tiers, flow metric, generator.
const ROW = new Int8Array(81), COL = new Int8Array(81), BOX = new Int8Array(81);
for (let i = 0; i < 81; i++) { const r = (i / 9) | 0, c = i % 9; ROW[i] = r; COL[i] = c; BOX[i] = ((r / 3) | 0) * 3 + ((c / 3) | 0); }
const UNITS = [];
for (let r = 0; r < 9; r++) { const u = []; for (let c = 0; c < 9; c++) u.push(r * 9 + c); UNITS.push(u); }
for (let c = 0; c < 9; c++) { const u = []; for (let r = 0; r < 9; r++) u.push(r * 9 + c); UNITS.push(u); }
for (let b = 0; b < 9; b++) { const u = []; const r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((r0 + r) * 9 + c0 + c); UNITS.push(u); }
const PEERS = [];
for (let i = 0; i < 81; i++) { const p = []; for (let j = 0; j < 81; j++) if (j !== i && (ROW[i] === ROW[j] || COL[i] === COL[j] || BOX[i] === BOX[j])) p.push(j); PEERS.push(p); }
const POP = new Int8Array(512), DIG = new Int8Array(512);
for (let m = 0; m < 512; m++) { let n = 0; for (let b = 0; b < 9; b++) if (m & (1 << b)) n++; POP[m] = n; }
for (let d = 1; d <= 9; d++) DIG[1 << (d - 1)] = d;
const sees = (a, b) => a !== b && (ROW[a] === ROW[b] || COL[a] === COL[b] || BOX[a] === BOX[b]);

let rng = Math.random;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function randomSolution() {
  const g = new Int8Array(81), rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const orders = []; for (let i = 0; i < 81; i++) orders.push(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  (function rec(i) {
    if (i === 81) return true;
    const r = ROW[i], c = COL[i], b = BOX[i], used = rows[r] | cols[c] | boxes[b];
    for (const d of orders[i]) {
      const bit = 1 << (d - 1); if (used & bit) continue;
      g[i] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (rec(i + 1)) return true;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    g[i] = 0; return false;
  })(0);
  return g;
}

function combos(arr, k, start, cur, out) {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); }
  return out;
}

// ---- Solver state ----
function makeState(puz) {
  const vals = Int8Array.from(puz), cands = new Uint16Array(81);
  for (let i = 0; i < 81; i++) if (!vals[i]) {
    let used = 0; for (const p of PEERS[i]) if (vals[p]) used |= 1 << (vals[p] - 1);
    cands[i] = 511 & ~used;
  }
  return { vals, cands };
}
function place(st, i, d) {
  st.vals[i] = d; st.cands[i] = 0; const nb = ~(1 << (d - 1));
  for (const p of PEERS[i]) st.cands[p] &= nb;
}
// Fills out[i]=digit for each placeable cell; returns {n, kind[]}
function findSingles(st, out, kind) {
  const { vals, cands } = st; let n = 0;
  for (let i = 0; i < 81; i++) if (!vals[i]) { const m = cands[i]; if (m && !(m & (m - 1))) { out[i] = DIG[m]; if (kind) kind[i] = 1; n++; } }
  for (let u = 0; u < 27; u++) {
    const U = UNITS[u]; let once = 0, twice = 0;
    for (let k = 0; k < 9; k++) { const m = cands[U[k]]; twice |= once & m; once |= m; }
    let ex = once & ~twice;
    while (ex) {
      const b = ex & -ex; ex ^= b;
      for (let k = 0; k < 9; k++) { const c = U[k]; if (cands[c] & b) { if (!out[c]) { out[c] = DIG[b]; if (kind) kind[c] = 2 + (u / 9 | 0); n++; } break; } }
    }
  }
  return n;
}

// Each technique: returns null or {tech, elims:[[cell, mask]...], cells:[...]} (does not apply)
function elimsFrom(list) { return list.length ? list : null; }

function pointing(st, acc) {
  const { cands } = st;
  for (let b = 0; b < 9; b++) {
    const U = UNITS[18 + b];
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d; let rs = -1, cs = -1, cnt = 0, rowOk = true, colOk = true; const cells = [];
      for (const c of U) if (cands[c] & bit) { cells.push(c); if (rs < 0) { rs = ROW[c]; cs = COL[c]; } else { if (ROW[c] !== rs) rowOk = false; if (COL[c] !== cs) colOk = false; } cnt++; }
      if (cnt < 2) continue;
      if (rowOk) { const el = []; for (const c of UNITS[rs]) if (BOX[c] !== b && (cands[c] & bit)) el.push([c, bit]); if (el.length) { acc.push({ tech: 'Pointing', elims: el, cells, digit: d + 1 }); if (acc.length >= acc.limit) return true; } }
      if (colOk) { const el = []; for (const c of UNITS[9 + cs]) if (BOX[c] !== b && (cands[c] & bit)) el.push([c, bit]); if (el.length) { acc.push({ tech: 'Pointing', elims: el, cells, digit: d + 1 }); if (acc.length >= acc.limit) return true; } }
    }
  }
  return null;
}
function claiming(st, acc) {
  const { cands } = st;
  for (let u = 0; u < 18; u++) {
    const U = UNITS[u];
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d; let bx = -1, ok = true; const cells = [];
      for (const c of U) if (cands[c] & bit) { cells.push(c); if (bx < 0) bx = BOX[c]; else if (BOX[c] !== bx) { ok = false; break; } }
      if (!ok || cells.length < 2) continue;
      const el = []; for (const c of UNITS[18 + bx]) if (!U.includes(c) && (cands[c] & bit)) el.push([c, bit]);
      if (el.length) { acc.push({ tech: 'Box-line', elims: el, cells, digit: d + 1 }); if (acc.length >= acc.limit) return true; }
    }
  }
  return null;
}
function nakedSubset(st, k, acc) {
  const { cands } = st;
  for (let u = 0; u < 27; u++) {
    const U = UNITS[u]; const pool = U.filter(c => cands[c] && POP[cands[c]] >= 2 && POP[cands[c]] <= k);
    if (pool.length < k) continue;
    for (const cb of combos(pool, k, 0, [], [])) {
      let un = 0; for (const c of cb) un |= cands[c];
      if (POP[un] !== k) continue;
      const el = []; for (const c of U) if (!cb.includes(c) && (cands[c] & un)) el.push([c, cands[c] & un]);
      if (el.length) { acc.push({ tech: k === 2 ? 'Naked pair' : 'Naked triple', elims: el, cells: cb }); if (acc.length >= acc.limit) return true; }
    }
  }
  return null;
}
function hiddenSubset(st, k, acc) {
  const { cands } = st;
  for (let u = 0; u < 27; u++) {
    const U = UNITS[u]; const pos = []; const digs = [];
    for (let d = 0; d < 9; d++) { const bit = 1 << d; let pm = 0, n = 0; for (let j = 0; j < 9; j++) if (cands[U[j]] & bit) { pm |= 1 << j; n++; } pos[d] = pm; if (n >= 2 && n <= k) digs.push(d); }
    if (digs.length < k) continue;
    for (const cb of combos(digs, k, 0, [], [])) {
      let pm = 0, dm = 0; for (const d of cb) { pm |= pos[d]; dm |= 1 << d; }
      if (POP[pm] !== k) continue;
      const el = [], cells = [];
      for (let j = 0; j < 9; j++) if (pm & (1 << j)) { const c = U[j]; cells.push(c); if (cands[c] & ~dm) el.push([c, cands[c] & ~dm]); }
      if (el.length) { acc.push({ tech: k === 2 ? 'Hidden pair' : 'Hidden triple', elims: el, cells }); if (acc.length >= acc.limit) return true; }
    }
  }
  return null;
}
function fish(st, k, acc) {
  const { cands } = st; const name = k === 2 ? 'X-Wing' : 'Swordfish';
  for (let d = 0; d < 9; d++) {
    const bit = 1 << d;
    for (let orient = 0; orient < 2; orient++) {
      const lines = [], masks = [];
      for (let l = 0; l < 9; l++) {
        let m = 0; for (let j = 0; j < 9; j++) { const c = orient ? j * 9 + l : l * 9 + j; if (cands[c] & bit) m |= 1 << j; }
        if (POP[m] >= 2 && POP[m] <= k) { lines.push(l); masks[l] = m; }
      }
      if (lines.length < k) continue;
      for (const cb of combos(lines, k, 0, [], [])) {
        let un = 0; for (const l of cb) un |= masks[l];
        if (POP[un] !== k) continue;
        const el = [], cells = [];
        for (let j = 0; j < 9; j++) if (un & (1 << j)) for (let l = 0; l < 9; l++) {
          const c = orient ? j * 9 + l : l * 9 + j;
          if (!(cands[c] & bit)) continue;
          if (cb.includes(l)) cells.push(c); else el.push([c, bit]);
        }
        if (el.length) { acc.push({ tech: name, elims: el, cells, digit: d + 1 }); if (acc.length >= acc.limit) return true; }
      }
    }
  }
  return null;
}
function xyWing(st, acc) {
  const { cands } = st;
  for (let p = 0; p < 81; p++) {
    const m = cands[p]; if (POP[m] !== 2) continue;
    for (const q of PEERS[p]) {
      const mq = cands[q]; if (POP[mq] !== 2 || POP[mq & m] !== 1) continue;
      const z = mq & ~m, target = (m & ~mq) | z;
      for (const r of PEERS[p]) {
        if (r === q || cands[r] !== target) continue;
        const el = []; for (let x = 0; x < 81; x++) if (x !== p && (cands[x] & z) && sees(x, q) && sees(x, r)) el.push([x, z]);
        if (el.length) { acc.push({ tech: 'XY-Wing', elims: el, cells: [p, q, r], digit: DIG[z] }); if (acc.length >= acc.limit) return true; }
      }
    }
  }
  return null;
}
function xyzWing(st, acc) {
  const { cands } = st;
  for (let p = 0; p < 81; p++) {
    const m = cands[p]; if (POP[m] !== 3) continue;
    const pin = PEERS[p].filter(q => POP[cands[q]] === 2 && (cands[q] & ~m) === 0);
    for (let a = 0; a < pin.length; a++) for (let b = a + 1; b < pin.length; b++) {
      const q = pin[a], r = pin[b]; if ((cands[q] | cands[r]) !== m) continue;
      const z = cands[q] & cands[r]; if (POP[z] !== 1) continue;
      const el = []; for (let x = 0; x < 81; x++) if (x !== p && x !== q && x !== r && (cands[x] & z) && sees(x, p) && sees(x, q) && sees(x, r)) el.push([x, z]);
      if (el.length) { acc.push({ tech: 'XYZ-Wing', elims: el, cells: [p, q, r], digit: DIG[z] }); if (acc.length >= acc.limit) return true; }
    }
  }
  return null;
}
const TIER2 = [pointing, claiming, (st, a) => nakedSubset(st, 2, a), (st, a) => hiddenSubset(st, 2, a), (st, a) => nakedSubset(st, 3, a), (st, a) => hiddenSubset(st, 3, a)];
const TIER3 = [(st, a) => fish(st, 2, a), xyWing, xyzWing, (st, a) => fish(st, 3, a)];
function mkAcc(limit) { const a = []; a.limit = limit; return a; }
function firstStep(st, maxTier) {
  if (maxTier >= 2) for (const f of TIER2) { const a = mkAcc(1); f(st, a); if (a.length) return [a[0], 2]; }
  if (maxTier >= 3) for (const f of TIER3) { const a = mkAcc(1); f(st, a); if (a.length) return [a[0], 3]; }
  return null;
}
// Count distinct productive advanced deductions (by elimination signature)
function countDeductions(st, maxTier, limit, needSingle) {
  const a = mkAcc(200); const fs = [];
  if (maxTier >= 2) fs.push(...TIER2); if (maxTier >= 3) fs.push(...TIER3);
  for (const f of fs) f(st, a);
  const seen = new Set(); let n = 0; const tmp = new Int8Array(81);
  for (const step of a) {
    const key = step.elims.map(e => e[0] * 512 + e[1]).sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue; seen.add(key);
    if (needSingle) {
      const c2 = { vals: st.vals, cands: Uint16Array.from(st.cands) }; applyElims(c2, step); tmp.fill(0);
      if (!findSingles(c2, tmp)) continue;
    }
    if (++n >= limit) break;
  }
  return n;
}

function applyElims(st, step) { for (const [c, m] of step.elims) st.cands[c] &= ~m; }

// Logical solve. opts: {maxTier, K (min open moves), early, needSingle}
function solve(puz, opts) {
  const maxTier = opts.maxTier || 3, K = opts.K || 0;
  const st = makeState(puz);
  let E = 0; for (let i = 0; i < 81; i++) if (!st.vals[i]) E++;
  const sing = new Int8Array(81);
  let tier = 1, flowOK = true, minOpen = 99, sumOpen = 0, nOpen = 0, minHard = 99;
  const techs = {};
  while (E > 0) {
    sing.fill(0);
    const s = findSingles(st, sing);
    if (K) {
      const need = Math.min(K, E);
      let open = s;
      if (open < need && maxTier >= 2) open += countDeductions(st, maxTier, need - open, opts.needSingle);
      if (open < need) { flowOK = false; if (opts.early) return { solved: false, flowOK, tier, techs }; }
      if (s === 0) minHard = Math.min(minHard, open);
      if (E > 6) { minOpen = Math.min(minOpen, open); sumOpen += s; nOpen++; }
    }
    if (s > 0) {
      let i = 0; while (!sing[i]) i++;
      place(st, i, sing[i]); E--;
      continue;
    }
    const fs = firstStep(st, maxTier);
    if (!fs) return { solved: false, flowOK, tier, techs };
    const [step, t] = fs;
    applyElims(st, step); tier = Math.max(tier, t); techs[step.tech] = (techs[step.tech] || 0) + 1;
  }
  return { solved: true, flowOK, tier, techs, minOpen, minHard, avgOpen: nOpen ? sumOpen / nOpen : 0, vals: st.vals };
}

function generate(tier, K, needSingle) {
  const sol = randomSolution(); const puz = Int8Array.from(sol);
  const order = shuffle([...Array(41).keys()]);
  for (const i of order) {
    const j = 80 - i, a = puz[i], b = puz[j];
    puz[i] = 0; puz[j] = 0;
    const r = solve(puz, { maxTier: tier, K, early: true, needSingle });
    if (!r.solved || !r.flowOK) { puz[i] = a; puz[j] = b; }
  }
  const fin = solve(puz, { maxTier: tier, K, needSingle });
  if (fin.tier !== tier) return null;
  let clues = 0; for (let i = 0; i < 81; i++) if (puz[i]) clues++;
  return { puzzle: Array.from(puz), solution: Array.from(sol), tier, techs: fin.techs, clues, minOpen: fin.minOpen, avgOpen: fin.avgOpen };
}

if (typeof module !== 'undefined') module.exports = { generate, solve, makeState, findSingles, TIER2, TIER3, applyElims, place, UNITS, PEERS, ROW, COL, BOX };
