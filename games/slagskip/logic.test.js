const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("./logic.js");

const { SIZE, FLEET, HUMAN, CPU } = B;
const N = SIZE * SIZE;
const at = (r, c) => r * SIZE + c;

// Tilfeldighet med fast frø (mulberry32).
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

// Spillerens flåte i de fire øverste radene, vannrett fra venstre kant.
function placedState() {
  let s = B.create();
  FLEET.forEach((len, k) => (s = B.placeShip(s, k, at(k, 0), true)));
  return s;
}

// En kamp i gang der datamaskinens flåte ligger på kjente ruter (samme som spillerens).
function battle() {
  const s = B.start(placedState(), seeded(1));
  const boards = [s.boards[HUMAN], { ...s.boards[CPU], ships: s.boards[HUMAN].ships }];
  return { ...s, boards };
}

function blankView(remaining = FLEET.slice()) {
  return { cells: new Array(N).fill(null), remaining };
}

// ---------- Plassering ----------

test("brettet er 8×8 og flåten er skip på 4, 3, 3 og 2 ruter", () => {
  assert.equal(SIZE, 8);
  assert.deepEqual(FLEET, [4, 3, 3, 2]);
});

test("et skip ligger rett, vannrett eller loddrett, fra startruten", () => {
  assert.deepEqual(B.shipCells(at(2, 1), 3, true), [at(2, 1), at(2, 2), at(2, 3)]);
  assert.deepEqual(B.shipCells(at(2, 1), 3, false), [at(2, 1), at(3, 1), at(4, 1)]);
});

test("et skip kan ikke stikke utenfor brettet", () => {
  assert.equal(B.shipCells(at(0, 6), 3, true), null);
  assert.equal(B.shipCells(at(6, 0), 3, false), null);
  assert.equal(B.shipCells(-1, 2, true), null);
  assert.equal(B.shipCells(N, 2, true), null);
  assert.notEqual(B.shipCells(at(0, 5), 3, true), null);
});

test("et skip som stikker utenfor, skyves inn så det får plass", () => {
  assert.equal(B.fitStart(at(3, 7), 4, true), at(3, 4));
  assert.equal(B.fitStart(at(7, 2), 3, false), at(5, 2));
  assert.equal(B.fitStart(at(1, 1), 4, true), at(1, 1));
});

test("skip kan ikke overlappe, men kan ligge inntil hverandre", () => {
  let s = B.placeShip(B.create(), 0, at(0, 0), true); // rutene (0,0)–(0,3)
  const crossing = B.placeShip(s, 1, at(0, 3), false);
  assert.equal(crossing, s, "overlapp endrer ingenting");
  s = B.placeShip(s, 1, at(1, 0), true); // rett under, side om side
  assert.deepEqual(s.boards[HUMAN].ships[1].cells, [at(1, 0), at(1, 1), at(1, 2)]);
  s = B.placeShip(s, 2, at(0, 4), true); // i forlengelsen
  assert.ok(s.boards[HUMAN].ships[2]);
});

test("et skip som alt ligger på brettet, kan flyttes – også til ruter det selv dekker", () => {
  let s = B.placeShip(B.create(), 0, at(0, 0), true);
  s = B.placeShip(s, 0, at(0, 1), true);
  assert.deepEqual(s.boards[HUMAN].ships[0].cells, [at(0, 1), at(0, 2), at(0, 3), at(0, 4)]);
  assert.equal(s.boards[HUMAN].ships.filter(Boolean).length, 1);
});

test("et skip kan løftes opp igjen", () => {
  let s = placedState();
  assert.ok(B.ready(s));
  s = B.removeShip(s, 2);
  assert.equal(s.boards[HUMAN].ships[2], null);
  assert.equal(B.ready(s), false);
  assert.equal(B.shipAt(s.boards[HUMAN], at(2, 0)), -1);
});

test("kampen kan ikke starte før alle fire skipene ligger på brettet", () => {
  let s = B.create();
  assert.equal(B.start(s, seeded(1)), s);
  s = B.removeShip(placedState(), 3);
  assert.equal(B.start(s, seeded(1)), s);
  const started = B.start(placedState(), seeded(1));
  assert.equal(started.phase, "playing");
});

test("«Tilfeldig» legger ut en hel, gyldig flåte", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const ships = B.placeRandom(B.create(), seeded(seed)).boards[HUMAN].ships;
    assert.deepEqual(ships.map((s) => s.len), FLEET);
    const cells = ships.flatMap((s) => s.cells);
    assert.equal(new Set(cells).size, 12, "ingen overlapp");
    for (const s of ships) assert.deepEqual(B.shipCells(s.cells[0], s.len, s.horizontal), s.cells);
  }
});

