const { test } = require("node:test");
const assert = require("node:assert/strict");
const B = require("./logic.js");

const DT = B.STEP;
const none = { left: false, right: false, targetX: null, launch: false };

// Fast frø for tilfeldighet.
function seeded(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

// Tilstand der ballen er i spill med gitt posisjon og fart, og uten klosser (med mindre de sendes inn).
function playing(ball, bricks = [], extra = {}) {
  const s = B.create();
  return { ...s, status: "playing", ball: { ...ball }, bricks, speed: Math.hypot(ball.vx, ball.vy), ...extra };
}

function brick(x, y, w = 30, h = B.BRICK_H, hp = 1, points = 1) {
  return { x, y, w, h, row: 0, hp, maxHp: hp, points };
}

function run(s, steps, input = none, rand = () => 0.5) {
  for (let i = 0; i < steps; i++) s = B.step(s, DT, input, rand);
  return s;
}

// ---------- Oppstart ----------

test("spillet starter med tre liv, brett 1, 0 poeng og ballen på racketen", () => {
  const s = B.create();
  assert.equal(s.lives, 3);
  assert.equal(s.level, 1);
  assert.equal(s.score, 0);
  assert.equal(s.status, "serve");
  assert.equal(s.ball.x, s.paddle.x);
  assert.ok(s.ball.y < B.PADDLE_Y);
});

test("brett 1 har 8 × 5 klosser, og hvert nytt brett får én rad til, opp til 7", () => {
  assert.equal(B.makeBricks(1).length, 40);
  assert.equal(B.makeBricks(2).length, 48);
  assert.equal(B.makeBricks(3).length, 56);
  assert.equal(B.makeBricks(9).length, 56);
});

test("klossene får plass innenfor veggene og overlapper ikke", () => {
  const bricks = B.makeBricks(3);
  for (const b of bricks) {
    assert.ok(b.x >= 0 && b.x + b.w <= B.W + 1e-9);
    assert.ok(b.y + b.h < B.PADDLE_Y);
  }
  for (let i = 0; i < bricks.length; i++)
    for (let j = i + 1; j < bricks.length; j++) {
      const a = bricks[i], c = bricks[j];
      const overlap = a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
      assert.ok(!overlap, "kloss " + i + " og " + j + " overlapper");
    }
});

test("poeng per rad: nederst 1, så 3, 5 og 7", () => {
  const rows = 7;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((r) => B.pointsFor(r, rows)), [7, 5, 5, 3, 3, 1, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => B.pointsFor(r, 5)), [5, 3, 3, 1, 1]);
});

test("fra brett 3 tåler øverste rad to treff, fra brett 5 de to øverste", () => {
  const hp = (level) => [...new Set(B.makeBricks(level).filter((b) => b.hp === 2).map((b) => b.row))];
  assert.deepEqual(hp(1), []);
  assert.deepEqual(hp(2), []);
  assert.deepEqual(hp(3), [0]);
  assert.deepEqual(hp(5), [0, 1]);
});

// ---------- Racket og serve ----------

test("ballen ligger på racketen og følger den til den sendes ut", () => {
  let s = run(B.create(), 30, { ...none, right: true });
  assert.equal(s.status, "serve");
  assert.ok(s.paddle.x > B.W / 2);
  assert.equal(s.ball.x, s.paddle.x);
});

test("mellomrom eller trykk sender ballen oppover med brettets fart", () => {
  const s = B.step(B.create(), DT, { ...none, launch: true }, () => 0.5);
  assert.equal(s.status, "playing");
  assert.ok(s.ball.vy < 0);
  assert.ok(Math.abs(Math.hypot(s.ball.vx, s.ball.vy) - B.levelSpeed(1)) < 1e-9);
  assert.ok(s.events.includes("launch"));
});

test("serven får en liten tilfeldig vinkel", () => {
  const left = B.step(B.create(), DT, { ...none, launch: true }, () => 0);
  const right = B.step(B.create(), DT, { ...none, launch: true }, () => 0.999);
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0);
  const maxVx = B.levelSpeed(1) * Math.sin(B.MAX_SERVE) + 1e-9;
  assert.ok(Math.abs(left.ball.vx) <= maxVx && Math.abs(right.ball.vx) <= maxVx);
});

