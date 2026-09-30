// Ren spill-logikk for Breakout. Ingen DOM, ingen klokke, ingen Math.random:
// tidssteg (sekunder), input og rand() sendes inn fra game.js.
//
// Koordinater er i en fast spillflate på W × H enheter. game.js skalerer til skjermen.

const Breakout = {
  W: 320,
  H: 400,
  STEP: 1 / 120, // fast tidssteg i sekunder

  COLS: 8,
  SIDE: 8, // luft mellom vegg og klosser
  GAP: 2,
  BRICK_TOP: 44,
  BRICK_H: 14,
  MAX_ROWS: 7,

  PADDLE_W: 60,
  PADDLE_H: 8,
  PADDLE_Y: 372, // overkanten av racketen
  PADDLE_SPEED: 380, // enheter per sekund med taster

  BALL_R: 4,
  BASE_SPEED: 230, // enheter per sekund på brett 1
  LEVEL_FACTOR: 1.12, // fartsøkning per brett
  MAX_LEVEL_SPEED: 440,
  HIT_FACTOR: 0.015, // fartsøkning per knust kloss innen et brett
  MAX_HIT_BOOST: 0.35,
  MAX_BOUNCE: (60 * Math.PI) / 180, // største vinkel fra loddrett ut fra racketen
  MAX_SERVE: (15 * Math.PI) / 180,

  LIVES: 3,

  // Startfarten for et brett.
  levelSpeed(level) {
    return Math.min(Breakout.MAX_LEVEL_SPEED, Breakout.BASE_SPEED * Math.pow(Breakout.LEVEL_FACTOR, level - 1));
  },

  rowsFor(level) {
    return Math.min(Breakout.MAX_ROWS, 4 + level);
  },

  // Poeng for rad r (0 = øverst) når brettet har `rows` rader: nederst 1, så 3, 5, 7.
  pointsFor(r, rows) {
    return 1 + 2 * Math.floor((rows - 1 - r) / 2);
  },

  // Hvor mange treff en kloss i rad r tåler.
  hpFor(r, level) {
    if (level >= 5 && r < 2) return 2;
    if (level >= 3 && r < 1) return 2;
    return 1;
  },

  makeBricks(level) {
    const B = Breakout;
    const rows = B.rowsFor(level);
    const w = (B.W - 2 * B.SIDE - (B.COLS - 1) * B.GAP) / B.COLS;
    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < B.COLS; c++) {
        const hp = B.hpFor(r, level);
        bricks.push({
          x: B.SIDE + c * (w + B.GAP),
          y: B.BRICK_TOP + r * (B.BRICK_H + B.GAP),
          w,
          h: B.BRICK_H,
          row: r,
          hp,
          maxHp: hp,
          points: B.pointsFor(r, rows),
        });
      }
    }
    return bricks;
  },

  // Ballen ligger oppå racketen og venter på serve.
  parkBall(paddleX) {
    return { x: paddleX, y: Breakout.PADDLE_Y - Breakout.BALL_R - 0.5, vx: 0, vy: 0 };
  },

  create() {
    const B = Breakout;
    const paddle = { x: B.W / 2, w: B.PADDLE_W };
    return {
      status: "serve", // "serve" | "playing" | "over"
      level: 1,
      score: 0,
      lives: B.LIVES,
      hits: 0, // knuste klosser på dette brettet siden siste serve
      speed: B.levelSpeed(1),
      bricks: B.makeBricks(1),
      paddle,
      ball: B.parkBall(paddle.x),
      events: [],
    };
  },

  bricksLeft(state) {
    return state.bricks.filter((b) => b.hp > 0).length;
  },

  // Ett tidssteg. input: { left, right, targetX, launch }. targetX (eller null) er der
  // pekeren står; da følger racketen den direkte. rand() brukes bare ved serve.
  // Returnerer ny tilstand; state.events sier hva som skjedde i steget.
  step(state, dt, input, rand) {
    const B = Breakout;
    input = input || {};
    const s = { ...state, paddle: { ...state.paddle }, ball: { ...state.ball }, events: [] };
    if (s.status === "over") return s;

    // Racketen.
    if (typeof input.targetX === "number") {
      s.paddle.x = input.targetX;
    } else {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      s.paddle.x += dir * B.PADDLE_SPEED * dt;
    }
    const half = s.paddle.w / 2;
    s.paddle.x = Math.max(half, Math.min(B.W - half, s.paddle.x));

    if (s.status === "serve") {
      s.ball = B.parkBall(s.paddle.x);
      if (input.launch) {
        const a = ((rand ? rand() : 0.5) * 2 - 1) * B.MAX_SERVE;
        s.ball.vx = s.speed * Math.sin(a);
        s.ball.vy = -s.speed * Math.cos(a);
        s.status = "playing";
        s.events.push("launch");
      }
      return s;
    }

    // Del bevegelsen i biter som er kortere enn ballens radius, så den aldri
    // hopper over en kloss eller racketen, uansett fart.
    const dist = Math.hypot(s.ball.vx, s.ball.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / (B.BALL_R * 0.75)));
    for (let i = 0; i < n && s.status === "playing"; i++) B._move(s, dt / n);
    return s;
  },

  _move(s, dt) {
    const B = Breakout;
    const R = B.BALL_R;
    const ball = s.ball;
    const px = ball.x;
    const py = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Vegger og tak.
    if (ball.x < R) { ball.x = 2 * R - ball.x; ball.vx = Math.abs(ball.vx); s.events.push("wall"); }
    if (ball.x > B.W - R) { ball.x = 2 * (B.W - R) - ball.x; ball.vx = -Math.abs(ball.vx); s.events.push("wall"); }
    if (ball.y < R) { ball.y = 2 * R - ball.y; ball.vy = Math.abs(ball.vy); s.events.push("wall"); }

    // Racketen: bare når ballen er på vei ned og kommer ovenfra.
    const p = s.paddle;
    const pl = p.x - p.w / 2;
    if (ball.vy > 0 && py <= B.PADDLE_Y + B.PADDLE_H / 2 && B.hitsRect(ball.x, ball.y, R, pl, B.PADDLE_Y, p.w, B.PADDLE_H)) {
      const rel = Math.max(-1, Math.min(1, (ball.x - p.x) / (p.w / 2)));
      const a = rel * B.MAX_BOUNCE;
      ball.vx = s.speed * Math.sin(a);
      ball.vy = -s.speed * Math.cos(a);
      ball.y = B.PADDLE_Y - R;
      s.events.push("paddle");
      return;
    }

    // Klosser: høyst én per delsteg.
    for (let i = 0; i < s.bricks.length; i++) {
      const b = s.bricks[i];
      if (b.hp <= 0 || !B.hitsRect(ball.x, ball.y, R, b.x, b.y, b.w, b.h)) continue;

      // Hvilken side kom ballen fra? Se på forrige posisjon.
      const fromAboveOrBelow = px >= b.x && px <= b.x + b.w;
      const fromSide = py >= b.y && py <= b.y + b.h;
      if (fromAboveOrBelow && !fromSide) ball.vy = -ball.vy;
      else if (fromSide && !fromAboveOrBelow) ball.vx = -ball.vx;
      else {
        // Hjørne: snu retningen langs aksen der ballen er lengst unna klossen.
        const dx = px < b.x ? b.x - px : px - (b.x + b.w);
        const dy = py < b.y ? b.y - py : py - (b.y + b.h);
        if (dx > dy) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
      }
      ball.x = px;
      ball.y = py;

      const bricks = s.bricks.slice();
      const hit = { ...b, hp: b.hp - 1 };
      bricks[i] = hit;
      s.bricks = bricks;
      if (hit.hp > 0) {
        s.events.push("dent");
      } else {
        s.score += b.points;
        s.hits += 1;
        const boost = Math.min(B.MAX_HIT_BOOST, s.hits * B.HIT_FACTOR);
        B._setSpeed(s, B.levelSpeed(s.level) * (1 + boost));
        s.events.push("brick");
        if (B.bricksLeft(s) === 0) {
          s.level += 1;
          s.bricks = B.makeBricks(s.level);
          s.hits = 0;
          s.speed = B.levelSpeed(s.level);
          s.status = "serve";
          s.ball = B.parkBall(s.paddle.x);
          s.events.push("level");
        }
      }
      return;
    }

    // Ut i bunnen.
    if (ball.y - R > B.H) {
      s.lives -= 1;
      s.hits = 0;
      s.speed = B.levelSpeed(s.level);
      s.events.push("life");
      if (s.lives <= 0) {
        s.status = "over";
        s.events.push("over");
      } else {
        s.status = "serve";
        s.ball = B.parkBall(s.paddle.x);
      }
    }
  },

  _setSpeed(s, speed) {
    const cur = Math.hypot(s.ball.vx, s.ball.vy) || 1;
    s.ball.vx *= speed / cur;
    s.ball.vy *= speed / cur;
    s.speed = speed;
  },

  // Overlapper en sirkel (cx, cy, r) et rektangel?
  hitsRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  },

  // Kjør så mange faste tidssteg som får plass i `seconds`. Resten returneres,
  // så game.js kan ta den med til neste bilde.
  advance(state, seconds, input, rand) {
    let s = state;
    let acc = seconds;
    const events = [];
    while (acc >= Breakout.STEP) {
      s = Breakout.step(s, Breakout.STEP, input, rand);
      events.push(...s.events);
      if (s.events.includes("launch")) input = { ...input, launch: false }; // én serve per trykk
      acc -= Breakout.STEP;
      if (s.status === "over") { acc = 0; break; }
    }
    return { state: { ...s, events }, rest: acc };
  },
};

if (typeof module !== "undefined") module.exports = Breakout;
