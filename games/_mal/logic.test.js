const { test } = require("node:test");
const assert = require("node:assert/strict");
const ClickSprint = require("./logic.js");

test("klikk teller ikke før spillet er startet", () => {
  const s = ClickSprint.click(ClickSprint.create());
  assert.equal(s.score, 0);
});

test("klikk teller mens spillet pågår", () => {
  let s = ClickSprint.start(ClickSprint.create());
  s = ClickSprint.click(ClickSprint.click(s));
  assert.equal(s.score, 2);
});

test("spillet slutter når tiden er ute", () => {
  let s = ClickSprint.start(ClickSprint.create());
  s = ClickSprint.tick(s, ClickSprint.DURATION_MS - 1);
  assert.equal(s.status, "playing");
  s = ClickSprint.tick(s, 5);
  assert.equal(s.status, "over");
  assert.equal(s.remainingMs, 0);
});

test("klikk teller ikke etter at tiden er ute", () => {
  let s = ClickSprint.start(ClickSprint.create());
  s = ClickSprint.click(s);
  s = ClickSprint.tick(s, ClickSprint.DURATION_MS);
  s = ClickSprint.click(s);
  assert.equal(s.score, 1);
});

test("ny start nullstiller poeng og tid", () => {
  let s = ClickSprint.start(ClickSprint.create());
  s = ClickSprint.tick(ClickSprint.click(s), ClickSprint.DURATION_MS);
  s = ClickSprint.start(s);
  assert.equal(s.score, 0);
  assert.equal(s.remainingMs, ClickSprint.DURATION_MS);
});
