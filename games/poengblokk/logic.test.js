const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./logic.js");

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

// Fører en hel runde.
function round(state, values) {
  values.forEach((v, p) => (state = S.setDraft(state, p, v)));
  return S.commitRound(state);
}
const game = (config, ...rounds) => rounds.reduce(round, S.create(config));
const names = (state, list) => list.map((p) => state.players[p]);

// ---------- Oppsett ----------

test("1–8 spillere; tomme navn blir «Spiller N», og lange navn kuttes til 20 tegn", () => {
  const s = S.create({ players: ["  Kari ", "", null, "x".repeat(30)] });
  assert.deepEqual(s.players, ["Kari", "Spiller 2", "Spiller 3", "x".repeat(20)]);
  assert.equal(S.create({ players: new Array(12).fill("") }).players.length, 8);
  assert.deepEqual(S.create({ players: [] }).players, ["Spiller 1"]);
  assert.deepEqual(S.create().players, ["Spiller 1"]);
});

test("ukjent tellemåte blir «høyest vinner»", () => {
  assert.equal(S.create({ players: ["A"], mode: "tull" }).mode, "hoyest");
});

test("nedtelling starter på tallet som er valgt, ellers 501, og har ingen andre grenser", () => {
  assert.equal(S.create({ players: ["A"], mode: "nedtelling", start: "301" }).start, 301);
  const s = S.create({ players: ["A"], mode: "nedtelling", start: "", target: 100, maxRounds: 5 });
  assert.equal(s.start, 501);
  assert.equal(s.target, null);
  assert.equal(s.maxRounds, null);
  assert.deepEqual(S.status(s).totals, [501]);
});

test("grense og antall runder er valgfrie og må være positive heltall", () => {
  const s = S.create({ players: ["A"], mode: "lavest", target: "", maxRounds: "18", start: 501 });
  assert.equal(s.target, null);
  assert.equal(s.maxRounds, 18);
  assert.equal(s.start, null);
  assert.equal(S.create({ players: ["A"], target: -5 }).target, null);
  assert.equal(S.create({ players: ["A"], target: "abc" }).target, null);
});

test("malene gir gyldige oppsett, og kan justeres etterpå (Dart 501 → 301)", () => {
  assert.deepEqual(S.TEMPLATES.map((t) => t.id), ["fritt", "kort500", "lavest100", "minigolf", "dart501"]);
  for (const t of S.TEMPLATES) {
    const s = S.create({ ...t, players: ["A", "B"] });
    assert.equal(s.mode, t.mode);
    assert.equal(s.start, t.start);
    assert.equal(s.target, t.target);
    assert.equal(s.maxRounds, t.maxRounds);
  }
  const dart = S.TEMPLATES.find((t) => t.id === "dart501");
  assert.equal(S.create({ ...dart, start: 301, players: ["A"] }).start, 301);
  assert.equal(S.create({ ...dart, start: 701, players: ["A"] }).start, 701);
});

// ---------- Føring ----------

test("poeng er hele tall; tomt og ugyldig felt er tomt", () => {
  assert.equal(S.toScore("12", "hoyest"), 12);
  assert.equal(S.toScore("12,6", "hoyest"), 13);
  assert.equal(S.toScore(" ", "hoyest"), null);
  assert.equal(S.toScore("abc", "hoyest"), null);
  assert.equal(S.toScore(null, "hoyest"), null);
  assert.equal(S.toScore("0", "hoyest"), 0);
});

test("negative poeng er lov når poengene legges sammen, men ikke i nedtelling", () => {
  assert.equal(S.toScore("-15", "hoyest"), -15);
  assert.equal(S.toScore("-15", "lavest"), -15);
  assert.equal(S.toScore("-15", "nedtelling"), 0);
  const s = game({ players: ["A", "B"] }, [10, -5], [-20, 5]);
  assert.deepEqual(S.status(s).totals, [-10, 0]);
});

test("en runde føres med tomme felt som 0, og feltene tømmes", () => {
  let s = S.create({ players: ["A", "B", "C"] });
  s = S.setDraft(s, 1, "7");
  s = S.commitRound(s);
  assert.deepEqual(s.rounds, [[0, 7, 0]]);
  assert.deepEqual(s.draft, [null, null, null]);
});

test("en runde der alle felt er tomme, føres ikke", () => {
  const s = S.create({ players: ["A", "B"] });
  assert.equal(S.commitRound(s), s);
  assert.equal(S.commitRound(S.setDraft(s, 0, "")).rounds.length, 0);
  assert.equal(S.commitRound(S.setDraft(s, 0, "0")).rounds.length, 1, "0 er et ført tall");
});

test("høyest vinner: poengene legges sammen, og høyest sum leder", () => {
  const s = game({ players: ["A", "B", "C"] }, [10, 20, 5], [30, 5, 5]);
  const st = S.status(s);
  assert.deepEqual(st.totals, [40, 25, 10]);
  assert.deepEqual(st.leaders, [0]);
  assert.equal(st.over, false);
  assert.deepEqual(st.winners, []);
});

