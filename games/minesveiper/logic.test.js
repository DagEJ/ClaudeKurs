const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./logic.js");

// Forutsigbar «tilfeldighet» med fast frø.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bygg et brett fra tekst: "*" er mine, "." er tom. Spillet er i gang (status "playing").
function board(...lines) {
  const cols = lines[0].length;
  const rows = lines.length;
  const cells = [];
  for (let i = 0; i < cols * rows; i++) cells.push({ mine: false, open: false, flag: false, n: 0 });
  const mines = [];
  lines.join("").split("").forEach((ch, i) => ch === "*" && mines.push(i));
  const empty = { ...M.create("lett"), cols, rows, cells, mines: mines.length };
  return M.withMines(empty, mines);
}
const at = (state, c, r) => r * state.cols + c;
const openCount = (state) => state.cells.filter((cell) => cell.open && !cell.mine).length;

// Sjekkes etter hvert trekk i simuleringene.
function assertInvariants(state) {
  assert.equal(state.opened, openCount(state), "opened stemmer med brettet");
  assert.equal(state.flags, state.cells.filter((cell) => cell.flag).length, "flags stemmer med brettet");
  assert.ok(!state.cells.some((cell) => cell.open && cell.flag), "ingen rute er både åpen og flagget");
  if (state.status !== "lost") assert.ok(!state.cells.some((cell) => cell.open && cell.mine), "ingen åpen mine");
  if (state.status !== "ready") {
    assert.equal(state.cells.filter((cell) => cell.mine).length, state.mines, "riktig antall miner");
  }
}

test("tre nivåer: 8×8 med 10 miner, 9×9 med 15 og 10×12 med 25", () => {
  const sizes = Object.entries(M.LEVELS).map(([name, l]) => [name, l.cols, l.rows, l.mines]);
  assert.deepEqual(sizes, [["lett", 8, 8, 10], ["middels", 9, 9, 15], ["vanskelig", 10, 12, 25]]);
  for (const level of Object.keys(M.LEVELS)) {
    const s = M.create(level);
    assert.equal(s.cells.length, s.cols * s.rows);
    assert.equal(s.status, "ready");
  }
});

test("minene legges ut først når første rute åpnes", () => {
  const s = M.create("middels");
  assert.equal(s.cells.filter((cell) => cell.mine).length, 0);
  const next = M.open(s, 40, seeded(1));
  assert.equal(next.cells.filter((cell) => cell.mine).length, 15);
  assert.equal(next.status, "playing");
});

test("første klikk åpner alltid et område: ruten og de åtte naboene er uten mine", () => {
  for (const level of Object.keys(M.LEVELS)) {
    const empty = M.create(level);
    for (let seed = 1; seed <= 40; seed++) {
      for (const i of [0, empty.cols - 1, empty.cells.length - 1, Math.floor(empty.cells.length / 2), seed % empty.cells.length]) {
        const s = M.open(empty, i, seeded(seed));
        assert.notEqual(s.status, "lost");
        assert.equal(s.cells[i].n, 0, "første rute er blank");
        for (const j of [i, ...M.neighbors(s, i)]) {
          assert.equal(s.cells[j].mine, false);
          assert.equal(s.cells[j].open, true);
        }
        assertInvariants(s);
      }
    }
  }
});

test("naboer: hjørne har 3, kant har 5 og midten har 8", () => {
  const s = M.create("lett");
  assert.equal(M.neighbors(s, at(s, 0, 0)).length, 3);
  assert.equal(M.neighbors(s, at(s, 3, 0)).length, 5);
  assert.equal(M.neighbors(s, at(s, 3, 3)).length, 8);
  assert.deepEqual(M.neighbors(s, at(s, 7, 7)).sort((a, b) => a - b), [at(s, 6, 6), at(s, 7, 6), at(s, 6, 7)]);
});

test("tallet i en rute er antall miner i de åtte naborutene", () => {
  const s = board(
    "*..",
    "...",
    "..*"
  );
  assert.deepEqual(s.cells.map((cell) => cell.n), [0, 1, 0, 1, 2, 1, 0, 1, 0]);
  const full = board("***", "*.*", "***");
  assert.equal(full.cells[4].n, 8);
});