test("racketen stopper ved veggene", () => {
  let s = run(B.create(), 400, { ...none, left: true });
  assert.equal(s.paddle.x, B.PADDLE_W / 2);
  s = B.step(s, DT, { ...none, targetX: 10000 });
  assert.equal(s.paddle.x, B.W - B.PADDLE_W / 2);
});

test("med peker følger racketen pekeren direkte", () => {
  const s = B.step(B.create(), DT, { ...none, targetX: 100 });
  assert.equal(s.paddle.x, 100);
});

test("midt på racketen spretter ballen rett opp", () => {
  const s0 = playing({ x: 160, y: B.PADDLE_Y - 10, vx: 0, vy: 200 });
  const s = run(s0, 10);
  assert.ok(s.ball.vy < 0);
  assert.ok(Math.abs(s.ball.vx) < 1e-9);
});

test("ytterst på racketen spretter ballen skrått ut mot den siden", () => {
  const right = run(playing({ x: 160 + 28, y: B.PADDLE_Y - 10, vx: 0, vy: 200 }), 10);
  const left = run(playing({ x: 160 - 28, y: B.PADDLE_Y - 10, vx: 0, vy: 200 }), 10);
  assert.ok(right.ball.vy < 0 && right.ball.vx > 0);
  assert.ok(left.ball.vy < 0 && left.ball.vx < 0);
  // Aldri flatere enn 60° fra loddrett.
  const angle = Math.atan2(Math.abs(right.ball.vx), -right.ball.vy);
  assert.ok(angle <= B.MAX_BOUNCE + 1e-9);
  assert.ok(angle > (40 * Math.PI) / 180);
});

// ---------- Vegger ----------

test("ballen spretter av venstre og høyre vegg og taket", () => {
  let s = run(playing({ x: 10, y: 200, vx: -200, vy: 0 }), 10);
  assert.ok(s.ball.vx > 0 && s.ball.x >= B.BALL_R);
  s = run(playing({ x: B.W - 10, y: 200, vx: 200, vy: 0 }), 10);
  assert.ok(s.ball.vx < 0 && s.ball.x <= B.W - B.BALL_R);
  s = run(playing({ x: 160, y: 10, vx: 0, vy: -200 }), 10);
  assert.ok(s.ball.vy > 0 && s.ball.y >= B.BALL_R);
});

// ---------- Klosser ----------

test("ballen knuser en kloss, gir poeng og spretter tilbake", () => {
  const s0 = playing({ x: 160, y: 130, vx: 0, vy: -200 }, [brick(145, 100, 30, 14, 1, 3), brick(10, 10)]);
  const s = run(s0, 30);
  assert.equal(s.bricks[0].hp, 0);
  assert.equal(s.score, 3);
  assert.ok(s.ball.vy > 0);
  assert.equal(s.bricks[1].hp, 1);
});

test("treff fra siden snur ballen sidelengs", () => {
  const s0 = playing({ x: 120, y: 107, vx: 200, vy: 0.001 }, [brick(140, 100), brick(10, 10)]);
  const s = run(s0, 30);
  assert.equal(s.bricks[0].hp, 0);
  assert.ok(s.ball.vx < 0);
});

test("en kloss som tåler to treff, gir poeng først når den knuses", () => {
  let s = playing({ x: 160, y: 130, vx: 0, vy: -200 }, [brick(145, 100, 30, 14, 2, 5), brick(10, 10)]);
  s = run(s, 30);
  assert.equal(s.bricks[0].hp, 1);
  assert.equal(s.score, 0);
  // Send ballen opp igjen.
  s = { ...s, ball: { x: 160, y: 130, vx: 0, vy: -200 } };
  s = run(s, 30);
  assert.equal(s.bricks[0].hp, 0);
  assert.equal(s.score, 5);
});