test("lavest vinner: lavest sum leder", () => {
  const s = game({ players: ["A", "B", "C"], mode: "lavest" }, [3, 2, 4], [2, 2, 5]);
  assert.deepEqual(S.status(s).totals, [5, 4, 9]);
  assert.deepEqual(S.status(s).leaders, [1]);
});

test("ingen leder før første runde er ført", () => {
  assert.deepEqual(S.status(S.create({ players: ["A", "B"] })).leaders, []);
});

// ---------- Slutt ----------

test("uten grense og rundetall varer spillet til det avsluttes for hånd, og kan fortsettes", () => {
  let s = game({ players: ["A", "B"] }, [1000, 0], [1000, 5]);
  assert.equal(S.status(s).over, false);
  s = S.end(s);
  assert.equal(S.status(s).reason, "ended");
  assert.deepEqual(S.status(s).winners, [0]);
  assert.equal(round(s, [1, 1]).rounds.length, 2, "ingen nye runder når spillet er slutt");
  s = S.resume(s);
  assert.equal(S.status(s).over, false);
  assert.equal(round(s, [1, 1]).rounds.length, 3);
});

test("poenggrense, høyest vinner: slutt etter runden der noen når grensen, og høyest sum vinner", () => {
  let s = game({ players: ["A", "B"], target: 100 }, [60, 50], [39, 45]);
  assert.equal(S.status(s).over, false);
  s = round(s, [5, 30]); // begge over 100 i samme runde: 104 og 125
  const st = S.status(s);
  assert.equal(st.reason, "target");
  assert.deepEqual(st.winners, [1]);
  assert.equal(round(s, [1, 1]).rounds.length, 3);
});

test("poenggrense, lavest vinner: grensen stopper spillet, og lavest sum vinner", () => {
  const s = game({ players: ["A", "B", "C"], mode: "lavest", target: 50 }, [20, 10, 15], [35, 5, 20]);
  const st = S.status(s);
  assert.deepEqual(st.totals, [55, 15, 35]);
  assert.equal(st.reason, "target");
  assert.deepEqual(st.winners, [1]);
});

test("antall runder: slutt når alle rundene er ført (minigolf)", () => {
  let s = S.create({ players: ["A", "B"], mode: "lavest", maxRounds: 3 });
  s = round(round(s, [2, 3]), [4, 2]);
  assert.equal(S.status(s).over, false);
  s = round(s, [3, 3]);
  assert.equal(S.status(s).reason, "rounds");
  assert.deepEqual(S.status(s).totals, [9, 8]);
  assert.deepEqual(S.status(s).winners, [1]);
});

test("likt øverst gir delt seier", () => {
  const s = game({ players: ["A", "B", "C"], maxRounds: 1 }, [10, 10, 3]);
  assert.deepEqual(S.status(s).winners, [0, 1]);
  const r = S.ranking(s);
  assert.deepEqual(r.map((x) => x.place), [1, 1, 3]);
});

// ---------- Nedtelling ----------

test("nedtelling: det som føres, trekkes fra, og lavest rest leder", () => {
  const s = game({ players: ["A", "B"], mode: "nedtelling", start: 301 }, [60, 100], [45, 26]);
  assert.deepEqual(S.status(s).totals, [196, 175]);
  assert.deepEqual(S.status(s).leaders, [1]);
});

test("nedtelling: førstemann til nøyaktig 0 vinner, og spillet er slutt", () => {
  let s = game({ players: ["A", "B"], mode: "nedtelling", start: 101 }, [60, 50], [41, 20]);
  const st = S.status(s);
  assert.equal(st.reason, "zero");
  assert.deepEqual(st.winners, [0]);
  assert.deepEqual(st.totals, [0, 51], "kastene etter at noen gikk ut, teller ikke");
  assert.equal(round(s, [0, 10]).rounds.length, 2);
});

test("nedtelling: fører du mer enn du har igjen, sprekker du og står på samme tall", () => {
  const s = game({ players: ["A", "B"], mode: "nedtelling", start: 101 }, [60, 50], [60, 20], [40, 10]);
  const st = S.standing(s);
  assert.deepEqual(st.totals, [1, 21]);
  assert.deepEqual(st.bust, [[false, false], [true, false], [false, false]]);
  assert.equal(S.status(s).over, false);
});

test("nedtelling: går to til 0 i samme runde, vinner den som står først", () => {
  const s = game({ players: ["A", "B", "C"], mode: "nedtelling", start: 50 }, [10, 50, 50]);
  assert.deepEqual(S.status(s).winners, [1]);
  assert.equal(S.ranking(s)[0].name, "B");
});

test("nedtelling avsluttet for hånd: den med minst igjen vinner", () => {
  const s = S.end(game({ players: ["A", "B"], mode: "nedtelling", start: 301 }, [100, 140]));
  assert.deepEqual(S.status(s).winners, [1]);
});

// ---------- Retting ----------

