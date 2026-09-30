const { test } = require("node:test");
const assert = require("node:assert/strict");
const A = require("./logic.js");

const DT = 1 / 60;

// Fast frø for tilfeldighet (mulberry32).
function seeded(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Et spill uten nye asteroider, så testen styrer alt som er på brettet.
function quiet(extra) {
  return Object.assign(A.create(), { toSpawn: 0, wavePause: 1e9 }, extra || {});
}

function run(s, seconds, input, rand) {
  rand = rand || seeded(1);
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) s = A.step(s, DT, input, rand);
  return s;
}

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// ---------- Sikting og sving ----------

test("aimAngle gir vinkelen fra skipet til punktet", () => {
  const ship = { x: 300, y: 300 };
  close(A.aimAngle(ship, { x: 400, y: 300 }), 0);
  close(A.aimAngle(ship, { x: 300, y: 400 }), Math.PI / 2);
  close(A.aimAngle(ship, { x: 300, y: 200 }), -Math.PI / 2);
  close(Math.abs(A.aimAngle(ship, { x: 200, y: 300 })), Math.PI);
});

test("angleDiff går korteste vei rundt", () => {
  close(A.angleDiff(0.1, -0.1), 0.2);
  close(A.angleDiff(-Math.PI + 0.1, Math.PI - 0.1), 0.2);
  close(A.angleDiff(Math.PI - 0.1, -Math.PI + 0.1), -0.2);
});

test("skipet står fast i midten og peker opp ved start", () => {
  const s = A.create();
  assert.equal(s.ship.x, A.W / 2);
  assert.equal(s.ship.y, A.H / 2);
  close(s.ship.angle, -Math.PI / 2);
  assert.equal(s.lives, 3);
});

test("← og → snur skipet med fast fart", () => {
  let s = quiet();
  const start = s.ship.angle;
  s = run(s, 0.5, { turn: 1 });
  close(A.angleDiff(s.ship.angle, start), A.TURN_SPEED * 0.5, 1e-6);
  s = run(s, 0.25, { turn: -1 });
  close(A.angleDiff(s.ship.angle, start), A.TURN_SPEED * 0.25, 1e-6);
  assert.equal(s.ship.x, A.W / 2); // skipet flytter seg ikke
});

test("sikting snur skipet mot punktet og stopper der", () => {
  let s = quiet();
  const target = 0.3;
  s = run(s, 1, { aim: target });
  close(s.ship.angle, target);
});

test("sikting skyter ikke før skipet peker riktig vei", () => {
  let s = quiet();
  s = A.step(s, DT, { aim: Math.PI / 2, fire: true }, seeded(1)); // rett ned, skipet peker opp
  assert.equal(s.bullets.length, 0);
  s = run(s, 0.5, { aim: Math.PI / 2, fire: true });
  assert.ok(s.bullets.length > 0);
});

// ---------- Skudd ----------

test("mellomrom skyter et skudd i den retningen skipet peker", () => {
  let s = quiet();
  s = A.step(s, DT, { fire: true }, seeded(1));
  assert.equal(s.bullets.length, 1);
  assert.equal(s.shots, 1);
  const b = s.bullets[0];
  assert.ok(Math.abs(b.vx) < 1e-9 && b.vy < 0, "skuddet går oppover");
});

test("nedkjøling: holder du inne, kommer det ett skudd per 0,2 s", () => {
  let s = quiet();
  s = run(s, 1.0 - DT / 2, { fire: true });
  assert.equal(s.shots, 5); // ved 0, 0,2, 0,4, 0,6 og 0,8 s
});

test("høyst fire skudd i lufta samtidig", () => {
  let s = quiet();
  let most = 0;
  for (let i = 0; i < 240; i++) {
    s = A.step(s, DT, { fire: true }, seeded(1));
    most = Math.max(most, s.bullets.length);
    if (i < 3) s = Object.assign({}, s, { cooldown: 0 }); // fjern nedkjølingen for å teste grensen
  }
  assert.equal(most, A.MAX_BULLETS);
  const burst = quiet();
  let t = burst;
  for (let i = 0; i < 10; i++) t = A.step(Object.assign({}, t, { cooldown: 0 }), DT, { fire: true }, seeded(1));
  assert.equal(t.bullets.length, A.MAX_BULLETS);
});

test("skudd forsvinner når de går ut av brettet", () => {
  let s = quiet();
  s = A.step(s, DT, { fire: true }, seeded(1));
  assert.equal(s.bullets.length, 1);
  s = run(s, 0.5, {}); // 240 enheter – fortsatt inne
  assert.equal(s.bullets.length, 1);
  s = run(s, 0.3, {}); // over kanten
  assert.equal(s.bullets.length, 0);
});