test("å åpne en mine taper spillet og husker hvilken mine som sprakk", () => {
  const s = M.open(board("*..", "...", "..."), 0);
  assert.equal(s.status, "lost");
  assert.equal(s.exploded, 0);
  assert.equal(s.opened, 0);
});

test("å åpne et tall åpner bare den ene ruten", () => {
  const s = M.open(board("*...", "....", "....", "...."), at({ cols: 4 }, 1, 1));
  assert.equal(s.opened, 1);
  assert.equal(s.status, "playing");
});

test("en blank rute åpner naboene og brer seg videre, men stopper ved tall", () => {
  const start = board(
    "....*",
    ".....",
    ".....",
    "*...."
  );
  const s = M.open(start, at(start, 0, 0));
  // Alt unntatt de to minene er åpnet: tallene rundt minene stopper utbredelsen.
  assert.equal(s.cells[at(s, 4, 0)].open, false);
  assert.equal(s.cells[at(s, 0, 3)].open, false);
  assert.equal(s.cells[at(s, 3, 0)].open, true); // tallet 1 ved minen
  assert.equal(s.cells[at(s, 3, 0)].n, 1);
  assert.equal(s.opened, 18);
  assert.equal(s.status, "won");
});

test("utbredelsen går ikke gjennom flagg", () => {
  let s = board(
    ".....",
    ".....",
    "....*"
  );
  s = M.toggleFlag(s, at(s, 1, 1));
  s = M.open(s, at(s, 0, 0));
  assert.equal(s.cells[at(s, 1, 1)].open, false);
  assert.equal(s.cells[at(s, 1, 1)].flag, true);
  assert.equal(s.status, "playing"); // den flaggede ruten mangler
});

test("en rute med flagg kan ikke åpnes før flagget er tatt bort", () => {
  let s = board("*..", "...", "...");
  s = M.toggleFlag(s, 0);
  assert.equal(M.open(s, 0), s);
  s = M.toggleFlag(s, 0);
  assert.equal(M.open(s, 0).status, "lost");
});

test("flagg settes og fjernes med samme handling, og bare på dekkede ruter", () => {
  let s = board("*...", "....", "....", "....");
  s = M.toggleFlag(s, 0);
  assert.equal(s.cells[0].flag, true);
  assert.equal(s.flags, 1);
  s = M.toggleFlag(s, 0);
  assert.equal(s.cells[0].flag, false);
  assert.equal(s.flags, 0);
  s = M.open(s, 5);
  assert.equal(M.toggleFlag(s, 5), s);
});

test("flagg kan settes før første rute er åpnet, og blir stående", () => {
  let s = M.toggleFlag(M.create("lett"), 63);
  assert.equal(s.status, "ready");
  assert.equal(s.flags, 1);
  s = M.open(s, 0, seeded(3));
  assert.equal(s.cells[63].flag, true);
  assert.equal(s.cells[63].open, false);
  assertInvariants(s);
});

test("minetelleren viser miner minus flagg og kan bli negativ", () => {
  let s = board("*..", "...", "...");
  assert.equal(M.minesLeft(s), 1);
  s = M.toggleFlag(s, 0);
  assert.equal(M.minesLeft(s), 0);
  s = M.toggleFlag(s, 1);
  assert.equal(M.minesLeft(s), -1);
});

test("åpne naboer: riktig antall flagg rundt et tall åpner resten", () => {
  let s = board(
    "*..",
    "...",
    "..."
  );
  s = M.open(s, at(s, 1, 1)); // tallet 1
  assert.equal(s.opened, 1);
  s = M.toggleFlag(s, 0);
  s = M.chord(s, at(s, 1, 1));
  assert.equal(s.status, "won");
  assert.equal(s.opened, 8);
});

test("åpne naboer gjør ingenting når antall flagg ikke stemmer, eller på en dekket rute", () => {
  let s = board("*..", "...", "..*");
  s = M.open(s, at(s, 1, 1)); // tallet 2
  s = M.toggleFlag(s, 0);
  assert.equal(M.chord(s, at(s, 1, 1)), s); // bare ett flagg av to
  assert.equal(M.chord(s, at(s, 2, 0)), s); // dekket rute
});