test("tilfeldig flåte blir ferdig også med ensformig tilfeldighet", () => {
  for (const r of [0, 0.5, 0.999999]) {
    const ships = B.randomFleet(() => r);
    assert.equal(new Set(ships.flatMap((s) => s.cells)).size, 12);
  }
});

test("datamaskinens flåte legges ut tilfeldig ved start, og du skyter først", () => {
  const a = B.start(placedState(), seeded(1));
  const b = B.start(placedState(), seeded(2));
  assert.deepEqual(a.boards[CPU].ships.map((s) => s.len), FLEET);
  assert.notDeepEqual(a.boards[CPU].ships, b.boards[CPU].ships);
  assert.equal(a.current, HUMAN);
  assert.deepEqual(a.shots, [0, 0]);
});

test("skip kan ikke flyttes etter at kampen har startet", () => {
  const s = battle();
  assert.equal(B.placeShip(s, 0, at(6, 0), true), s);
  assert.equal(B.removeShip(s, 0), s);
  assert.equal(B.placeRandom(s, seeded(3)), s);
});

// ---------- Skyting ----------

test("det kan ikke skytes før kampen har startet", () => {
  const s = placedState();
  assert.equal(B.shoot(s, 0), s);
});

test("bom gir turen videre til motstanderen", () => {
  const s = B.shoot(battle(), at(7, 7));
  assert.equal(s.last.result, "miss");
  assert.equal(s.current, CPU);
  assert.deepEqual(s.shots, [1, 0]);
});

test("treff gir nytt skudd", () => {
  const s = B.shoot(battle(), at(0, 0));
  assert.equal(s.last.result, "hit");
  assert.equal(s.current, HUMAN);
});

test("treff gir nytt skudd også for datamaskinen", () => {
  let s = B.shoot(battle(), at(7, 7)); // du bommer
  s = B.shoot(s, at(3, 0)); // datamaskinen treffer
  assert.equal(s.last.player, CPU);
  assert.equal(s.last.result, "hit");
  assert.equal(s.current, CPU);
  s = B.shoot(s, at(7, 0)); // og bommer
  assert.equal(s.current, HUMAN);
});

test("et skip er senket når alle rutene er truffet, og lengden oppgis", () => {
  let s = battle();
  s = B.shoot(s, at(3, 0));
  assert.equal(s.last.result, "hit");
  assert.equal(B.shipsLeft(s.boards[CPU]), 4);
  s = B.shoot(s, at(3, 1));
  assert.equal(s.last.result, "sunk");
  assert.equal(s.last.len, 2);
  assert.equal(B.shipsLeft(s.boards[CPU]), 3);
  assert.equal(s.current, HUMAN, "senket er også treff og gir nytt skudd");
});

test("du kan ikke skyte på samme rute to ganger", () => {
  const s = B.shoot(battle(), at(0, 0));
  assert.equal(B.shoot(s, at(0, 0)), s);
  assert.equal(B.shoot(s, -1), s);
  assert.equal(B.shoot(s, N), s);
});

test("den som først senker hele flåten, vinner, og da er spillet slutt", () => {
  let s = battle();
  const cells = s.boards[CPU].ships.flatMap((ship) => ship.cells);
  for (const c of cells) s = B.shoot(s, c);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, HUMAN);
  assert.deepEqual(s.shots, [12, 0]);
  assert.equal(B.shoot(s, at(7, 7)), s);
});

test("datamaskinen vinner når den senker hele flåten din", () => {
  let s = B.shoot(battle(), at(7, 7));
  for (const c of s.boards[HUMAN].ships.flatMap((ship) => ship.cells)) s = B.shoot(s, c);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, CPU);
});

// ---------- Det datamaskinen vet ----------

test("datamaskinen jukser ikke: den ser bare bom, treff og senket", () => {
  const a = B.start(placedState(), seeded(1)).boards[CPU];
  const b = B.start(placedState(), seeded(2)).boards[CPU];
  assert.deepEqual(B.view(a), B.view(b), "to ulike flåter ser like ut før det er skutt");

  let s = battle();
  s = B.shoot(s, at(0, 0)); // treff
  s = B.shoot(s, at(3, 0));
  s = B.shoot(s, at(3, 1)); // senket toer
  s = B.shoot(s, at(7, 7)); // bom
  const v = B.view(s.boards[CPU]);
  assert.equal(v.cells[at(0, 0)], "hit");
  assert.equal(v.cells[at(3, 0)], "sunk");
  assert.equal(v.cells[at(3, 1)], "sunk");
  assert.equal(v.cells[at(7, 7)], "miss");
  assert.equal(v.cells[at(0, 1)], null, "ruter det ikke er skutt på, er ukjente");
  assert.deepEqual(v.remaining, [4, 3, 3]);
  assert.deepEqual(Object.keys(v).sort(), ["cells", "remaining"]);
});

