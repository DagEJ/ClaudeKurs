const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./logic.js");

// Spill en rekke kolonner fra start. Spiller 0 begynner med mindre annet er oppgitt.
function play(columns, first = 0) {
  let s = F.create(first);
  for (const c of columns) s = F.drop(s, c);
  return s;
}
// Lag en tilstand direkte fra kolonner skrevet som strenger nedenfra og opp: "AB" = 0 nederst, så 1.
function fromCols(strings, current = 0) {
  const s = F.create(current);
  s.cols = strings.map((str) => [...str].map((ch) => (ch === "A" ? 0 : 1)));
  s.moves = s.cols.reduce((n, col) => n + col.length, 0);
  return s;
}
function seeded(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

test("brikken faller til laveste ledige rute", () => {
  const s = play([3, 3, 3]);
  assert.deepEqual(s.cols[3], [0, 1, 0]);
  assert.deepEqual(s.last, { c: 3, r: 2, player: 0 });
});

test("spillerne legger annenhver gang", () => {
  const s = play([0]);
  assert.equal(s.current, 1);
  assert.equal(F.drop(s, 1).current, 0);
});

test("en full kolonne kan ikke brukes", () => {
  const s = play([0, 0, 0, 0, 0, 0]);
  assert.equal(F.canDrop(s, 0), false);
  assert.equal(F.drop(s, 0), s);
  assert.deepEqual(F.legalMoves(s), [1, 2, 3, 4, 5, 6]);
});

test("fire på rad vannrett vinner", () => {
  const s = play([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(s.status, "over");
  assert.equal(s.winner, 0);
  assert.deepEqual(s.line, [[0, 0], [1, 0], [2, 0], [3, 0]]);
});

test("fire på rad loddrett vinner", () => {
  const s = play([5, 6, 5, 6, 5, 6, 5]);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.line, [[5, 0], [5, 1], [5, 2], [5, 3]]);
});

test("fire på rad på skrå oppover vinner", () => {
  // A i (0,0), (1,1), (2,2), (3,3)
  const s = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.line, [[0, 0], [1, 1], [2, 2], [3, 3]]);
});

test("fire på rad på skrå nedover vinner", () => {
  // A i (3,0), (2,1), (1,2), (0,3)
  const s = play([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.line, [[0, 3], [1, 2], [2, 1], [3, 0]]);
});

test("tre på rad er ikke nok", () => {
  const s = play([0, 0, 1, 1, 2]);
  assert.equal(s.status, "playing");
});

test("ingen trekk etter at spillet er over", () => {
  const s = play([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(F.drop(s, 4), s);
  assert.equal(F.canDrop(s, 4), false);
});

test("fullt brett uten fire på rad er uavgjort", () => {
  // Siste rute (kolonne 6, øverst) mangler; den fylles med B uten å gi fire på rad.
  const s = fromCols(["BAABAB", "AABBAB", "BBBAAA", "AABBBA", "BBAAAB", "ABBBAA", "BAABA"], 1);
  const end = F.drop(s, 6);
  assert.equal(end.status, "over");
  assert.equal(end.winner, "draw");
  assert.equal(end.line, null);
});

test("seiersrekke: seier +1, uavgjort står, tap og avbrudd nullstiller", () => {
  assert.equal(F.nextStreak(2, "win"), 3);
  assert.equal(F.nextStreak(2, "draw"), 2);
  assert.equal(F.nextStreak(2, "loss"), 0);
  assert.equal(F.nextStreak(2, "abandon"), 0);
});

for (const level of ["lett", "middels", "vanskelig"]) {
  test(`datamaskinen (${level}) tar en vinnende rute`, () => {
    // Spiller 1 (B) har tre i kolonne 4 og har tur. Tvinger «tabbe» til å ikke skje ved å gi rand() = 0.99.
    const s = fromCols(["A", "A", "A", "", "BBB", "", ""], 1);
    assert.equal(F.chooseMove(s, level, () => 0.99), 4);
  });
}

for (const level of ["middels", "vanskelig"]) {
  test(`datamaskinen (${level}) blokkerer din fire på rad`, () => {
    // A har tre vannrett nederst (0,1,2). B har tur og må ta kolonne 3.
    const s = fromCols(["A", "A", "A", "B", "", "", "B"], 1);
    s.cols[3] = []; // kolonne 3 er tom, så A truer der
    s.moves = 5;
    assert.equal(F.chooseMove(s, level), 3);
  });
}

test("vanskelig legger ikke brikke rett under motstanderens vinnerrute", () => {
  // A truer vannrett på rad 1 i kolonne 3 (A i (0,1), (1,1), (2,1)).
  // Legger B i kolonne 3 nå (rad 0), kan A vinne på rad 1 der. B skal velge noe annet.
  // Nederste rad er B A B _ B _ B, så kolonne 3 gir ikke B fire på rad der.
  const s = fromCols(["BA", "AA", "BA", "", "BB", "", "B"], 1);
  const choice = F.chooseMove(s, "vanskelig");
  assert.notEqual(choice, 3);
});

test("lett gjør et tilfeldig trekk når tabben inntreffer", () => {
  const s = F.create(1);
  assert.equal(F.chooseMove(s, "lett", () => 0), 0); // rand() = 0 -> tabbe -> første lovlige kolonne
});

test("vanskelig velger trekk raskt fra tomt brett", () => {
  const t0 = Date.now();
  const c = F.chooseMove(F.create(1), "vanskelig");
  assert.equal(c, 3); // midten er best
  assert.ok(Date.now() - t0 < 1500, "tok " + (Date.now() - t0) + " ms");
});

test("hele partier blir ferdige, og vanskelig slår lett nesten alltid", () => {
  let hardWins = 0;
  for (let g = 0; g < 6; g++) {
    const rand = seeded(g + 1);
    let s = F.create(g % 2);
    const level = (p) => (p === 0 ? "vanskelig" : "lett");
    while (s.status === "playing") {
      const before = s.moves;
      s = F.drop(s, F.chooseMove(s, level(s.current), rand));
      assert.equal(s.moves, before + 1); // hvert trekk er lovlig
      assert.ok(s.cols.every((col) => col.length <= 6));
    }
    if (s.winner === 0) hardWins++;
  }
  assert.ok(hardWins >= 5, "vanskelig vant bare " + hardWins + " av 6");
});