test("åpne naboer med et flagg på feil rute sprenger en mine", () => {
  let s = board("*..", "...", "...");
  s = M.open(s, at(s, 1, 1));
  s = M.toggleFlag(s, at(s, 2, 2)); // feil rute
  s = M.chord(s, at(s, 1, 1));
  assert.equal(s.status, "lost");
  assert.equal(s.exploded, 0);
});

test("du vinner når alle ruter uten mine er åpnet, uten å ha satt flagg", () => {
  let s = board("*.", "..");
  s = M.open(s, 1);
  s = M.open(s, 2);
  assert.equal(s.status, "playing");
  s = M.open(s, 3);
  assert.equal(s.status, "won");
});

test("når du vinner, får alle miner flagg og feil flagg forsvinner ikke inn i tellingen", () => {
  let s = board("*..", "...", "..*");
  for (const i of [1, 2, 3, 4, 5, 6, 7]) s = M.open(s, i);
  assert.equal(s.status, "won");
  assert.deepEqual(s.cells.map((cell) => cell.flag), [true, false, false, false, false, false, false, false, true]);
  assert.equal(M.minesLeft(s), 0);
});

test("ingen trekk virker etter at spillet er over", () => {
  const lost = M.open(board("*..", "...", "..."), 0);
  assert.equal(M.open(lost, 4), lost);
  assert.equal(M.toggleFlag(lost, 4), lost);
  assert.equal(M.chord(lost, 4), lost);
});

test("klokka går bare mens spillet pågår, og tiden telles i hele sekunder", () => {
  const ready = M.create("lett");
  assert.equal(M.tick(ready, 5000).elapsedMs, 0); // ikke startet
  let s = M.open(ready, 0, seeded(1));
  s = M.tick(s, 1500);
  s = M.tick(s, 1400);
  assert.equal(s.elapsedMs, 2900);
  assert.equal(M.seconds(s), 2);
  const lost = { ...s, status: "lost" };
  assert.equal(M.tick(lost, 5000).elapsedMs, 2900);
});

test("logikken endrer ikke tilstanden den får inn", () => {
  const s = board("*..", "...", "...");
  const copy = JSON.stringify(s);
  M.open(s, 8);
  M.toggleFlag(s, 0);
  M.chord(M.open(s, 4), 4);
  assert.equal(JSON.stringify(s), copy);
});

test("et helt spill med fast frø blir vunnet når man bare åpner trygge ruter", () => {
  for (const level of Object.keys(M.LEVELS)) {
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seeded(seed);
      let s = M.create(level);
      s = M.open(s, Math.floor(rand() * s.cells.length), rand);
      assertInvariants(s);
      let steps = 0;
      while (s.status === "playing") {
        const covered = s.cells.map((cell, i) => i).filter((i) => !s.cells[i].open && !s.cells[i].mine);
        const mine = s.cells.findIndex((cell) => cell.mine && !cell.flag);
        // Bland inn flagg og «åpne naboer», som i et vanlig spill.
        if (mine >= 0 && rand() < 0.3) s = M.toggleFlag(s, mine);
        else if (rand() < 0.3) s = M.chord(s, s.cells.findIndex((cell, i) => cell.open && cell.n > 0 && i >= rand() * s.cells.length));
        else s = M.open(s, covered[Math.floor(rand() * covered.length)]);
        s = M.tick(s, 1000);
        assertInvariants(s);
        assert.ok(++steps < 2000, "spillet blir ferdig");
      }
      assert.equal(s.status, "won");
      assert.equal(s.opened, s.cells.length - s.mines);
    }
  }
});

test("et helt spill med tilfeldige trekk blir alltid ferdig – vunnet eller tapt", () => {
  const results = { won: 0, lost: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const rand = seeded(seed);
    let s = M.create("lett");
    let steps = 0;
    while (s.status === "ready" || s.status === "playing") {
      const covered = s.cells.map((cell, i) => i).filter((i) => !s.cells[i].open && !s.cells[i].flag);
      s = M.open(s, covered[Math.floor(rand() * covered.length)], rand);
      assertInvariants(s);
      assert.ok(++steps < 200, "spillet blir ferdig");
    }
    results[s.status]++;
  }
  assert.equal(results.won + results.lost, 200);
  assert.ok(results.lost > 0);
});
