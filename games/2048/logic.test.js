const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("./logic.js");

// Lag brikker fra et 4x4-rutenett (0 = tom).
function fromGrid(rows) {
  const tiles = [];
  let id = 1;
  rows.forEach((row, r) => row.forEach((v, c) => v && tiles.push({ id: id++, v, r, c })));
  return tiles;
}
function toGrid(tiles) {
  const g = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  tiles.forEach((t) => (g[t.r][t.c] = t.v));
  return g;
}
function stateWith(rows, extra = {}) {
  const tiles = fromGrid(rows);
  return { ...G.create(), tiles, nextId: tiles.length + 1, ...extra };
}
// Forutsigbar «tilfeldighet».
function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("skyv til venstre slår sammen par", () => {
  const res = G.slide(fromGrid([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), "left");
  assert.deepEqual(toGrid(res.tiles)[0], [4, 4, 0, 0]);
  assert.equal(res.gained, 8);
});

test("en brikke slås bare sammen én gang per trekk", () => {
  const res = G.slide(fromGrid([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), "left");
  assert.deepEqual(toGrid(res.tiles)[0], [4, 4, 0, 0]);
});

test("tre like: de to nærmest veggen slås sammen", () => {
  const right = G.slide(fromGrid([[0, 4, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), "right");
  assert.deepEqual(toGrid(right.tiles)[0], [0, 0, 4, 8]);
});

test("skyv opp og ned virker på kolonner", () => {
  const rows = [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]];
  assert.deepEqual(toGrid(G.slide(fromGrid(rows), "up").tiles).map((r) => r[0]), [4, 4, 0, 0]);
  assert.deepEqual(toGrid(G.slide(fromGrid(rows), "down").tiles).map((r) => r[0]), [0, 0, 4, 4]);
});

test("trekk som ikke flytter noe, teller ikke", () => {
  const s = stateWith([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(G.slide(s.tiles, "left").moved, false);
  assert.equal(G.step(s, "left", seq(0)), s);
});

test("ny brikke havner i en tom rute, 2 eller 4", () => {
  const s = stateWith([[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 0]]);
  const two = G.spawn(s, seq(0, 0.5));
  const t = two.tiles[two.tiles.length - 1];
  assert.deepEqual([t.r, t.c, t.v], [3, 3, 2]);
  const four = G.spawn(s, seq(0, 0.95));
  assert.equal(four.tiles[four.tiles.length - 1].v, 4);
});

test("nytt spill har to brikker og full tid", () => {
  const s = G.newGame(seq(0.1, 0.2, 0.7, 0.3));
  assert.equal(s.tiles.length, 2);
  assert.equal(s.timeLeft, G.TIME_MS);
  assert.equal(s.mode, "timed");
  assert.equal(s.started, false);
});

test("klokka går ikke før første trekk", () => {
  const s = G.tick(G.newGame(seq(0.1, 0.2, 0.7, 0.3)), 5000);
  assert.equal(s.timeLeft, G.TIME_MS);
});

test("trekk starter klokka, og tiden kan renne ut", () => {
  let s = stateWith([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  s = G.step(s, "right", seq(0.5, 0.1));
  assert.equal(s.started, true);
  s = G.tick(s, G.TIME_MS - 1);
  assert.equal(s.status, "playing");
  s = G.tick(s, 10);
  assert.equal(s.status, "timeup");
  assert.equal(s.timeLeft, 0);
  assert.equal(s.timedScore, s.score);
});

test("ingen trekk er mulige mens tiden er ute", () => {
  let s = stateWith([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { started: true, timeLeft: 1 });
  s = G.tick(s, 5);
  assert.equal(G.step(s, "right", seq(0.5)), s);
});

test("fortsett uten tid: fritt spill på samme brett, klokka stopper", () => {
  let s = stateWith([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { started: true, timeLeft: 1, score: 40 });
  s = G.continueFree(G.tick(s, 5));
  assert.equal(s.mode, "free");
  assert.equal(s.status, "playing");
  assert.equal(s.timedScore, 40);
  const later = G.tick(s, 999999);
  assert.equal(later.status, "playing");
  s = G.step(s, "left", seq(0.5, 0.1));
  assert.equal(s.score, 44);
  assert.equal(s.timedScore, 40); // rekorden fra tidsangrepet endres ikke
});

test("angre går ett trekk tilbake, maks tre ganger", () => {
  let s = stateWith([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const start = toGrid(s.tiles);
  s = G.step(s, "left", seq(0.5, 0.1));
  assert.equal(s.score, 4);
  s = G.undo(s);
  assert.deepEqual(toGrid(s.tiles), start);
  assert.equal(s.score, 0);
  assert.equal(s.undosLeft, 2);

  const r = seq(0.3, 0.1);
  for (let i = 0; i < 6; i++) s = G.step(s, ["left", "right"][i % 2], r);
  s = G.undo(G.undo(s));
  assert.equal(s.undosLeft, 0);
  assert.equal(G.canUndo(s), false);
  assert.equal(G.undo(s), s);
});

test("angre redder et spill uten flere trekk", () => {
  // Siste rute fylles med en 4 som ikke har like naboer -> ingen flere trekk.
  let s = stateWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [0, 4, 2, 4]], { mode: "free" });
  s = G.step(s, "left", seq(0, 0.5)); // skyver rad 4 til venstre, ny 2 i hjørnet
  assert.equal(s.status, "over");
  s = G.undo(s);
  assert.equal(s.status, "playing");
  assert.equal(s.tiles.length, 15);
});

test("brettet fullt uten like naboer: spillet er over", () => {
  const s = stateWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  assert.equal(G.canMove(s), false);
  const t = stateWith([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]);
  assert.equal(G.canMove(t), true);
});

test("å nå 2048 markeres én gang", () => {
  let s = stateWith([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  s = G.step(s, "left", seq(0.5, 0.1));
  assert.equal(s.reachedGoal, true);
  assert.equal(s.last.goal, true);
  s = G.step(s, "right", seq(0.5, 0.1));
  assert.equal(s.last.goal, false);
});

test("historikken holdes kort", () => {
  let s = G.newGame(seq(0.1, 0.2, 0.7, 0.3));
  const r = seq(0.37, 0.2, 0.81, 0.5, 0.05);
  for (let i = 0; i < 40 && s.status === "playing"; i++) s = G.step(s, ["left", "up", "right", "down"][i % 4], r);
  assert.ok(s.history.length <= G.HISTORY);
});

test("et helt spill blir ferdig og brikkene er alltid gyldige", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let s = G.continueFree({ ...G.newGame(rand), status: "timeup" });
  const dirs = ["left", "down", "right", "up"];
  let steps = 0;
  while (s.status === "playing" && steps < 5000) {
    const next = dirs.map((d) => G.step(s, d, rand)).find((x) => x !== s);
    if (!next) break;
    s = next;
    steps++;
    const cells = new Set(s.tiles.map((t) => t.r * 4 + t.c));
    assert.equal(cells.size, s.tiles.length); // aldri to brikker i samme rute
  }
  assert.equal(s.status, "over");
  assert.ok(s.score > 0);
});