test("datamaskinen skyter aldri på en rute den alt har skutt på", () => {
  for (const level of ["lett", "middels", "vanskelig"]) {
    const rand = seeded(7);
    let s = battle();
    s = { ...s, current: CPU };
    const seen = new Set();
    while (s.phase === "playing") {
      const i = B.chooseMove(B.view(s.boards[HUMAN]), level, rand);
      assert.ok(!seen.has(i), level + " skjøt to ganger på " + i);
      seen.add(i);
      s = { ...B.shoot(s, i), current: CPU };
    }
    assert.equal(s.winner, CPU);
  }
});

test("chooseMove gir null når alle ruter er skutt på", () => {
  const v = { cells: new Array(N).fill("miss"), remaining: [] };
  for (const level of ["lett", "middels", "vanskelig"]) assert.equal(B.chooseMove(v, level, seeded(1)), null);
});

test("lett følger opp et treff omtrent annenhver gang", () => {
  const v = blankView();
  v.cells[at(3, 3)] = "hit";
  const near = new Set([at(2, 3), at(4, 3), at(3, 2), at(3, 4)]);
  const rand = seeded(11);
  let followed = 0;
  for (let k = 0; k < 400; k++) if (near.has(B.chooseMove(v, "lett", rand))) followed++;
  assert.ok(followed > 150 && followed < 280, "fulgte opp " + followed + " av 400");
});

test("middels leter i rutemønster når den ikke har noe treff å følge opp", () => {
  const rand = seeded(3);
  const v = blankView();
  v.cells[at(0, 0)] = "miss";
  v.cells[at(5, 5)] = "sunk";
  for (let k = 0; k < 200; k++) {
    const i = B.chooseMove(v, "middels", rand);
    assert.equal((Math.floor(i / SIZE) + (i % SIZE)) % 2, 0);
    assert.equal(v.cells[i], null);
  }
});

test("middels følger alltid opp et treff i en rute ved siden av", () => {
  const rand = seeded(4);
  const v = blankView();
  v.cells[at(3, 3)] = "hit";
  v.cells[at(2, 3)] = "miss";
  const near = [at(4, 3), at(3, 2), at(3, 4)];
  for (let k = 0; k < 100; k++) assert.ok(near.includes(B.chooseMove(v, "middels", rand)));
});

test("middels fortsetter i forlengelsen av to treff på rad", () => {
  const rand = seeded(5);
  const v = blankView();
  v.cells[at(3, 3)] = "hit";
  v.cells[at(3, 4)] = "hit";
  for (let k = 0; k < 100; k++) assert.ok([at(3, 2), at(3, 5)].includes(B.chooseMove(v, "middels", rand)));
  v.cells[at(3, 2)] = "miss";
  assert.equal(B.chooseMove(v, "middels", rand), at(3, 5));
});

test("middels følger opp treff i hjørnet uten å gå utenfor brettet", () => {
  const rand = seeded(6);
  const v = blankView();
  v.cells[at(0, 7)] = "hit";
  for (let k = 0; k < 50; k++) assert.ok([at(0, 6), at(1, 7)].includes(B.chooseMove(v, "middels", rand)));
  v.cells[at(0, 7)] = null;
  v.cells[at(2, 0)] = "hit"; // venstre kant: ruten «til venstre» er ikke slutten av raden over
  for (let k = 0; k < 50; k++) assert.ok([at(1, 0), at(3, 0), at(2, 1)].includes(B.chooseMove(v, "middels", rand)));
});

test("et senket skip følges ikke opp", () => {
  const v = blankView([4, 3, 3]);
  v.cells[at(3, 3)] = "sunk";
  v.cells[at(3, 4)] = "sunk";
  assert.deepEqual(B.followUps(v), []);
});

test("vanskelig skyter i forlengelsen av to treff på rad", () => {
  const rand = seeded(8);
  const v = blankView();
  v.cells[at(3, 3)] = "hit";
  v.cells[at(3, 4)] = "hit";
  for (let k = 0; k < 50; k++) assert.ok([at(3, 2), at(3, 5)].includes(B.chooseMove(v, "vanskelig", rand)));
});