// ---------- Treff og poeng ----------

test("treff deler en stor asteroide i to mellomstore og gir 20 poeng", () => {
  let s = quiet({ asteroids: [A.asteroid(3, 300, 150, 0, 0, { id: 1 })] });
  s = A.step(s, DT, { fire: true }, seeded(1)); // ett skudd
  s = run(s, 0.4, {});
  const sizes = s.asteroids.map((a) => a.size).sort();
  assert.deepEqual(sizes, [2, 2]);
  assert.equal(s.score, 20);
});

test("mellomstor deler seg i to små og gir 50 poeng", () => {
  let s = quiet({ asteroids: [A.asteroid(2, 300, 150, 0, 0)] });
  s = A.step(s, DT, { fire: true }, seeded(1));
  s = run(s, 0.4, {});
  assert.deepEqual(s.asteroids.map((a) => a.size), [1, 1]);
  assert.equal(s.score, 50);
});

test("minste asteroide forsvinner og gir flest poeng (100)", () => {
  let s = quiet({ asteroids: [A.asteroid(1, 300, 150, 0, 0)] });
  s = A.step(s, DT, { fire: true }, seeded(1));
  s = run(s, 0.4, {});
  assert.equal(s.asteroids.length, 0);
  assert.equal(s.bullets.length, 0, "skuddet forsvinner ved treff");
  assert.equal(s.score, 100);
  assert.ok(A.SIZES[1].points > A.SIZES[2].points && A.SIZES[2].points > A.SIZES[3].points);
});

test("bitene flyr ut til hver side og fortere enn den som ble truffet", () => {
  let s = quiet({ asteroids: [A.asteroid(3, 300, 150, 40, 0)] });
  s = A.step(s, DT, { fire: true }, seeded(1));
  s = run(s, 0.4, {});
  assert.equal(s.asteroids.length, 2);
  const [p, q] = s.asteroids;
  assert.ok(Math.sign(p.vy) !== Math.sign(q.vy), "én går opp, én går ned");
  for (const a of s.asteroids) assert.ok(Math.hypot(a.vx, a.vy) > 40);
});

// ---------- Skipet blir truffet ----------

test("kollisjon med skipet koster ett liv og knuser asteroiden uten poeng", () => {
  let s = quiet({ asteroids: [A.asteroid(3, 300, 200, 0, 100)] });
  s = run(s, 1, {});
  assert.equal(s.lives, 2);
  assert.equal(s.asteroids.length, 0);
  assert.equal(s.score, 0);
  assert.ok(s.invuln > 0);
});

test("usårbar etter treff: asteroider går gjennom skipet i 2 sekunder", () => {
  let s = quiet({ invuln: A.INVULN, asteroids: [A.asteroid(1, 300, 300, 0, 0)] });
  s = run(s, 1.5, {});
  assert.equal(s.lives, 3);
  s = run(s, 0.6, {});
  assert.equal(s.lives, 2);
});

test("spillet er over når alle tre livene er brukt opp", () => {
  let s = quiet({ lives: 1, asteroids: [A.asteroid(2, 300, 300, 0, 0)] });
  s = A.step(s, DT, {}, seeded(1));
  assert.equal(s.lives, 0);
  assert.equal(s.status, "over");
  const after = A.step(s, DT, { fire: true }, seeded(1));
  assert.equal(after, s, "ingenting skjer etter at spillet er over");
});

// ---------- Bølger ----------

test("asteroidene kommer inn fra kanten og er på vei inn mot midten", () => {
  let s = A.create();
  const rand = seeded(3);
  for (let i = 0; i < 200 && s.asteroids.length === 0; i++) s = A.step(s, DT, {}, rand);
  assert.equal(s.asteroids.length, 1);
  const a = s.asteroids[0];
  assert.equal(a.size, 3);
  const outside = a.x <= 0 || a.x >= A.W || a.y <= 0 || a.y >= A.H;
  assert.ok(outside, "starter utenfor kanten");
  const toCenter = (A.W / 2 - a.x) * a.vx + (A.H / 2 - a.y) * a.vy;
  assert.ok(toCenter > 0, "på vei innover");
});

test("asteroider som har passert og er langt ute, forsvinner", () => {
  let s = quiet({ asteroids: [A.asteroid(3, 580, 300, 200, 0)] });
  s = run(s, 2, {});
  assert.equal(s.asteroids.length, 0);
  assert.equal(s.score, 0);
});

