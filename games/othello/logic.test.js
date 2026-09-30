const { test } = require("node:test");
const assert = require("node:assert/strict");
const O = require("./logic.js");

// Bygg en tilstand fra seks rader: "X" = mørk (0), "O" = lys (1), "." = tom.
function fromRows(rows, current = 0) {
  const cells = [...rows.join("")].map((ch) => (ch === "X" ? 0 : ch === "O" ? 1 : null));
  assert.equal(cells.length, 36);
  return O.fromCells(cells, current);
}
function seeded(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const at = (col, row) => row * 6 + col;
const EMPTY = "......";

test("startoppstilling: fire brikker i midten på 6×6, mørk begynner", () => {
  const s = O.create();
  assert.equal(s.cells.length, 36);
  assert.deepEqual(O.count(s), [2, 2]);
  assert.equal(s.cells[at(2, 2)], 1);
  assert.equal(s.cells[at(3, 3)], 1);
  assert.equal(s.cells[at(3, 2)], 0);
  assert.equal(s.cells[at(2, 3)], 0);
  assert.equal(s.current, 0);
  assert.equal(s.status, "playing");
  assert.deepEqual(O.legalMoves(s), [at(2, 1), at(1, 2), at(4, 3), at(3, 4)]);
});

test("et trekk snur de fangede brikkene, og turen går videre", () => {
  const s = O.play(O.create(), at(2, 1));
  assert.equal(s.cells[at(2, 1)], 0);
  assert.equal(s.cells[at(2, 2)], 0);
  assert.deepEqual(O.count(s), [4, 1]);
  assert.equal(s.current, 1);
  assert.equal(s.passed, null);
  assert.equal(s.moves, 1);
  assert.deepEqual(s.last, { i: at(2, 1), player: 0, flipped: [at(2, 2)] });
});

test("et trekk må snu minst én brikke", () => {
  const s = O.create();
  assert.equal(O.canPlay(s, 0), false);
  assert.equal(O.play(s, 0), s);
  assert.equal(O.play(s, at(1, 1)), s); // på skrå for egen brikke, fanger ingenting
});

test("en opptatt rute kan ikke brukes", () => {
  const s = O.create();
  assert.equal(O.canPlay(s, at(2, 2)), false);
  assert.equal(O.play(s, at(3, 2)), s);
});

test("brikker snus i alle retninger samtidig", () => {
  const s = fromRows([".OX...", "OO....", "X.X...", EMPTY, EMPTY, EMPTY]);
  assert.deepEqual(O.flips(s.cells, 0, 0).sort((a, b) => a - b), [1, 6, 7]);
  const n = O.play(s, 0);
  assert.deepEqual(O.count(n), [7, 0]);
});

test("en lang rekke snus helt frem til egen brikke", () => {
  const s = fromRows([".OOOOX", EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
  assert.deepEqual(O.flips(s.cells, 0, 0), [1, 2, 3, 4]);
});

test("ingenting fanges uten egen brikke i enden, eller over en tom rute", () => {
  const s = fromRows([".OO...", ".O.X..", EMPTY, EMPTY, "X.....", ".O...."]);
  assert.deepEqual(O.flips(s.cells, at(0, 0), 0), []); // rekken ender i tom rute
  assert.deepEqual(O.flips(s.cells, at(0, 1), 0), []); // tom rute mellom
});

test("spilleren uten lovlige trekk står over, og motstanderen trekker igjen", () => {
  const s = fromRows([".OX...", EMPTY, EMPTY, EMPTY, EMPTY, "....OX"]);
  const n = O.play(s, 0);
  assert.equal(n.status, "playing");
  assert.equal(n.passed, 1); // lys måtte stå over
  assert.equal(n.current, 0); // mørk trekker igjen
  assert.deepEqual(O.legalMoves(n), [at(3, 5)]);
});

test("partiet er slutt når ingen kan trekke, selv om brettet ikke er fullt", () => {
  let s = fromRows([".OX...", EMPTY, EMPTY, EMPTY, EMPTY, "....OX"]);
  s = O.play(O.play(s, 0), at(3, 5));
  assert.equal(s.status, "over");
  assert.equal(s.winner, 0);
  assert.deepEqual(O.count(s), [6, 0]);
  assert.deepEqual(O.legalMoves(s), []);
  assert.equal(O.play(s, at(3, 0)), s); // ingen trekk etter slutt
});

test("flest brikker vinner, tomme ruter teller ikke", () => {
  const s = fromRows(["OOO...", EMPTY, EMPTY, EMPTY, EMPTY, "...XX."]);
  assert.equal(s.status, "over");
  assert.deepEqual(O.count(s), [2, 3]);
  assert.equal(s.winner, 1);
});

test("like mange brikker er uavgjort", () => {
  const s = fromRows(Array(6).fill("XXXOOO"));
  assert.equal(s.status, "over");
  assert.equal(s.winner, "draw");
});

test("seiersrekke: seier +1, uavgjort står, tap og avbrudd nullstiller", () => {
  assert.equal(O.nextStreak(2, "win"), 3);
  assert.equal(O.nextStreak(2, "draw"), 2);
  assert.equal(O.nextStreak(2, "loss"), 0);
  assert.equal(O.nextStreak(2, "abandon"), 0);
});

// ---------- Datamaskinen ----------

// Lys har tur. Rute 12 snur tre brikker, hjørnet (rute 0) snur én.
const CORNER = [".XO...", EMPTY, ".XXXO.", EMPTY, EMPTY, EMPTY];

test("lett tar trekket som snur flest brikker", () => {
  const s = fromRows(CORNER, 1);
  assert.deepEqual(O.legalMoves(s), [0, 12]);
  assert.equal(O.chooseMove(s, "lett", () => 0.99), 12);
});

test("lett gjør et tilfeldig trekk når tabben inntreffer", () => {
  const s = fromRows(CORNER, 1);
  assert.equal(O.chooseMove(s, "lett", () => 0), 0); // rand() = 0 -> tabbe -> første lovlige rute
});

for (const level of ["middels", "vanskelig"]) {
  test(`datamaskinen (${level}) tar hjørnet fremfor å snu flest`, () => {
    // Lys har tur. Hjørnet nede til venstre (rute 30) snur én brikke, rute 23 snur flere.
    const s = fromRows(["..O...", "X.O...", ".OXXXX", "OOOXX.", "X.O.X.", "...O.."], 1);
    assert.deepEqual(O.legalMoves(s), [9, 10, 11, 23, 29, 30]);
    assert.ok(O.flips(s.cells, 23, 1).length > O.flips(s.cells, 30, 1).length);
    assert.equal(O.chooseMove(s, "lett", () => 0.99), 23);
    assert.equal(O.chooseMove(s, level), 30);
  });
}

for (const level of ["lett", "middels", "vanskelig"]) {
  test(`datamaskinen (${level}) velger alltid et lovlig trekk, og null uten trekk`, () => {
    const rand = seeded(7);
    let s = O.create();
    for (let n = 0; n < 8 && s.status === "playing"; n++) {
      const i = O.chooseMove(s, level, rand);
      assert.ok(O.canPlay(s, i), "ulovlig trekk " + i);
      s = O.play(s, i);
    }
    assert.equal(O.chooseMove(fromRows(Array(6).fill("XXXOOO")), level, rand), null);
  });
}

// Uavhengig fasit: beste oppnåelige brikkeforskjell for `me` med perfekt spill fra begge.
function bestDiff(s, me) {
  if (s.status === "over") {
    const c = O.count(s);
    return c[me] - c[1 - me];
  }
  const results = O.legalMoves(s).map((i) => bestDiff(O.play(s, i), me));
  return s.current === me ? Math.max(...results) : Math.min(...results);
}

test("vanskelig spiller sluttspillet perfekt (sjekket mot full gjennomregning)", () => {
  for (let g = 0; g < 4; g++) {
    const rand = seeded(g + 11);
    let s = O.create();
    while (s.status === "playing" && s.cells.filter((v) => v === null).length > 7) {
      const legal = O.legalMoves(s);
      s = O.play(s, legal[Math.floor(rand() * legal.length)]);
    }
    if (s.status !== "playing") continue;
    const me = s.current;
    const choice = O.chooseMove(s, "vanskelig");
    assert.equal(bestDiff(O.play(s, choice), me), bestDiff(s, me), "parti " + g);
  }
});

test("vanskelig velger trekk raskt fra start", () => {
  const t0 = Date.now();
  const i = O.chooseMove(O.create(), "vanskelig");
  assert.ok(O.canPlay(O.create(), i));
  assert.ok(Date.now() - t0 < 1500, "tok " + (Date.now() - t0) + " ms");
});

test("hele partier blir ferdige, og vanskelig slår lett nesten alltid", () => {
  let hardWins = 0;
  for (let g = 0; g < 6; g++) {
    const rand = seeded(g + 1);
    const hard = g % 2; // vanskelig er annenhver gang mørk og lys
    let s = O.create();
    let steps = 0;
    while (s.status === "playing") {
      assert.ok(++steps <= 32, "partiet tok for mange trekk");
      const before = s;
      s = O.play(s, O.chooseMove(s, s.current === hard ? "vanskelig" : "lett", rand));
      assert.equal(s.moves, before.moves + 1); // hvert trekk er lovlig
      const [a, b] = O.count(s);
      assert.equal(a + b, 4 + s.moves); // én ny brikke per trekk, ingen forsvinner
      if (s.status === "playing") assert.ok(O.legalMoves(s).length > 0); // den som har tur, kan trekke
    }
    assert.deepEqual(O.legalMoves(s), []);
    if (s.winner === hard) hardWins++;
  }
  assert.ok(hardWins >= 5, "vanskelig vant bare " + hardWins + " av 6");
});
