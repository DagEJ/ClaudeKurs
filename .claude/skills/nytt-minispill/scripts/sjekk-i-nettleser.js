#!/usr/bin/env node
// Røyktest for et minispill i ClaudeKurs, i en ekte (hodeløs) nettleser.
//
// Bruk (fra roten av repoet):
//   node .claude/skills/nytt-minispill/scripts/sjekk-i-nettleser.js <spill-id> [--steps 300] [--seed 1] [--out mappe]
//
// Hva den gjør, på PC (lys modus) og mobil (mørk modus):
//   1. Åpner games/<spill-id>/index.html og sjekker at det finnes et introkort (.overlay) som får plass på brettet.
//   2. Trykker taster mens introkortet er oppe, og sjekker at spillet ikke endrer seg.
//   3. Trykker Start og spiller tilfeldig: taster, klikk på knapper, sveip og lange trykk.
//      Kort som dukker opp underveis (tiden er ute, du vant …) registreres og lukkes med hovedknappen.
//   4. Spoler klokka (page.clock), så tidtakere og datamaskin-trekk går uten å vente.
//   5. Samler feil fra konsollen og sjekker at siden ikke kan rulles sidelengs.
//   6. Tar skjermbilder: intro, underveis og slutt.
//
// Dette er en røyktest: den finner krasj, layoutfeil og manglende intro. Om reglene er riktige,
// sjekkes av logic.test.js.
//
// Avslutter med kode 0 når alt er i orden, 1 ved funn, 2 ved feil i oppsettet.

const path = require("path");
const fs = require("fs");
const os = require("os");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error(
    "Fant ikke Playwright, så nettlesersjekken kan ikke kjøres her.\n" +
      "Kjør «node --test» for logikken, og be brukeren åpne spillet i nettleseren og spille en runde.\n" +
      "(Playwright kan installeres utenfor repoet med «npm i -g playwright» og «npx playwright install chromium».)"
  );
  process.exit(2);
}

// ---------- Argumenter ----------

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const id = args[0] && !args[0].startsWith("--") ? args[0] : null;
if (!id) {
  console.error("Bruk: node sjekk-i-nettleser.js <spill-id> [--steps 300] [--seed 1] [--out mappe]");
  process.exit(2);
}

const root = path.resolve(__dirname, "../../../..");
const file = path.join(root, "games", id, "index.html");
if (!fs.existsSync(file)) {
  console.error("Finner ikke " + path.relative(root, file));
  process.exit(2);
}
const STEPS = Number(opt("steps", 300));
let seed = Number(opt("seed", 1)) || 1;
const out = path.resolve(opt("out", path.join(os.tmpdir(), "minispill-sjekk", id)));
fs.mkdirSync(out, { recursive: true });

function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const realWait = (ms) => new Promise((r) => setTimeout(r, ms));

const CONFIGS = [
  { name: "pc-lys", width: 1100, height: 900, scheme: "light" },
  { name: "mobil-mork", width: 390, height: 860, scheme: "dark" },
];
const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "Space", "Enter", "1", "2", "3", "4", "u"];

// ---------- Hjelpere som kjører i siden ----------

async function overlayInfo(page) {
  return page.evaluate(() => {
    const o = document.querySelector(".board > .overlay") || document.querySelector(".overlay");
    if (!o) return { open: false };
    const card = o.querySelector(".overlay-card") || o;
    const ob = o.getBoundingClientRect();
    const cb = card.getBoundingClientRect();
    const h = card.querySelector("h2");
    return {
      open: true,
      title: h ? h.textContent.trim() : "(uten tittel)",
      fits: cb.top >= ob.top - 1 && cb.bottom <= ob.bottom + 1 && cb.left >= ob.left - 1 && cb.right <= ob.right + 1,
      cardHeight: Math.round(cb.height),
      boardHeight: Math.round(ob.height),
    };
  });
}

async function gameSnapshot(page) {
  return page.evaluate(() => {
    const b = document.querySelector(".board");
    if (!b) return document.body.innerText;
    const c = b.cloneNode(true);
    c.querySelectorAll(".overlay").forEach((o) => o.remove());
    const header = document.querySelector(".game-header");
    return c.innerHTML + "|" + (header ? header.innerText : "");
  });
}

async function blur(page) {
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
}

async function clickPrimary(page) {
  const btn = page.locator(".overlay .btn.primary, .overlay button").first();
  await btn.click({ force: true, timeout: 2000 });
}

// ---------- Én kjøring ----------

