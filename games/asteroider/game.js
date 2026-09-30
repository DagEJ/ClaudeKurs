// Tegning, input og spill-løkke for Asteroider. Reglene ligger i logic.js.
(function () {
  const GAME_ID = "asteroider";
  const STEP = 1 / 60; // fast tidssteg for logikken (sekunder)
  const MAX_FRAME = 0.1; // lengste tid én frame kan spole (etter pause, treg maskin)
  const TAP_WINDOW = 0.6; // så lenge (spilltid) et kort trykk får på seg til å skyte
  const END_DELAY = 1200; // la brettet vises litt før sluttkortet
  const W = Asteroids.W;
  const H = Asteroids.H;

  const el = {
    board: document.getElementById("board"),
    canvas: document.getElementById("canvas"),
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
  };
  const ctx = el.canvas.getContext("2d");

  let state = Asteroids.create();
  let started = false;
  let ended = false;
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres
  let acc = 0;
  let lastFrame = null;
  let particles = [];
  let popups = [];
  let flash = 0;

  // ---------- Farger (fra shared/style.css) ----------

  let colors = {};
  let font = "sans-serif";
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    colors = {
      bg: v("--bg"), surface: v("--surface"), text: v("--text"), muted: v("--muted"),
      border: v("--border"), accent: v("--accent"), good: v("--good"), bad: v("--bad"),
      blue: v("--p-blue"), yellow: v("--p-yellow"),
    };
    font = getComputedStyle(document.body).fontFamily || font;
  }
  readColors();
  const scheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (scheme && scheme.addEventListener) scheme.addEventListener("change", readColors);

  const sizeColor = (size) => (size === 3 ? colors.muted : size === 2 ? colors.blue : colors.yellow);

  // ---------- Størrelse ----------

  let scale = 1;
  function resize() {
    const rect = el.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.round(rect.width * dpr));
    if (el.canvas.width !== px || el.canvas.height !== px) {
      el.canvas.width = px;
      el.canvas.height = px;
    }
    scale = px / W;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(el.canvas);
  window.addEventListener("resize", resize);

  // ---------- Input ----------

  const keys = new Set();
  let pointer = null; // { id, x, y } i spillets koordinater mens fingeren/knappen er nede
  let tap = null; // { x, y, shots, until } – et kort trykk som ennå ikke har skutt

  function toWorld(e) {
    const r = el.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function currentInput() {
    const left = keys.has("left");
    const right = keys.has("right");
    const input = { turn: (right ? 1 : 0) - (left ? 1 : 0), fire: keys.has("fire"), aim: null };
    const target = pointer || tap;
    if (target && !input.turn) {
      input.aim = Asteroids.aimAngle(state.ship, target);
      input.fire = true;
    }
    return input;
  }

  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    Space: "fire",
  };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board)) return; // la knappene på kortet få tastene
    const k = KEYMAP[e.code];
    if (!k) return;
    if (e.target.closest && e.target.closest("button, a") && (e.code === "Space")) {
      e.target.blur(); // mellomrom skal skyte, ikke trykke på en knapp
    }
    e.preventDefault();
    if (started && !ended) keys.add(k);
  });
  document.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener("blur", () => keys.clear());

  el.canvas.addEventListener("pointerdown", (e) => {
    if (!started || ended || Common.isOverlayOpen(el.board)) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ikke støttet */ }
    const p = toWorld(e);
    pointer = { id: e.pointerId, x: p.x, y: p.y };
    tap = null;
  });
  el.canvas.addEventListener("pointermove", (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const p = toWorld(e);
    pointer.x = p.x;
    pointer.y = p.y;
  });
  function release(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    // Et kort trykk skal gi ett skudd selv om skipet ikke rakk å snu seg før fingeren slapp.
    tap = { x: pointer.x, y: pointer.y, shots: state.shots, until: state.time + TAP_WINDOW };
    pointer = null;
  }
  el.canvas.addEventListener("pointerup", release);
  el.canvas.addEventListener("pointercancel", (e) => {
    if (pointer && e.pointerId === pointer.id) pointer = null;
  });
  el.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  el.board.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // ---------- Effekter ----------

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === "boom") {
        burst(ev.x, ev.y, 6 + ev.size * 4, sizeColor(ev.size));
        popups.push({ x: ev.x, y: ev.y, text: "+" + ev.points, life: 0.8 });
      } else if (ev.type === "hurt") {
        burst(ev.x, ev.y, 18, colors.bad);
        flash = 0.5;
      }
    }
  }

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.4, color });
    }
    if (particles.length > 300) particles = particles.slice(-300);
  }

  function updateEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) {
      p.y -= 30 * dt;
      p.life -= dt;
    }
    popups = popups.filter((p) => p.life > 0);
    flash = Math.max(0, flash - dt);
  }

  // ---------- Tegning ----------

  const shapes = new Map();
  function shapeOf(seed) {
    if (shapes.has(seed)) return shapes.get(seed);
    let t = (seed + 1) * 2654435761;
    const rnd = () => {
      t = (t * 1103515245 + 12345) % 2147483648;
      return t / 2147483648;
    };
    const n = 11;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.78 + rnd() * 0.3;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    if (shapes.size > 500) shapes.clear();
    shapes.set(seed, pts);
    return pts;
  }

  function drawAsteroid(a) {
    const pts = shapeOf(a.shape);
    const c = Math.cos(a.rot);
    const s = Math.sin(a.rot);
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = a.x + (px * c - py * s) * a.r;
      const y = a.y + (px * s + py * c) * a.r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = colors.bg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = sizeColor(a.size);
    ctx.stroke();
  }

  function drawShip() {
    const sh = state.ship;
    const blink = state.invuln > 0 && Math.floor(state.invuln * 8) % 2 === 0;
    if (blink && state.status === "playing") return;
    const r = Asteroids.SHIP_R;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.angle);
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r, r * 0.9);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r, -r * 0.9);
    ctx.closePath();
    ctx.fillStyle = state.status === "over" ? colors.bad : colors.accent;
    ctx.fill();
    ctx.restore();
  }

  function text(str, x, y, size, color, align) {
    ctx.font = "600 " + size + "px " + font;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function draw() {
    resize();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, W, H);

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.25, flash * 0.5);
      ctx.fillStyle = colors.bad;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Siktemerke der fingeren/musa er.
    const target = pointer || tap;
    if (target && started && !ended) {
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const a of state.asteroids) drawAsteroid(a);

    ctx.fillStyle = colors.text;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    drawShip();

    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      text(p.text, p.x, p.y, 20, colors.good);
    }
    ctx.globalAlpha = 1;

    text("Bølge " + state.wave, 16, 22, 18, colors.muted, "left");
    if (started && state.status === "playing") {
      if (state.wavePause > 0) text("Bølge " + (state.wave + 1), W / 2, H / 2 - 90, 36, colors.text);
      else if (state.time < 1.5) text("Bølge " + state.wave, W / 2, H / 2 - 90, 36, colors.text);
    }
  }

  function drawStats() {
    const score = String(state.score);
    if (el.score.textContent !== score) el.score.textContent = score;
    const lives = "♥".repeat(state.lives) + "♡".repeat(Asteroids.LIVES - state.lives);
    if (el.lives.textContent !== lives) {
      el.lives.textContent = lives;
      el.lives.setAttribute("aria-label", state.lives + " liv igjen");
    }
    const best = Common.getBest(GAME_ID);
    const b = best === null ? "–" : String(best);
    if (el.best.textContent !== b) el.best.textContent = b;
  }

  function say(msg, kind) {
    el.message.className = "message " + (kind || "");
    el.message.textContent = msg;
  }

  // ---------- Spill-løkke ----------

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = lastFrame === null ? 0 : Math.min(MAX_FRAME, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const running = started && state.status === "playing" && !document.hidden && !Common.isOverlayOpen(el.board);
    if (running) {
      acc += dt;
      while (acc >= STEP && state.status === "playing") {
        state = Asteroids.step(state, STEP, currentInput(), Math.random);
        handleEvents(state.events);
        if (tap && (state.shots > tap.shots || state.time > tap.until)) tap = null;
        acc -= STEP;
      }
      updateEffects(dt);
    } else {
      acc = 0;
      if (state.status === "over") updateEffects(dt);
    }
    draw();
    drawStats();
    if (started && state.status === "over" && !ended) finish();
  }

  // Etter en pause (skjult fane) skal ikke løkka spole hele pausen.
  document.addEventListener("visibilitychange", () => {
    lastFrame = null;
    keys.clear();
  });

  // ---------- Spillflyt ----------

  function later(fn, ms) {
    const t = token;
    setTimeout(() => t === token && fn(), ms);
  }

  function startGame() {
    Common.hideOverlay(el.board);
    token++;
    state = Asteroids.create();
    started = true;
    ended = false;
    acc = 0;
    lastFrame = null;
    particles = [];
    popups = [];
    flash = 0;
    pointer = null;
    tap = null;
    keys.clear();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    say("");
    drawStats();
  }

  function finish() {
    ended = true;
    keys.clear();
    pointer = null;
    tap = null;
    const score = state.score;
    const record = score > 0 && Common.saveBest(GAME_ID, score);
    const best = Common.getBest(GAME_ID);
    drawStats();
    say(record ? "Ny rekord: " + score + " poeng!" : "Du fikk " + score + " poeng.", record ? "good" : "bad");
    later(() => {
      Common.showOverlay(el.board, {
        title: record ? "Ny rekord!" : "Skipet er knust",
        text:
          "Du fikk " + score + " poeng og kom til bølge " + state.wave + "." +
          (record ? "" : best === null ? "" : " Rekord: " + best + " poeng."),
        buttons: [{ label: "Nytt spill", primary: true, onClick: startGame }],
      });
    }, END_DELAY);
  }

  el.newGame.addEventListener("click", startGame);

  // ---------- Start ----------

  drawStats();
  requestAnimationFrame(frame);
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Skipet står fast i midten. Skyt asteroidene før de treffer deg – de små gir flest poeng.",
    howto: [
      { keys: ["←", "→"], text: "Snu skipet (også A og D)" },
      { keys: ["Mellomrom"], text: "Skyt – hold inne for mer" },
      { keys: ["Trykk"], text: "Sikt og skyt dit – hold for mer" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: startGame }],
  });
})();
