const { test } = require("node:test");
const assert = require("node:assert/strict");
const Snake = require("./logic.js");

// Fast frø for tilfeldighet (samme LCG som sjekkskriptet).
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
const zero = () => 0;

// Lager en tilstand midt i et spill.
function make({ snake, dir = "right", apple = { x: 0, y: 0 }, cols = 10, rows = 10, score = 0, queue = [] }) {
  return {
    cols, rows, dir, queue, apple, score,
    snake: snake.map(([x, y]) => ({ x, y })),
    status: "playing", acc: 0, crash: null,
  };
}
const cells = (s) => s.snake.map((p) => [p.x, p.y]);

function checkInvariant(s) {
  const seen = new Set();
  for (const p of s.snake) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x < s.cols && p.y < s.rows, "slangen er innenfor brettet");
    const k = p.x + "," + p.y;
    assert.ok(!seen.has(k), "slangen har ingen duplikate ruter");
    seen.add(k);
  }
  assert.equal(s.snake.length, Snake.START_LENGTH + s.score, "lengden er poeng + 3");
  if (s.apple) assert.ok(!seen.has(s.apple.x + "," + s.apple.y), "eplet ligger ikke i slangen");
}

// ---------- Start ----------

test("nytt spill: 15×15, slangen er 3 lang midt på med hodet mot høyre og venter", () => {
  const s = Snake.newGame(seeded(1));
  assert.equal(s.cols, 15);
  assert.equal(s.rows, 15);
  assert.deepEqual(cells(s), [[7, 7], [6, 7], [5, 7]]);
  assert.equal(s.dir, "right");
  assert.equal(s.status, "ready");
  checkInvariant(s);
});

test("slangen står stille til første retning, og tid alene starter ikke spillet", () => {
  const s = Snake.newGame(seeded(1));
  assert.equal(Snake.step(s, 5000, seeded(2)), s);
});

test("første retning starter spillet, men rett bakover ved start ignoreres", () => {
  const s = Snake.newGame(seeded(1));
  assert.equal(Snake.turn(s, "left"), s);
  const up = Snake.turn(s, "up");
  assert.equal(up.status, "playing");
  assert.deepEqual(up.queue, ["up"]);
  const right = Snake.turn(s, "right");
  assert.equal(right.status, "playing");
  assert.deepEqual(right.queue, []);
});

// ---------- Bevegelse ----------

test("ett steg flytter hodet én rute og halen følger etter", () => {
  const s = Snake.tick(make({ snake: [[5, 5], [4, 5], [3, 5]], apple: { x: 0, y: 0 } }), zero);
  assert.deepEqual(cells(s), [[6, 5], [5, 5], [4, 5]]);
  assert.equal(s.score, 0);
});

test("en sving i køen brukes på neste steg", () => {
  let s = make({ snake: [[5, 5], [4, 5], [3, 5]] });
  s = Snake.turn(s, "down");
  s = Snake.tick(s, zero);
  assert.equal(s.dir, "down");
  assert.deepEqual(cells(s)[0], [5, 6]);
  assert.deepEqual(s.queue, []);
});

// ---------- Eple ----------

test("slangen vokser én rute og får ett poeng når den spiser eplet", () => {
  const s = Snake.tick(make({ snake: [[5, 5], [4, 5], [3, 5]], apple: { x: 6, y: 5 } }), seeded(3));
  assert.deepEqual(cells(s), [[6, 5], [5, 5], [4, 5], [3, 5]]);
  assert.equal(s.score, 1);
  assert.notDeepEqual(s.apple, { x: 6, y: 5 });
  checkInvariant(s);
});

test("eplet havner aldri i slangen", () => {
  // Slangen fyller alt unntatt én rute på et 3×3-brett: eplet må havne der.
  const snake = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2]];
  for (const r of [0, 0.3, 0.5, 0.999999]) {
    const apple = Snake.placeApple(snake.map(([x, y]) => ({ x, y })), 3, 3, () => r);
    assert.deepEqual(apple, { x: 2, y: 2 });
  }
  // Og med mange tilfeldige tall på et vanlig brett.
  const rand = seeded(7);
  const s = Snake.newGame(rand);
  for (let i = 0; i < 500; i++) {
    const a = Snake.placeApple(s.snake, s.cols, s.rows, rand);
    assert.ok(!s.snake.some((p) => p.x === a.x && p.y === a.y));
  }
});