async function run(browser, cfg) {
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, colorScheme: cfg.scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

  await page.clock.install();
  await page.goto("file://" + file);
  await page.clock.runFor(300);
  await realWait(400); // la CSS-animasjoner (inntoning av kortet) bli ferdige før skjermbildet

  const shots = [];
  const shot = async (label) => {
    const p = path.join(out, `${cfg.name}-${label}.png`);
    await page.screenshot({ path: p });
    shots.push(p);
  };

  const intro = await overlayInfo(page);
  await shot("intro");

  // Taster skal ikke styre spillet mens introkortet er oppe.
  let keysBlocked = null;
  if (intro.open) {
    await blur(page);
    const before = await gameSnapshot(page);
    for (const k of ["ArrowLeft", "ArrowUp", "1", "w", "Space"]) await page.keyboard.press(k);
    await page.clock.runFor(1500);
    const after = await gameSnapshot(page);
    const still = await overlayInfo(page);
    keysBlocked = before === after && still.open;
    if (still.open) await clickPrimary(page).catch(() => {});
  }

  // Tilfeldig spill.
  const seen = new Map();
  let actions = 0;
  for (let step = 0; step < STEPS; step++) {
    const ov = await overlayInfo(page);
    if (ov.open) {
      seen.set(ov.title, (seen.get(ov.title) || 0) + 1);
      await clickPrimary(page).catch(() => {});
      await page.clock.runFor(300);
      continue;
    }
    const r = rand();
    try {
      if (r < 0.45) {
        await blur(page);
        await page.keyboard.press(pick(KEYS));
      } else if (r < 0.8) {
        const buttons = await page.$$(".board button:not([disabled]), .controls button:not([disabled])");
        const usable = [];
        for (const b of buttons) {
          const text = (await b.innerText().catch(() => "")) || "";
          if (/nytt spill/i.test(text) && rand() > 0.03) continue; // start sjelden på nytt
          usable.push(b);
        }
        if (usable.length) await pick(usable).click({ force: true, timeout: 1000 });
      } else if (r < 0.92) {
        const box = await page.locator(".board").first().boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
          const len = Math.min(box.width, box.height) * 0.3;
          await page.mouse.move(cx - dx * len, cy - dy * len);
          await page.mouse.down();
          await page.mouse.move(cx + dx * len, cy + dy * len, { steps: 4 });
          await page.mouse.up();
        }
      } else {
        // Langt trykk (f.eks. flagg i Minesveiper).
        const targets = await page.$$(".board button:not([disabled])");
        const t = targets.length ? pick(targets) : null;
        const box = t ? await t.boundingBox() : await page.locator(".board").first().boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.clock.runFor(700);
          await page.mouse.up();
        }
      }
      actions++;
    } catch (e) {
      /* elementet forsvant mellom oppslag og klikk – ikke en feil i spillet */
    }
    await page.clock.runFor(100 + Math.floor(rand() * 800));
    if (step === Math.floor(STEPS / 2)) await shot("underveis");
  }

  // Spol langt frem, så tidsgrenser og datamaskin-trekk rekker å slå inn.
  await page.clock.runFor(180000);
  const end = await overlayInfo(page);
  if (end.open) seen.set(end.title, (seen.get(end.title) || 0) + 1);
  await realWait(300);
  await shot("slutt");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();

  const problems = [];
  if (errors.length) problems.push(errors.length + " feil i konsollen");
  if (overflow > 1) problems.push("siden kan rulles " + overflow + " px sidelengs");
  if (!intro.open) problems.push("ingen introkort ved oppstart");
  if (intro.open && !intro.fits) problems.push(`introkortet (${intro.cardHeight}px) får ikke plass på brettet (${intro.boardHeight}px)`);
  if (keysBlocked === false) problems.push("taster endret spillet mens introkortet var oppe");

  return { cfg, intro, keysBlocked, seen, actions, errors, overflow, shots, problems };
}

// ---------- Hovedprogram ----------

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const cfg of CONFIGS) results.push(await run(browser, cfg));
  await browser.close();

  let bad = false;
  console.log(`\nNettlesersjekk av «${id}» (${STEPS} tilfeldige steg, seed ${opt("seed", 1)})\n`);
  for (const r of results) {
    console.log(`== ${r.cfg.name} (${r.cfg.width}×${r.cfg.height}, ${r.cfg.scheme === "dark" ? "mørk" : "lys"})`);
    console.log(`   Introkort:        ${r.intro.open ? `«${r.intro.title}», ${r.intro.fits ? "får plass" : "FÅR IKKE PLASS"}` : "MANGLER"}`);
    console.log(`   Taster i intro:   ${r.keysBlocked === null ? "–" : r.keysBlocked ? "blokkert (bra)" : "ENDRET SPILLET"}`);
    console.log(`   Handlinger:       ${r.actions}`);
    console.log(`   Kort underveis:   ${r.seen.size ? [...r.seen].map(([t, n]) => `«${t}» ×${n}`).join(", ") : "ingen"}`);
    console.log(`   Sidelengs rull:   ${r.overflow > 1 ? r.overflow + " px (FEIL)" : "nei"}`);
    console.log(`   Konsollfeil:      ${r.errors.length ? "" : "ingen"}`);
    for (const e of r.errors.slice(0, 10)) console.log("     - " + e);
    console.log(`   Skjermbilder:     ${r.shots.map((s) => path.basename(s)).join(", ")}`);
    if (r.problems.length) {
      bad = true;
      console.log(`   FUNN:             ${r.problems.join("; ")}`);
    }
    console.log("");
  }
  console.log(`Skjermbildene ligger i ${out}`);
  console.log(bad ? "\nResultat: FUNN – se over." : "\nResultat: OK");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error("Sjekken krasjet: " + (e && e.stack ? e.stack : e));
  process.exit(2);
});