test("bølgene blir større, tettere og raskere", () => {
  const w1 = A.waveConfig(1);
  const w2 = A.waveConfig(2);
  const w5 = A.waveConfig(5);
  assert.equal(w1.count, 4);
  assert.equal(w2.count, 6);
  assert.ok(w2.interval < w1.interval && w5.interval < w2.interval);
  assert.ok(w2.speed > w1.speed && w5.speed > w2.speed);
  assert.equal(A.waveConfig(50).interval, 0.6);
});

test("bølge 1 har fire store asteroider", () => {
  let s = A.create();
  const rand = seeded(7);
  const ids = new Set();
  s = Object.assign(s, { invuln: 1e9 }); // la dem gå gjennom skipet
  for (let i = 0; i < 60 * 15; i++) {
    s = A.step(s, DT, {}, rand);
    for (const a of s.asteroids) ids.add(a.id);
  }
  assert.equal(ids.size, 4);
});

test("når bølgen er ryddet, kommer neste etter en pause", () => {
  let s = Object.assign(A.create(), { toSpawn: 0 });
  s = A.step(s, DT, {}, seeded(1));
  assert.equal(s.wavePause, A.WAVE_PAUSE);
  assert.ok(s.events.some((e) => e.type === "clear"));
  s = run(s, A.WAVE_PAUSE - 0.1, {});
  assert.equal(s.wave, 1);
  s = run(s, 0.2, {});
  assert.equal(s.wave, 2);
  assert.ok(s.toSpawn > 0);
  s = run(s, 0.5, {});
  assert.equal(s.asteroids.length, 1);
  const speed = Math.hypot(s.asteroids[0].vx, s.asteroids[0].vy);
  assert.ok(speed >= 45 * A.waveConfig(2).speed - 1e-9);
});

test("aldri flere asteroider enn grensen", () => {
  const many = [];
  for (let i = 0; i < A.MAX_ASTEROIDS; i++) many.push(A.asteroid(3, 20 + (i % 10) * 3, 20, 0, 0));
  let s = quiet({ asteroids: many, ship: { x: 300, y: 300, angle: A.aimAngle({ x: 300, y: 300 }, { x: 30, y: 20 }) } });
  s = run(s, 1, { fire: true });
  assert.ok(s.asteroids.length <= A.MAX_ASTEROIDS);
});

// ---------- Hele spill ----------

function autopilot(s) {
  let best = null;
  let dist = Infinity;
  for (const a of s.asteroids) {
    const d = Math.hypot(a.x - s.ship.x, a.y - s.ship.y);
    if (d < dist) {
      dist = d;
      best = a;
    }
  }
  return best ? { aim: A.aimAngle(s.ship, best), fire: true } : {};
}

function simulate(seed, limitSeconds) {
  let s = A.create();
  const rand = seeded(seed);
  let maxAst = 0;
  const steps = Math.round(limitSeconds / DT);
  for (let i = 0; i < steps && s.status === "playing"; i++) {
    s = A.step(s, DT, autopilot(s), rand);
    for (const o of [s.ship, ...s.bullets, ...s.asteroids]) {
      for (const k of ["x", "y"]) assert.ok(Number.isFinite(o[k]), "ingen NaN");
    }
    assert.ok(Number.isFinite(s.ship.angle) && Number.isFinite(s.score));
    assert.ok(s.bullets.length <= A.MAX_BULLETS);
    assert.ok(s.asteroids.length <= A.MAX_ASTEROIDS);
    assert.ok(s.lives >= 0 && s.lives <= A.LIVES);
    maxAst = Math.max(maxAst, s.asteroids.length);
  }
  return { s, maxAst };
}

test("autopilot med fast frø spiller til spillet slutter eller tidsloftet nås", () => {
  for (const seed of [1, 2, 3]) {
    const { s } = simulate(seed, 20 * 60);
    assert.ok(s.score > 0, "autopiloten treffer noe");
    assert.ok(s.wave >= 2, "kommer minst til bølge 2");
    assert.ok(s.status === "over" || s.time >= 20 * 60 - 1);
  }
});

test("et spill uten å skyte er over etter noen få minutter", () => {
  let s = A.create();
  const rand = seeded(5);
  while (s.status === "playing" && s.time < 600) s = A.step(s, DT, {}, rand);
  assert.equal(s.status, "over");
  assert.ok(s.time < 180, "over på under tre minutter: " + s.time.toFixed(1) + " s");
});

if (process.env.ASTEROIDER_STATS) {
  test("statistikk (bare ved behov)", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { s, maxAst } = simulate(seed, 20 * 60);
      console.log(`frø ${seed}: ${s.status}, ${s.time.toFixed(0)} s, bølge ${s.wave}, ${s.score} poeng, maks ${maxAst} asteroider`);
    }
  });
}