test("fyller slangen hele brettet, har du vunnet", () => {
  // 2×2-brett: slangen er 3 lang og spiser det siste eplet.
  const s = Snake.tick(make({ snake: [[0, 1], [0, 0], [1, 0]], dir: "right", apple: { x: 1, y: 1 }, cols: 2, rows: 2 }), zero);
  assert.equal(s.status, "won");
  assert.equal(s.apple, null);
  assert.equal(s.snake.length, 4);
});

// ---------- Krasj ----------

test("krasj i veggen avslutter spillet", () => {
  for (const [dir, head] of [["right", [9, 5]], ["left", [0, 5]], ["up", [5, 0]], ["down", [5, 9]]]) {
    const d = Snake.DIRS[dir];
    const tail = [head[0] - d.x, head[1] - d.y];
    const s = Snake.tick(make({ snake: [head, tail], dir }), zero);
    assert.equal(s.status, "over", dir);
    assert.equal(s.crash.reason, "wall");
  }
});

test("krasj i egen kropp avslutter spillet", () => {
  // Hodet (2,2) går opp til (2,1), der kroppen ligger.
  const s = Snake.tick(
    make({ snake: [[2, 2], [3, 2], [3, 1], [2, 1], [1, 1]], dir: "left", queue: ["up"] }),
    zero
  );
  assert.equal(s.status, "over");
  assert.deepEqual(s.crash, { x: 2, y: 1, reason: "self" });
});

test("slangen kan gå inn i ruta der halen er, fordi halen flytter seg samme steg", () => {
  // Slangen går i ring: hodet (1,1) går opp til (1,0), der halen er.
  const s = Snake.tick(make({ snake: [[1, 1], [2, 1], [2, 0], [1, 0]], dir: "left", queue: ["up"] }), zero);
  assert.equal(s.status, "playing");
  assert.deepEqual(cells(s), [[1, 0], [1, 1], [2, 1], [2, 0]]);
});

test("halen er ikke ledig når slangen vokser samme steg", () => {
  // Kunstig stilling: eplet ligger på halen. Da blir halen stående, og det er krasj.
  const s = Snake.tick(
    make({ snake: [[1, 1], [2, 1], [2, 0], [1, 0]], dir: "left", queue: ["up"], apple: { x: 1, y: 0 } }),
    zero
  );
  assert.equal(s.status, "over");
  assert.equal(s.crash.reason, "self");
});

test("etter krasj skjer det ingenting mer", () => {
  const over = Snake.tick(make({ snake: [[9, 5], [8, 5]] }), zero);
  assert.equal(Snake.tick(over, zero), over);
  assert.equal(Snake.step(over, 1000, zero), over);
  assert.equal(Snake.turn(over, "up"), over);
});

// ---------- 180°-regelen og tastekø ----------

test("sving rett bakover ignoreres, og slangen fortsetter", () => {
  let s = make({ snake: [[5, 5], [4, 5], [3, 5]], dir: "right" });
  s = Snake.turn(s, "left");
  assert.deepEqual(s.queue, []);
  s = Snake.tick(s, zero);
  assert.equal(s.status, "playing");
  assert.deepEqual(cells(s)[0], [6, 5]);
});

test("sving i samme retning som slangen går, legges ikke i køen", () => {
  const s = Snake.turn(make({ snake: [[5, 5], [4, 5]], dir: "right" }), "right");
  assert.deepEqual(s.queue, []);
});

test("to raske svinger mellom to steg brukes på hvert sitt steg", () => {
  let s = make({ snake: [[5, 5], [4, 5], [3, 5]], dir: "right" });
  s = Snake.turn(s, "up");
  s = Snake.turn(s, "left"); // sjekkes mot «opp», ikke mot «høyre»
  assert.deepEqual(s.queue, ["up", "left"]);
  s = Snake.tick(s, zero);
  assert.deepEqual(cells(s)[0], [5, 4]);
  s = Snake.tick(s, zero);
  assert.deepEqual(cells(s)[0], [4, 4]);
  assert.equal(s.status, "playing");
});

