const { test } = require("node:test");
const assert = require("node:assert/strict");
const Ludo = require("./logic.js");

// Hjelper: lag en tilstand med gitte brikkeposisjoner.
function withPieces(red, yellow, current = 0) {
  const s = Ludo.create(current);
  s.players[0].pieces = red.slice();
  s.players[1].pieces = yellow.slice();
  s.rollsLeft = Ludo.rollsFor(s.players[current]);
  return s;
}

test("startoppsett: alle brikker hjemme, tre kast", () => {
  const s = Ludo.create(0);
  assert.deepEqual(s.players[0].pieces, [-1, -1, -1, -1]);
  assert.equal(s.rollsLeft, 3);
  assert.equal(s.phase, "roll");
});

test("uten brikker ute: tre forsøk på sekser, så går turen videre", () => {
  let s = Ludo.create(0);
  s = Ludo.roll(s, 3);
  assert.equal(s.current, 0);
  assert.equal(s.rollsLeft, 2);
  s = Ludo.roll(s, 2);
  assert.equal(s.rollsLeft, 1);
  s = Ludo.roll(s, 5);
  assert.equal(s.current, 1);
  assert.equal(s.rollsLeft, 3);
});

test("sekser setter ut en brikke og gir nytt kast", () => {
  let s = Ludo.roll(Ludo.create(0), 6);
  assert.equal(s.phase, "move");
  assert.deepEqual(s.legal, [0, 1, 2, 3]);
  s = Ludo.move(s, 0);
  assert.equal(s.players[0].pieces[0], 0);
  assert.equal(s.current, 0);
  assert.equal(s.phase, "roll");
  assert.equal(s.rollsLeft, 1);
});

test("med brikke ute: ett kast, og turen går videre etter trekket", () => {
  let s = withPieces([0, -1, -1, -1], [-1, -1, -1, -1]);
  assert.equal(s.rollsLeft, 1);
  s = Ludo.roll(s, 4);
  assert.deepEqual(s.legal, [0]);
  s = Ludo.move(s, 0);
  assert.equal(s.players[0].pieces[0], 4);
  assert.equal(s.current, 1);
});

test("kastet må brukes: ulovlig brikke kan ikke flyttes", () => {
  let s = Ludo.roll(withPieces([5, -1, -1, -1], [-1, -1, -1, -1]), 3);
  const same = Ludo.move(s, 1); // brikke 1 er hjemme, 3 er ikke sekser
  assert.equal(same, s);
});

test("start på absolutt felt: rød 0, gul 26", () => {
  const s = Ludo.create(0);
  assert.equal(Ludo.square(s.players[0], 0), 0);
  assert.equal(Ludo.square(s.players[1], 0), 26);
  assert.equal(Ludo.square(s.players[1], 30), 4); // går rundt
  assert.equal(Ludo.square(s.players[0], 51), null); // innløp
});

test("lande nøyaktig på motstander slår den ut", () => {
  // Gul brikke på relativ 4 = absolutt 30. Rød på relativ 27 = absolutt 27.
  let s = withPieces([27, -1, -1, -1], [4, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 3), 0);
  assert.equal(s.players[0].pieces[0], 30);
  assert.equal(s.players[1].pieces[0], -1);
  assert.ok(s.events.some((e) => e.type === "capture"));
});

test("å gå forbi en motstander slår den ikke ut", () => {
  let s = withPieces([27, -1, -1, -1], [4, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 5), 0);
  assert.equal(s.players[1].pieces[0], 4);
});

test("kan ikke lande på en trygg brikke på dens eget startfelt", () => {
  // Gul på relativ 0 = absolutt 26 (gults startfelt). Rød på relativ 23 ville landet der med 3.
  const before = withPieces([23, -1, -1, -1], [0, -1, -1, -1]);
  assert.deepEqual(Ludo.legalMoves(before, 3), []);
  const s = Ludo.roll(before, 3);
  assert.equal(s.current, 1); // ingen lovlige trekk, turen går videre
  assert.equal(s.players[0].pieces[0], 23);
  assert.equal(s.players[1].pieces[0], 0);
});

test("kan hoppe over en trygg brikke", () => {
  let s = withPieces([23, -1, -1, -1], [0, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 5), 0);
  assert.equal(s.players[0].pieces[0], 28);
  assert.equal(s.players[1].pieces[0], 0);
});

