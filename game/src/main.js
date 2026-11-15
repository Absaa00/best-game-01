'use strict';
/* Lumen Tide — bootstrap, input, the main loop and the staged screenshot mode.
   The game runs at a fixed logical size of 1280x480; CSS scales the canvas
   to the window. `?shot=start|play|dawn|win|over` stages one deterministic
   scene with a fixed seed and renders it once, for real screenshots of the
   game's own code. */

const BEST_KEY = 'lumen-tide-best';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sfx = new SoundFX();
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const input = {
  left: false, right: false, up: false, down: false,
  mouse: { active: false, x: WORLD_W / 2, y: 300 },
};

let world = createWorld((Date.now() % 2147483647) >>> 0);
try {
  const saved = window.localStorage.getItem(BEST_KEY);
  if (saved !== null) world.best = parseInt(saved, 10) || 0;
} catch (e) { /* storage unavailable: best stays 0 */ }

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch (e) { /* ignore */ }
}

function toLogical(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * WORLD_W,
    y: ((clientY - r.top) / r.height) * WORLD_H,
  };
}

function handleEvents() {
  for (const ev of world.events) {
    if (ev.type === 'collect') sfx.collect(ev.combo);
    else if (ev.type === 'hit') sfx.hit();
    else if (ev.type === 'level') sfx.levelUp();
    else if (ev.type === 'win') sfx.win();
    else if (ev.type === 'lose') sfx.lose();
    else if (ev.type === 'start') sfx.click();
  }
  world.events.length = 0;
}

function beginPlay() {
  sfx.ensure();
  startGame(world);
  saveBest();
}

function onKey(e) {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') input.up = true;
  else if (k === 'ArrowDown' || k === 's' || k === 'S') input.down = true;
  else if (k === ' ' || k === 'Enter') {
    if (world.state === 'title' || world.state === 'victory' || world.state === 'gameover') {
      beginPlay();
    }
  } else if (k === 'p' || k === 'P' || k === 'Escape') {
    if (world.state === 'playing') world.state = 'paused';
    else if (world.state === 'paused') world.state = 'playing';
  } else if (k === 'm' || k === 'M') {
    sfx.ensure();
    sfx.toggleMute();
  } else if (k === 'r' || k === 'R') {
    if (world.state !== 'title') beginPlay();
  }
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
}

function onKeyUp(e) {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') input.up = false;
  else if (k === 'ArrowDown' || k === 's' || k === 'S') input.down = false;
}

function onPointer(e) {
  const p = toLogical(e.clientX, e.clientY);
  input.mouse.active = true;
  input.mouse.x = p.x;
  input.mouse.y = p.y;
}

function onClick() {
  if (world.state === 'title' || world.state === 'victory' || world.state === 'gameover') {
    beginPlay();
  }
}

window.addEventListener('keydown', onKey);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('pointermove', onPointer);
window.addEventListener('pointerdown', onPointer);
canvas.addEventListener('click', onClick);

let lastT = 0;
function frame(t) {
  const dt = Math.min(1 / 30, Math.max(0, (t - lastT) / 1000 || 0.016));
  lastT = t;
  update(world, dt, input);
  handleEvents();
  if (world.state === 'victory' || world.state === 'gameover') saveBest();
  render(ctx, world);
  window.requestAnimationFrame(frame);
}

/* --- staged screenshots: deterministic scenes, rendered once. --- */

function nearestMote(w) {
  let bestM = null;
  let bestD = Infinity;
  for (const m of w.motes) {
    const d = Math.abs(m.x - w.player.x) + Math.abs(m.y - w.player.y) * 1.5;
    if (d < bestD) { bestD = d; bestM = m; }
  }
  return bestM;
}

function autopilotStep(w) {
  // Chase the nearest mote; flinch away from a close shadow wisp.
  const mote = nearestMote(w);
  let tx = w.player.x;
  let ty = w.player.y;
  if (mote) { tx = mote.x; ty = mote.y - 10; }
  for (const s of w.wisps) {
    const sy = s.y + s.bob;
    if (Math.abs(s.x - w.player.x) < 110 && Math.abs(sy - w.player.y) < 90) {
      ty = sy > w.player.y ? w.player.y - 90 : w.player.y + 90;
      tx = w.player.x + (s.x > w.player.x ? -70 : 70);
    }
  }
  input.mouse.active = true;
  input.mouse.x = clamp(tx, 24, WORLD_W - 24);
  input.mouse.y = clamp(ty, 56, SEA_Y - 14);
}

function stageScene(kind) {
  const dt = 1 / 60;
  if (kind === 'start') {
    world = createWorld(20261116);
    world.time = 6;
    world.best = 1840;
  } else if (kind === 'play') {
    world = createWorld(770031);
    world.state = 'playing';
    world.best = 1840;
    // Play ~13 seconds with the autopilot, then freeze mid-action.
    for (let i = 0; i < 780 && world.state === 'playing'; i++) {
      autopilotStep(world);
      update(world, dt, input);
    }
    // Stage a few fresh motes mid-fall so the frozen frame shows the catch.
    for (let i = 0; i < 5; i++) {
      spawnMote(world);
      const m = world.motes[world.motes.length - 1];
      m.y = 80 + i * 52;
      m.x = 180 + i * 210 + (i % 2) * 60;
    }
    world.banner = { text: 'LEVEL ' + world.level, sub: 'The tide quickens', t: 0.4, life: 2.2 };
  } else if (kind === 'dawn') {
    world = createWorld(515005);
    world.state = 'playing';
    world.best = 1840;
    world.score = 2210;
    world.motesCollected = 59;
    world.maxCombo = 8;
    world.combo = 7;
    world.level = 5;
    // One mote placed on the player so the next step fills the meter.
    world.motes.push({ x: world.player.x, y: world.player.y, r: 11, vy: 60, sway: 0.8, phase: 0, hue: 'gold', spin: 0 });
    for (let i = 0; i < 9; i++) spawnMote(world);
    update(world, dt, input); // collects the mote -> state 'dawn'
    for (let i = 0; i < 62 && world.state === 'dawn'; i++) update(world, dt, input);
  } else if (kind === 'win') {
    world = createWorld(910077);
    world.time = 8;
    world.state = 'victory';
    world.score = 2680;
    world.best = 2680;
    world.motesCollected = 60;
    world.maxCombo = 9;
    world.level = 5;
    world.dawnT = 1;
  } else if (kind === 'over') {
    world = createWorld(330019);
    world.time = 8;
    world.state = 'gameover';
    world.score = 1420;
    world.best = 1840;
    world.motesCollected = 41;
    world.maxCombo = 6;
    world.level = 4;
    world.hearts = 0;
  } else {
    return false;
  }
  handleEvents();
  render(ctx, world);
  document.title = 'LUMEN:' + world.state + ':' + world.score + ':' + world.motesCollected;
  window.__shotReady = true;
  return true;
}

if (shot) {
  stageScene(shot);
} else {
  window.requestAnimationFrame(frame);
}