test("ballen går litt fortere for hver kloss, men høyst 35 % over startfarten", () => {
  const start = B.levelSpeed(1);
  let s = playing({ x: 160, y: 130, vx: 0, vy: -start }, [brick(145, 100), brick(10, 10), brick(280, 10)]);
  s = run(s, 30);
  assert.ok(Math.abs(s.speed - start * (1 + B.HIT_FACTOR)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(s.ball.vx, s.ball.vy) - s.speed) < 1e-9);
  s = { ...s, hits: 100 };
  s = { ...s, ball: { x: 25, y: 60, vx: 0, vy: -s.speed } };
  s = run(s, 30);
  assert.ok(Math.abs(s.speed - start * (1 + B.MAX_HIT_BOOST)) < 1e-9);
});

test("ballen tunnelerer ikke gjennom en kloss ved svært høy fart", () => {
  // 20 000 enheter/s: over 160 enheter per tidssteg, mye mer enn klossens høyde.
  const s0 = playing({ x: 160, y: 200, vx: 0, vy: -20000 }, [brick(145, 100, 30, 6), brick(10, 10)]);
  const s = B.step(s0, DT, none, () => 0.5);
  assert.equal(s.bricks[0].hp, 0, "klossen skulle vært truffet");
  assert.ok(s.ball.vy > 0);
  assert.ok(s.ball.y > 100 + 6, "ballen skal være under klossen");
});

test("ballen tunnelerer ikke gjennom en tynn kloss på skrå ved høy fart", () => {
  const s0 = playing({ x: 60, y: 300, vx: 8000, vy: -12000 }, [brick(100, 150, 200, 4), brick(10, 10)]);
  const s = run(s0, 3);
  assert.equal(s.bricks[0].hp, 0);
});

test("ballen tunnelerer ikke gjennom racketen ved svært høy fart", () => {
  const s0 = playing({ x: 160, y: 250, vx: 0, vy: 20000 });
  const s = B.step(s0, DT, none, () => 0.5);
  assert.ok(s.events.includes("paddle"));
  assert.ok(s.ball.vy < 0);
  assert.equal(s.lives, 3);
});

test("bare én kloss knuses per treff i skjøten mellom to klosser", () => {
  const s0 = playing({ x: 160, y: 130, vx: 0, vy: -200 }, [brick(130, 100, 30), brick(160, 100, 30), brick(10, 10)]);
  const s = run(s0, 30);
  assert.equal(s.bricks.filter((b) => b.hp === 0).length, 1);
  assert.ok(s.ball.vy > 0);
});

// ---------- Liv, brett og slutt ----------

test("ballen ut i bunnen koster et liv og legger ballen på racketen igjen", () => {
  const s0 = playing({ x: 10, y: B.H - 10, vx: 0, vy: 300 }, B.makeBricks(1), { hits: 5, speed: 300 });
  const s = run(s0, 20);
  assert.equal(s.lives, 2);
  assert.equal(s.status, "serve");
  assert.ok(s.events.includes("life") || s.lives === 2);
  assert.equal(s.speed, B.levelSpeed(1), "farten nullstilles til brettets startfart");
  assert.equal(s.hits, 0);
});

test("spillet er over når tredje liv er brukt, og står da stille", () => {
  const s0 = playing({ x: 10, y: B.H - 10, vx: 0, vy: 300 }, B.makeBricks(1), { lives: 1, score: 42 });
  let s = run(s0, 20);
  assert.equal(s.lives, 0);
  assert.equal(s.status, "over");
  const after = run(s, 50, { ...none, launch: true, right: true });
  assert.equal(after.status, "over");
  assert.equal(after.score, 42);
  assert.deepEqual(after.ball, s.ball);
});

test("når siste kloss knuses, kommer et nytt brett med raskere ball", () => {
  const s0 = playing({ x: 160, y: 130, vx: 0, vy: -200 }, [brick(145, 100, 30, 14, 1, 1)], { score: 10 });
  const s = run(s0, 30);
  assert.equal(s.level, 2);
  assert.equal(s.status, "serve");
  assert.equal(s.bricks.length, 48);
  assert.equal(s.score, 11);
  assert.equal(s.lives, 3);
  assert.ok(B.levelSpeed(2) > B.levelSpeed(1));
  assert.equal(s.speed, B.levelSpeed(2));
});

