// Ren spill-logikk for Minesveiper. Reglene står i REGLER.md («Vår versjon»).
// Ingen DOM og ingen klokke her: tilfeldighet sendes inn som rand(), tid som millisekunder.
//
// Tilstand:
//   level, cols, rows, mines
//   cells:   flat liste, rad for rad. Hver rute: { mine, open, flag, n } der n er antall nabominer.
//   status:  "ready" (ingen miner lagt ut ennå) | "playing" | "won" | "lost"
//   opened:  antall åpnede ruter uten mine
//   flags:   antall flagg på brettet
//   exploded: indeksen til minen som ble sprengt, ellers null
//   elapsedMs: tid siden første rute ble åpnet

const Minesweeper = {
  LEVELS: {
    lett: { cols: 8, rows: 8, mines: 10 },
    middels: { cols: 9, rows: 9, mines: 15 },
    vanskelig: { cols: 10, rows: 12, mines: 25 },
  },

  create(level = "middels") {
    const { cols, rows, mines } = Minesweeper.LEVELS[level];
    const cells = [];
    for (let i = 0; i < cols * rows; i++) cells.push({ mine: false, open: false, flag: false, n: 0 });
    return { level, cols, rows, mines, cells, status: "ready", opened: 0, flags: 0, exploded: null, elapsedMs: 0 };
  },

  // Indeksene til de (inntil åtte) naborutene.
  neighbors(state, i) {
    const c = i % state.cols;
    const r = Math.floor(i / state.cols);
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < state.cols && nr >= 0 && nr < state.rows) out.push(nr * state.cols + nc);
      }
    }
    return out;
  },

  // Legger miner i de oppgitte rutene, regner ut tallene og setter spillet i gang.
  // Flagg som alt er satt, blir stående.
  withMines(state, mineIndexes) {
    const mineSet = new Set(mineIndexes);
    const cells = state.cells.map((cell, i) => ({ ...cell, mine: mineSet.has(i) }));
    const next = { ...state, cells, mines: mineSet.size, status: "playing" };
    cells.forEach((cell, i) => {
      cell.n = Minesweeper.neighbors(next, i).filter((j) => cells[j].mine).length;
    });
    return next;
  },

  // Trekker tilfeldige miner utenom ruten `safe` og naboene dens.
  placeMines(state, safe, rand) {
    const keepFree = new Set([safe, ...Minesweeper.neighbors(state, safe)]);
    const candidates = [];
    for (let i = 0; i < state.cells.length; i++) if (!keepFree.has(i)) candidates.push(i);
    const count = Math.min(state.mines, candidates.length);
    for (let k = 0; k < count; k++) {
      const j = k + Math.floor(rand() * (candidates.length - k));
      [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    }
    return Minesweeper.withMines(state, candidates.slice(0, count));
  },

  // Åpner rutene i `start` og brer seg utover fra blanke ruter. Endrer `cells` og returnerer
  // { opened, exploded } der exploded er indeksen til en mine som ble åpnet, ellers null.
  _reveal(state, cells, start) {
    let opened = 0;
    let exploded = null;
    const queue = [...start];
    while (queue.length) {
      const i = queue.pop();
      const cell = cells[i];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.mine) {
        if (exploded === null) exploded = i;
        continue;
      }
      opened++;
      if (cell.n === 0) queue.push(...Minesweeper.neighbors(state, i));
    }
    return { opened, exploded };
  },

  _afterReveal(state, cells, result) {
    const opened = state.opened + result.opened;
    let status = state.status;
    if (result.exploded !== null) status = "lost";
    else if (opened === cells.length - state.mines) status = "won";
    if (status === "won") cells.forEach((cell) => (cell.flag = cell.mine)); // alle miner får flagg
    const flags = status === "won" ? state.mines : state.flags;
    return { ...state, cells, opened, status, flags, exploded: result.exploded };
  },

  // Åpner en dekket rute. Første åpning legger ut minene, slik at ruten og naboene er trygge.
  open(state, i, rand) {
    if (state.status !== "ready" && state.status !== "playing") return state;
    const target = state.cells[i];
    if (!target || target.open || target.flag) return state;
    const base = state.status === "ready" ? Minesweeper.placeMines(state, i, rand) : state;
    const cells = base.cells.map((cell) => ({ ...cell }));
    return Minesweeper._afterReveal(base, cells, Minesweeper._reveal(base, cells, [i]));
  },

  // Setter eller fjerner flagg på en dekket rute.
  toggleFlag(state, i) {
    if (state.status !== "ready" && state.status !== "playing") return state;
    const target = state.cells[i];
    if (!target || target.open) return state;
    const cells = state.cells.map((cell, j) => (j === i ? { ...cell, flag: !cell.flag } : cell));
    return { ...state, cells, flags: state.flags + (target.flag ? -1 : 1) };
  },

  // Trykk på et åpnet tall: har det like mange flagg rundt seg som tallet viser,
  // åpnes de andre dekkede naboene.
  chord(state, i) {
    if (state.status !== "playing") return state;
    const target = state.cells[i];
    if (!target || !target.open || target.n === 0) return state;
    const around = Minesweeper.neighbors(state, i);
    if (around.filter((j) => state.cells[j].flag).length !== target.n) return state;
    const toOpen = around.filter((j) => !state.cells[j].open && !state.cells[j].flag);
    if (toOpen.length === 0) return state;
    const cells = state.cells.map((cell) => ({ ...cell }));
    return Minesweeper._afterReveal(state, cells, Minesweeper._reveal(state, cells, toOpen));
  },

  // Flytt klokka fremover. Den går bare mens spillet pågår.
  tick(state, dtMs) {
    if (state.status !== "playing") return state;
    return { ...state, elapsedMs: state.elapsedMs + dtMs };
  },

  // Tallet i minetelleren: miner minus flagg (kan bli negativt).
  minesLeft(state) {
    return state.mines - state.flags;
  },

  // Tiden som vises og lagres som rekord: hele sekunder.
  seconds(state) {
    return Math.floor(state.elapsedMs / 1000);
  },
};

if (typeof module !== "undefined") module.exports = Minesweeper;