test("en tidligere rute kan rettes, og sum og vinner regnes ut på nytt", () => {
  let s = game({ players: ["A", "B"], target: 100 }, [60, 50], [30, 30]);
  assert.equal(S.status(s).over, false);
  s = S.setScore(s, 0, 0, "75"); // A fikk egentlig 75
  assert.deepEqual(S.status(s).totals, [105, 80]);
  assert.equal(S.status(s).reason, "target");
  s = S.setScore(s, 0, 0, "");
  assert.deepEqual(S.status(s).totals, [30, 80], "tomt felt blir 0");
  assert.equal(S.status(s).over, false);
  assert.equal(S.setScore(s, 5, 0, "1"), s);
  assert.equal(S.setScore(s, 0, 9, "1"), s);
});

test("retting i nedtelling kan oppheve en sprekk og en seier", () => {
  let s = game({ players: ["A", "B"], mode: "nedtelling", start: 100 }, [60, 50], [40, 10]);
  assert.deepEqual(S.status(s).winners, [0]);
  s = S.setScore(s, 1, 0, "45"); // var egentlig 45: sprekk
  assert.equal(S.status(s).over, false);
  assert.deepEqual(S.standing(s).bust[1], [true, false]);
  assert.deepEqual(S.status(s).totals, [40, 40]);
});

test("«Slett siste runde» fjerner siste runde og åpner spillet igjen", () => {
  let s = game({ players: ["A", "B"], maxRounds: 2 }, [1, 2], [3, 4]);
  assert.equal(S.status(s).over, true);
  s = S.removeLastRound(s);
  assert.deepEqual(s.rounds, [[1, 2]]);
  assert.equal(S.status(s).over, false);
  s = S.removeLastRound(S.end(s));
  assert.equal(s.ended, false);
  assert.equal(S.removeLastRound(s), s, "ingenting å slette");
});

// ---------- Plassering, ny omgang og lagring ----------

test("plassering: best først, etter tellemåten", () => {
  const hi = game({ players: ["A", "B", "C"] }, [5, 9, 7]);
  assert.deepEqual(S.ranking(hi).map((r) => r.name), ["B", "C", "A"]);
  const lo = game({ players: ["A", "B", "C"], mode: "lavest" }, [5, 9, 7]);
  assert.deepEqual(S.ranking(lo).map((r) => [r.name, r.total, r.place]), [["A", 5, 1], ["C", 7, 2], ["B", 9, 3]]);
});

test("«Ny omgang» bruker samme spillere og innstillinger, med blank blokk", () => {
  const s = game({ players: ["A", "B"], mode: "nedtelling", start: 301 }, [100, 50]);
  const again = S.create(S.config(s));
  assert.deepEqual(again.players, ["A", "B"]);
  assert.equal(again.start, 301);
  assert.deepEqual(again.rounds, []);
});

test("et lagret spill kan hentes inn igjen, og ødelagte data gir null", () => {
  let s = game({ players: ["A", "B"], mode: "lavest", target: 100 }, [10, 20]);
  s = S.setDraft(s, 1, "4");
  assert.deepEqual(S.restore(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(S.restore(JSON.parse(JSON.stringify(S.end(s)))).ended, true);
  assert.equal(S.restore(null), null);
  assert.equal(S.restore({}), null);
  assert.equal(S.restore({ players: [], rounds: [], draft: [] }), null);
  assert.equal(S.restore({ players: ["A", "B"], rounds: [[1]], draft: [null, null] }), null);
  assert.equal(S.restore({ players: ["A", "B"], rounds: [], draft: [null] }), null);
  assert.equal(S.restore({ players: ["A"], rounds: "x", draft: [null] }), null);
});

// ---------- Hele spill ----------

test("hele spill med fast frø blir ferdige for alle malene, og summene stemmer", () => {
  for (const t of S.TEMPLATES) {
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seeded(seed * 17);
      const count = 1 + Math.floor(rand() * 8);
      let s = S.create({ ...t, players: new Array(count).fill("") });
      let steps = 0;
      while (!S.status(s).over) {
        const values = s.players.map(() => Math.floor(rand() * 61));
        const next = round(s, values);
        if (next.rounds.length === s.rounds.length) break; // helt tom runde kan ikke skje her
        s = next;
        const st = S.standing(s);
        if (s.mode === "nedtelling") {
          assert.ok(st.totals.every((x) => x >= 0 && x <= s.start), "rest mellom 0 og start");
        } else {
          s.players.forEach((_, p) => assert.equal(st.totals[p], s.rounds.reduce((a, row) => a + row[p], 0)));
        }
        if (++steps >= 400) s = S.end(s); // «Fritt» har ingen slutt
      }
      const st = S.status(s);
      assert.equal(st.over, true);
      assert.ok(st.winners.length >= 1);
      assert.equal(S.ranking(s)[0].place, 1);
      assert.ok(st.winners.includes(S.ranking(s)[0].player));
      if (t.id === "minigolf") assert.equal(s.rounds.length, 18);
      if (t.id === "dart501") assert.equal(st.totals[st.winners[0]], 0);
    }
  }
});