test("blokkert brikke hindrer bare det ene trekket, andre brikker kan flyttes", () => {
  const s = Ludo.roll(withPieces([23, 5, -1, -1], [0, -1, -1, -1]), 3);
  assert.deepEqual(s.legal, [1]);
});

test("egne brikker kan stå sammen på eget startfelt", () => {
  let s = withPieces([0, -1, -1, -1], [10, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 6), 1);
  assert.deepEqual(s.players[0].pieces.slice(0, 2), [0, 0]);
});

test("brikken er bare trygg på sitt eget startfelt, ikke på andre felt", () => {
  // Gul på relativ 1 (like etter eget startfelt) kan slås ut.
  let s = withPieces([23, -1, -1, -1], [1, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 4), 0);
  assert.equal(s.players[1].pieces[0], -1);
});

test("motstander på ditt startfelt er ikke trygg: sette ut på sekser slår den ut", () => {
  // Gul brikke på relativ 26 = absolutt 0 = røds startfelt.
  let s = withPieces([-1, -1, -1, -1], [26, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 6), 0);
  assert.equal(s.players[1].pieces[0], -1);
});

test("brikker i innløpet kan ikke slås ut", () => {
  // Gul i innløpet (relativ 52). Rød lander på et felt med samme tall, men det er ikke på banen.
  let s = withPieces([22, -1, -1, -1], [52, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 4), 0);
  assert.equal(s.players[1].pieces[0], 52);
});

test("må treffe mål nøyaktig", () => {
  let s = withPieces([54, -1, -1, -1], [10, -1, -1, -1]);
  const tooFar = Ludo.roll(s, 3);
  assert.equal(tooFar.phase, "roll");
  assert.equal(tooFar.current, 1); // ingen trekk, turen går videre
  const exact = Ludo.move(Ludo.roll(s, 2), 0);
  assert.equal(exact.players[0].pieces[0], Ludo.GOAL);
});

test("sekser uten lovlige trekk gir likevel nytt kast", () => {
  const s = Ludo.roll(withPieces([53, 56, 56, 56], [10, -1, -1, -1]), 6);
  assert.equal(s.current, 0);
  assert.equal(s.phase, "roll");
});

test("alle fire i mål: spilleren vinner", () => {
  let s = withPieces([56, 56, 56, 53], [10, -1, -1, -1]);
  s = Ludo.move(Ludo.roll(s, 3), 3);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 0);
});

test("datamaskinen foretrekker å slå ut", () => {
  // Gul (spiller 1) har brikke på rel 1 (abs 27) og rel 10. Rød står på abs 30.
  const s = Ludo.roll(withPieces([30, -1, -1, -1], [1, 10, -1, -1], 1), 3);
  assert.equal(Ludo.chooseMove(s), 0);
});

test("datamaskinen setter ut brikke på sekser når det ikke er noe bedre", () => {
  const s = Ludo.roll(withPieces([-1, -1, -1, -1], [10, -1, -1, -1], 1), 6);
  assert.equal(Ludo.chooseMove(s), 1);
});

test("datamaskinen kan ikke lande på din trygge brikke", () => {
  // Gul (spiller 1): brikke 0 på rel 23 ville landet på røds startfelt (abs 0) med 3,
  // der rød står trygt. Bare brikke 1 kan flyttes.
  const s = Ludo.roll(withPieces([0, 56, 56, 56], [23, 40, -1, -1], 1), 3);
  assert.deepEqual(s.legal, [1]);
  assert.equal(Ludo.chooseMove(s), 1);
});

test("eget startfelt regnes ikke som truet", () => {
  // Gul står 2 felt bak røds startfelt, men rød på eget startfelt er trygg.
  const s = withPieces([0, -1, -1, -1], [24, -1, -1, -1]);
  assert.equal(Ludo.threatened(s, 0, 0), false);
  assert.equal(Ludo.threatened(s, 0, 1), true);
});

test("et helt spill mellom to datamaskiner blir ferdig", () => {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return (seed % 6) + 1;
  };
  let s = Ludo.create(0);
  let steps = 0;
  while (s.phase !== "over" && steps < 20000) {
    s = s.phase === "roll" ? Ludo.roll(s, rand()) : Ludo.move(s, Ludo.chooseMove(s));
    steps++;
  }
  assert.equal(s.phase, "over");
  assert.ok(s.winner === 0 || s.winner === 1);
});