test("vanskelig skyter aldri der ingen av skipene som er igjen, får plass", () => {
  const rand = seeded(9);
  const v = blankView();
  v.cells[at(0, 1)] = "miss";
  v.cells[at(1, 0)] = "miss"; // hjørnet (0,0) er stengt inne
  assert.equal(B.density(v)[at(0, 0)], 0);
  for (let k = 0; k < 100; k++) assert.notEqual(B.chooseMove(v, "vanskelig", rand), at(0, 0));

  // Bare fireren igjen: en luke på tre ruter er for liten.
  const w = blankView([4]);
  w.cells[at(0, 3)] = "miss";
  w.cells[at(1, 0)] = w.cells[at(1, 1)] = w.cells[at(1, 2)] = "sunk";
  const d = B.density(w);
  assert.equal(d[at(0, 0)], 0);
  assert.equal(d[at(0, 1)], 0);
  assert.equal(d[at(0, 2)], 0);
});

test("vanskelig foretrekker midten av brettet fremfor hjørnene når ingenting er kjent", () => {
  const d = B.density(blankView());
  assert.ok(d[at(3, 3)] > d[at(0, 0)]);
  const i = B.chooseMove(blankView(), "vanskelig", seeded(1));
  const r = Math.floor(i / SIZE), c = i % SIZE;
  assert.ok(r >= 2 && r <= 5 && c >= 2 && c <= 5);
});

test("nivåene er forskjellige: vanskelig trenger færrest skudd, lett flest", () => {
  const average = (level) => {
    let total = 0;
    const games = 150;
    for (let g = 1; g <= games; g++) {
      const rand = seeded(g);
      let s = battle();
      s = { ...s, boards: [{ ships: B.randomFleet(rand), shots: s.boards[HUMAN].shots }, s.boards[CPU]], current: CPU };
      while (s.phase === "playing") {
        s = { ...B.shoot(s, B.chooseMove(B.view(s.boards[HUMAN]), level, rand)), current: CPU };
      }
      total += s.shots[CPU];
    }
    return total / games;
  };
  const lett = average("lett");
  const middels = average("middels");
  const vanskelig = average("vanskelig");
  assert.ok(vanskelig < middels, `vanskelig ${vanskelig} < middels ${middels}`);
  assert.ok(middels < lett, `middels ${middels} < lett ${lett}`);
});

// ---------- Hele spill ----------

test("et helt spill med fast frø blir ferdig på hvert nivå", () => {
  for (const level of ["lett", "middels", "vanskelig"]) {
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seeded(seed * 31);
      let s = B.start(B.placeRandom(B.create(), rand), rand);
      let steps = 0;
      while (s.phase === "playing") {
        const shooter = s.current;
        const target = s.boards[1 - shooter];
        // «Spilleren» skyter som middels datamaskin.
        const i = B.chooseMove(B.view(target), shooter === HUMAN ? "middels" : level, rand);
        const next = B.shoot(s, i);
        assert.notEqual(next, s, "skuddet må være lovlig");
        assert.equal(next.shots[shooter], s.shots[shooter] + 1);
        assert.equal(next.shots[1 - shooter], s.shots[1 - shooter]);
        if (next.phase === "playing") {
          assert.equal(next.current, next.last.result === "miss" ? 1 - shooter : shooter);
        }
        for (const p of [HUMAN, CPU]) {
          const fired = next.boards[1 - p].shots.filter(Boolean).length;
          assert.equal(fired, next.shots[p], "antall skudd stemmer med brettet");
        }
        s = next;
        assert.ok(++steps <= 2 * N, "spillet må ta slutt");
      }
      assert.equal(s.phase, "over");
      assert.ok(s.winner === HUMAN || s.winner === CPU);
      assert.equal(B.shipsLeft(s.boards[1 - s.winner]), 0);
      assert.ok(B.shipsLeft(s.boards[s.winner]) > 0, "vinneren har minst ett skip igjen");
    }
  }
});

// ---------- Seiersrekke ----------

test("seier øker rekken med 1, tap og forlatt spill nullstiller den", () => {
  assert.equal(B.nextStreak(0, "win"), 1);
  assert.equal(B.nextStreak(3, "win"), 4);
  assert.equal(B.nextStreak(3, "loss"), 0);
  assert.equal(B.nextStreak(3, "abandon"), 0);
});
