// Ren spill-logikk for Asteroider. Ingen DOM, ingen klokke, ingen Math.random.
// Tid sendes inn som dt (sekunder), tilfeldighet som en rand()-funksjon som gir tall i [0, 1).
// Reglene står i REGLER.md («Vår versjon»).
const Asteroids = (function () {
  const W = 600;
  const H = 600;
  const CX = W / 2;
  const CY = H / 2;

  const SHIP_R = 12;
  const TURN_SPEED = 4; // radianer per sekund med piltastene
  const AIM_TURN_SPEED = 9; // radianer per sekund når skipet sikter mot et punkt
  const AIM_TOLERANCE = 0.12; // så nær må skipet peke før det skyter mot et punkt
  const BULLET_SPEED = 480;
  const BULLET_R = 2.5;
  const MAX_BULLETS = 4;
  const FIRE_COOLDOWN = 0.2;
  const LIVES = 3;
  const INVULN = 2;
  const WAVE_PAUSE = 2;
  const MAX_ASTEROIDS = 60;
  const DESPAWN_DIST = 560; // fra midten; alt som starter på kanten er nærmere enn dette
  const AIM_SPREAD = 120; // asteroidene sikter mot et punkt innenfor ± dette fra midten
  const SPLIT_ANGLE = 0.5;
  const SPLIT_SPEEDUP = 1.3;
  const BASE_SPEED_MIN = 45;
  const BASE_SPEED_MAX = 70;

  // size: 3 = stor, 2 = mellomstor, 1 = liten
  const SIZES = {
    3: { r: 36, points: 20 },
    2: { r: 22, points: 50 },
    1: { r: 12, points: 100 },
  };

  const TAU = Math.PI * 2;

  // Vinkel i (-π, π].
  function wrapAngle(a) {
    a = a % TAU;
    if (a <= -Math.PI) a += TAU;
    if (a > Math.PI) a -= TAU;
    return a;
  }

  // Korteste vei fra vinkel `from` til vinkel `to`.
  function angleDiff(to, from) {
    return wrapAngle(to - from);
  }

  // Vinkelen skipet må peke i for å treffe punktet (0 = mot høyre, π/2 = ned).
  function aimAngle(ship, point) {
    return Math.atan2(point.y - ship.y, point.x - ship.x);
  }

  function waveConfig(n) {
    return {
      count: 4 + 2 * (n - 1),
      interval: Math.max(0.6, 2.2 - 0.2 * n),
      speed: 1 + 0.12 * (n - 1),
    };
  }

  function asteroid(size, x, y, vx, vy, extra) {
    return Object.assign(
      { id: 0, size, r: SIZES[size].r, x, y, vx, vy, rot: 0, spin: 0, shape: 1 },
      extra || {}
    );
  }

  function create() {
    return {
      status: "playing",
      ship: { x: CX, y: CY, angle: -Math.PI / 2 },
      bullets: [],
      asteroids: [],
      score: 0,
      lives: LIVES,
      invuln: 0,
      cooldown: 0,
      wave: 1,
      toSpawn: waveConfig(1).count,
      spawnTimer: 0.8,
      wavePause: 0,
      time: 0,
      shots: 0,
      nextId: 1,
      events: [],
    };
  }

  // En stor asteroide fra en tilfeldig kant, på vei mot et punkt nær midten.
  function spawn(s, rand) {
    const cfg = waveConfig(s.wave);
    const size = 3;
    const r = SIZES[size].r;
    const side = Math.min(3, Math.floor(rand() * 4));
    const t = rand() * W;
    const pos = [
      { x: t, y: -r },
      { x: W + r, y: t },
      { x: t, y: H + r },
      { x: -r, y: t },
    ][side];
    const tx = CX + (rand() * 2 - 1) * AIM_SPREAD;
    const ty = CY + (rand() * 2 - 1) * AIM_SPREAD;
    const speed = (BASE_SPEED_MIN + rand() * (BASE_SPEED_MAX - BASE_SPEED_MIN)) * cfg.speed;
    const a = Math.atan2(ty - pos.y, tx - pos.x);
    s.asteroids.push(
      asteroid(size, pos.x, pos.y, Math.cos(a) * speed, Math.sin(a) * speed, {
        id: s.nextId++,
        rot: rand() * TAU,
        spin: (rand() * 2 - 1) * 1.5,
        shape: Math.floor(rand() * 1e6),
      })
    );
  }

  // To mindre biter som flyr ut til hver side.
  function split(s, a) {
    if (a.size <= 1) return;
    const size = a.size - 1;
    const speed = Math.hypot(a.vx, a.vy) * SPLIT_SPEEDUP;
    const dir = Math.atan2(a.vy, a.vx);
    for (const sign of [-1, 1]) {
      if (s.asteroids.length >= MAX_ASTEROIDS) return;
      const d = dir + sign * SPLIT_ANGLE;
      const off = SIZES[size].r * 0.6;
      s.asteroids.push(
        asteroid(size, a.x - Math.sin(dir) * off * sign, a.y + Math.cos(dir) * off * sign,
          Math.cos(d) * speed, Math.sin(d) * speed, {
            id: s.nextId++,
            rot: a.rot + sign,
            spin: -a.spin * 1.3 + sign * 0.4,
            shape: (a.shape * 7 + (sign > 0 ? 3 : 5)) % 1000003,
          })
      );
    }
  }

  const inside = (b) => b.x >= 0 && b.x <= W && b.y >= 0 && b.y <= H;

  // Ett tidssteg. input = { turn: -1|0|1, fire: bool, aim: vinkel eller null }.
  // Når aim er satt, snur skipet seg mot den og skyter bare når det peker dit.
  function step(state, dt, input, rand) {
    if (state.status !== "playing") return state;
    input = input || {};
    const s = Object.assign({}, state, {
      ship: Object.assign({}, state.ship),
      bullets: state.bullets.slice(),
      asteroids: state.asteroids.slice(),
      events: [],
    });
    s.time += dt;

    // Snu skipet.
    let aligned = true;
    if (typeof input.aim === "number") {
      const diff = angleDiff(input.aim, s.ship.angle);
      const max = AIM_TURN_SPEED * dt;
      const turn = Math.max(-max, Math.min(max, diff));
      s.ship.angle = wrapAngle(s.ship.angle + turn);
      aligned = Math.abs(diff - turn) < AIM_TOLERANCE;
    } else if (input.turn) {
      s.ship.angle = wrapAngle(s.ship.angle + Math.sign(input.turn) * TURN_SPEED * dt);
    }

    // Skyt.
    s.cooldown = Math.max(0, s.cooldown - dt);
    if (input.fire && aligned && s.cooldown <= 0 && s.bullets.length < MAX_BULLETS) {
      const c = Math.cos(s.ship.angle);
      const n = Math.sin(s.ship.angle);
      s.bullets.push({ x: s.ship.x + c * SHIP_R, y: s.ship.y + n * SHIP_R, vx: c * BULLET_SPEED, vy: n * BULLET_SPEED });
      s.cooldown = FIRE_COOLDOWN;
      s.shots++;
      s.events.push({ type: "shot" });
    }

    // Flytt skudd og asteroider.
    s.bullets = s.bullets
      .map((b) => ({ x: b.x + b.vx * dt, y: b.y + b.vy * dt, vx: b.vx, vy: b.vy }))
      .filter(inside);
    s.asteroids = s.asteroids
      .map((a) => Object.assign({}, a, { x: a.x + a.vx * dt, y: a.y + a.vy * dt, rot: a.rot + a.spin * dt }))
      .filter((a) => Math.hypot(a.x - CX, a.y - CY) <= DESPAWN_DIST);

    // Skudd mot asteroider.
    const bullets = [];
    for (const b of s.bullets) {
      const i = s.asteroids.findIndex((a) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + BULLET_R);
      if (i < 0) {
        bullets.push(b);
        continue;
      }
      const a = s.asteroids[i];
      s.asteroids.splice(i, 1);
      s.score += SIZES[a.size].points;
      s.events.push({ type: "boom", x: a.x, y: a.y, size: a.size, points: SIZES[a.size].points });
      split(s, a);
    }
    s.bullets = bullets;

    // Asteroider mot skipet.
    s.invuln = Math.max(0, s.invuln - dt);
    if (s.invuln <= 0) {
      const i = s.asteroids.findIndex((a) => Math.hypot(a.x - s.ship.x, a.y - s.ship.y) < a.r + SHIP_R);
      if (i >= 0) {
        const a = s.asteroids[i];
        s.asteroids.splice(i, 1);
        s.lives--;
        s.invuln = INVULN;
        s.events.push({ type: "hurt", x: a.x, y: a.y, size: a.size });
        if (s.lives <= 0) {
          s.lives = 0;
          s.status = "over";
          return s;
        }
      }
    }

    // Bølger.
    if (s.wavePause > 0) {
      s.wavePause -= dt;
      if (s.wavePause <= 0) {
        s.wavePause = 0;
        s.wave++;
        s.toSpawn = waveConfig(s.wave).count;
        s.spawnTimer = 0.3;
        s.events.push({ type: "wave", wave: s.wave });
      }
    } else if (s.toSpawn > 0) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0 && s.asteroids.length < MAX_ASTEROIDS) {
        spawn(s, rand);
        s.toSpawn--;
        s.spawnTimer += waveConfig(s.wave).interval;
      }
    } else if (s.asteroids.length === 0) {
      s.wavePause = WAVE_PAUSE;
      s.events.push({ type: "clear", wave: s.wave });
    }

    return s;
  }

  return {
    W, H, SHIP_R, TURN_SPEED, AIM_TURN_SPEED, AIM_TOLERANCE, BULLET_SPEED, BULLET_R, MAX_BULLETS,
    FIRE_COOLDOWN, LIVES, INVULN, WAVE_PAUSE, MAX_ASTEROIDS, DESPAWN_DIST, SIZES,
    create, step, aimAngle, angleDiff, wrapAngle, waveConfig, asteroid,
  };
})();

if (typeof module !== "undefined") module.exports = Asteroids;