test("køen holder maks 2 svinger", () => {
  let s = make({ snake: [[5, 5], [4, 5]], dir: "right" });
  for (const d of ["up", "left", "down", "right"]) s = Snake.turn(s, d);
  assert.deepEqual(s.queue, ["up", "left"]);
});

test("rett bakover sjekkes mot siste sving i køen", () => {
  let s = make({ snake: [[5, 5], [4, 5]], dir: "right" });
  s = Snake.turn(s, "up");
  s = Snake.turn(s, "down"); // motsatt av «opp» – ignoreres
  assert.deepEqual(s.queue, ["up"]);
});

// ---------- Fart ----------

test("farten øker med hvert eple ned til en nedre grense", () => {
  assert.equal(Snake.interval(0), 160);
  assert.equal(Snake.interval(1), 156);
  assert.equal(Snake.interval(10), 120);
  assert.equal(Snake.interval(22), 72);
  assert.equal(Snake.interval(23), 70);
  assert.equal(Snake.interval(100), 70);
});

test("step tar ett steg per intervall og tar vare på resttid", () => {
  let s = make({ snake: [[2, 5], [1, 5]], dir: "right", apple: { x: 0, y: 0 } });
  s = Snake.step(s, 159, zero);
  assert.deepEqual(cells(s)[0], [2, 5]);
  s = Snake.step(s, 1, zero);
  assert.deepEqual(cells(s)[0], [3, 5]);
  s = Snake.step(s, 160 * 3 + 50, zero);
  assert.deepEqual(cells(s)[0], [6, 5]);
  assert.equal(s.acc, 50);
});

test("etter et eple går stegene raskere", () => {
  let s = make({ snake: [[2, 5], [1, 5]], dir: "right", apple: { x: 3, y: 5 } });
  s = Snake.step(s, 160, seeded(1)); // spiser
  assert.equal(s.score, 1);
  const head = cells(s)[0][0];
  s = Snake.step(s, 156, seeded(1));
  assert.equal(cells(s)[0][0], head + 1);
});

// ---------- Simulering ----------

// Enkel autopilot: går mot eplet hvis det er trygt, ellers en annen trygg retning.
function autopilot(s, rand) {
  const head = s.snake[0];
  const body = new Set(s.snake.slice(0, -1).map((p) => p.x + "," + p.y));
  const safe = (dir) => {
    const d = Snake.DIRS[dir];
    const x = head.x + d.x, y = head.y + d.y;
    return x >= 0 && y >= 0 && x < s.cols && y < s.rows && !body.has(x + "," + y);
  };
  const wanted = [];
  if (s.apple) {
    if (s.apple.x > head.x) wanted.push("right");
    if (s.apple.x < head.x) wanted.push("left");
    if (s.apple.y > head.y) wanted.push("down");
    if (s.apple.y < head.y) wanted.push("up");
  }
  const all = ["up", "down", "left", "right"].sort(() => rand() - 0.5);
  for (const d of [...wanted, ...all]) if (d !== Snake.OPPOSITE[s.dir] && safe(d)) return d;
  return s.dir; // ingen trygg vei – krasjer
}

test("simulering med fast frø: autopiloten spiller til spillet slutter, og reglene holder hele veien", () => {
  for (const seed of [1, 2, 3, 42]) {
    const rand = seeded(seed);
    let s = Snake.newGame(rand);
    s = Snake.turn(s, "up");
    let ticks = 0;
    while (s.status === "playing" && ticks < 50000) {
      s = Snake.turn(s, autopilot(s, rand));
      const before = s;
      s = Snake.step(s, Snake.interval(s.score), rand);
      ticks++;
      assert.ok(s.score >= before.score);
      if (s.status === "playing") checkInvariant(s);
    }
    assert.ok(s.status === "over" || s.status === "won", "spillet ble ferdig (frø " + seed + ")");
    assert.ok(s.score > 5, "autopiloten spiste noen epler (frø " + seed + ", " + s.score + ")");
  }
});