test("farten per brett øker med 12 %, men har et tak", () => {
  assert.ok(Math.abs(B.levelSpeed(2) / B.levelSpeed(1) - 1.12) < 1e-9);
  assert.equal(B.levelSpeed(50), B.MAX_LEVEL_SPEED);
});

test("advance kjører faste steg og tar vare på resten", () => {
  const { state, rest } = B.advance(B.create(), DT * 3.5, { ...none, right: true }, () => 0.5);
  assert.ok(Math.abs(rest - DT * 0.5) < 1e-9);
  assert.ok(Math.abs(state.paddle.x - (B.W / 2 + 3 * DT * B.PADDLE_SPEED)) < 1e-9);
});

test("ett trykk gir bare én serve, selv om flere steg kjøres", () => {
  const { state } = B.advance(B.create(), DT * 10, { ...none, launch: true }, () => 0.5);
  assert.equal(state.events.filter((e) => e === "launch").length, 1);
  assert.equal(state.status, "playing");
});

// ---------- Simulering ----------

// Autopilot: racketen følger ballen, med en forskyvning som byttes ved hvert sprett,
// så ballen ikke blir gående rett opp og ned.
function simulate({ seed, miss = 0, maxLevels = 3, maxSteps = 120 * 60 * 20 }) {
  const rand = seeded(seed);
  const aim = seeded(seed + 1000);
  let s = B.create();
  let offset = 0;
  let steps = 0;
  const invariants = [];
  while (s.status !== "over" && s.level <= maxLevels && steps < maxSteps) {
    const input = { ...none, launch: s.status === "serve", targetX: s.ball.x - offset };
    s = B.step(s, DT, input, rand);
    steps++;
    if (s.events.includes("paddle") || s.events.includes("launch")) {
      // Av og til bommer autopiloten med vilje, så liv kan gå tapt.
      offset = aim() < miss ? 200 : (aim() - 0.5) * B.PADDLE_W * 0.8;
    }
    // Invarianter: ballen er inne på brettet (eller på vei ut i bunnen), farten er riktig.
    const b = s.ball;
    if (b.x < B.BALL_R - 1e-6 || b.x > B.W - B.BALL_R + 1e-6 || b.y < B.BALL_R - 1e-6) invariants.push("utenfor: " + JSON.stringify(b));
    if (s.status === "playing" && Math.abs(Math.hypot(b.vx, b.vy) - s.speed) > 1e-6) invariants.push("feil fart");
    if (s.status === "playing" && Math.abs(b.vy) < s.speed * 0.3) invariants.push("for flat vinkel");
    for (const k of s.bricks) {
      if (k.hp > 0 && B.hitsRect(b.x, b.y, B.BALL_R - 0.5, k.x, k.y, k.w, k.h)) invariants.push("ballen inni en kloss");
    }
    if (s.lives < 0 || s.score < 0) invariants.push("negativt");
    if (invariants.length) break;
  }
  return { s, steps, invariants };
}

test("simulering med autopilot rydder flere brett uten å bryte reglene", () => {
  const { s, steps, invariants } = simulate({ seed: 7, maxLevels: 3 });
  assert.deepEqual(invariants, []);
  assert.ok(s.level > 3, "autopiloten skulle ryddet tre brett, kom til brett " + s.level + " etter " + steps + " steg");
  assert.ok(s.score > 0);
});

test("simulering med en autopilot som bommer av og til, blir ferdig (game over)", () => {
  for (const seed of [1, 2, 3]) {
    const { s, invariants } = simulate({ seed, miss: 0.15, maxLevels: 99 });
    assert.deepEqual(invariants, []);
    assert.equal(s.status, "over", "frø " + seed + " ble ikke ferdig");
    assert.equal(s.lives, 0);
  }
});
