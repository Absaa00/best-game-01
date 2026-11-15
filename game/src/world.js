'use strict';
/* Lumen Tide — world simulation. Pure logic: entities, spawning, collisions,
   scoring, levels and the win/lose rules. Rendering lives in render.js. */

const WORLD_W = 1280;
const WORLD_H = 480;
const SEA_Y = 412;          // top of the sea band at the bottom of the screen
const MOTES_TO_DAWN = 60;   // motes that fill the dawn meter and win the game
const MOTES_PER_LEVEL = 12; // motes per level
const MAX_HEARTS = 3;
const COMBO_WINDOW = 2.5;   // seconds a combo survives without a collect
const PLAYER_R = 16;

function createWorld(seed) {
  const rng = mulberry32(seed >>> 0 || 1);
  const stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: rng() * WORLD_W,
      y: rng() * 380,
      r: 0.6 + rng() * 1.5,
      phase: rng() * TAU,
      speed: 0.4 + rng() * 1.2,
    });
  }
  return {
    rng,
    time: 0,
    state: 'title', // title | playing | paused | dawn | victory | gameover
    player: { x: WORLD_W / 2, y: 300, vx: 0, vy: 0, invuln: 0, trail: [] },
    motes: [],
    wisps: [],
    particles: [],
    popups: [],
    score: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    motesCollected: 0,
    motesMissed: 0,
    hearts: MAX_HEARTS,
    level: 1,
    moteTimer: 0.4,
    wispTimer: 2.4,
    shake: 0,
    dawnT: 0, // 0..1 progress of the dawn cinematic
    flash: 0,
    banner: null, // { text, sub, t }
    stars,
    events: [], // consumed by main.js each frame: { type, ... }
  };
}

function levelOf(motes) {
  return Math.min(6, 1 + Math.floor(motes / MOTES_PER_LEVEL));
}

function spawnMote(w) {
  const rng = w.rng;
  w.motes.push({
    x: 50 + rng() * (WORLD_W - 100),
    y: -18,
    r: 9 + rng() * 4,
    vy: 52 + w.level * 9 + rng() * 26,
    sway: 0.6 + rng() * 1.1,
    phase: rng() * TAU,
    hue: rng() < 0.75 ? 'gold' : 'cyan',
    spin: rng() * TAU,
  });
}

function spawnWisp(w) {
  const rng = w.rng;
  const fromLeft = rng() < 0.5;
  w.wisps.push({
    x: fromLeft ? -24 : WORLD_W + 24,
    y: 70 + rng() * 300,
    r: 15 + rng() * 7,
    vx: (fromLeft ? 1 : -1) * (62 + w.level * 10 + rng() * 30),
    sway: 0.5 + rng() * 0.9,
    phase: rng() * TAU,
    bob: 0,
  });
}

function burst(w, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = w.rng() * TAU;
    const s = (0.3 + w.rng() * 0.7) * speed;
    w.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: 0.5 + w.rng() * 0.5,
      t: 0,
      r: 1.5 + w.rng() * 2.5,
      color,
    });
  }
}

function popup(w, x, y, text, color) {
  w.popups.push({ x, y, text, color: color || '#ffe9a8', t: 0, life: 1.1 });
}

function setBanner(w, text, sub) {
  w.banner = { text, sub: sub || '', t: 0, life: 2.2 };
}

function startGame(w) {
  const fresh = createWorld((w.rng() * 1e9) >>> 0);
  fresh.best = w.best;
  fresh.state = 'playing';
  // Keep the same object identity so main.js never re-binds.
  Object.keys(fresh).forEach((k) => { w[k] = fresh[k]; });
  setBanner(w, 'NIGHT ONE', 'Collect the falling starlight — fill the dawn meter');
  w.events.push({ type: 'start' });
}

function updatePlaying(w, dt, input) {
  const p = w.player;
  const speed = 430;

  // --- movement: keys set a velocity, the mouse pulls the wisp toward it.
  let kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (kx || ky) {
    const len = Math.hypot(kx, ky);
    p.vx = (kx / len) * speed;
    p.vy = (ky / len) * speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  } else if (input.mouse.active) {
    p.x = lerp(p.x, input.mouse.x, Math.min(1, dt * 11));
    p.y = lerp(p.y, input.mouse.y, Math.min(1, dt * 11));
  }
  p.x = clamp(p.x, 24, WORLD_W - 24);
  p.y = clamp(p.y, 56, SEA_Y - 14);
  if (p.invuln > 0) p.invuln -= dt;
  p.trail.unshift({ x: p.x, y: p.y, t: 0 });
  if (p.trail.length > 14) p.trail.pop();
  p.trail.forEach((s) => { s.t += dt; });

  // --- combo decay
  if (w.combo > 0) {
    w.comboTimer -= dt;
    if (w.comboTimer <= 0) {
      w.combo = 0;
    }
  }

  // --- spawning
  w.moteTimer -= dt;
  if (w.moteTimer <= 0) {
    spawnMote(w);
    w.moteTimer = Math.max(0.28, 0.62 - w.level * 0.055) * (0.75 + w.rng() * 0.5);
  }
  w.wispTimer -= dt;
  if (w.wispTimer <= 0) {
    spawnWisp(w);
    w.wispTimer = Math.max(1.1, 2.6 - w.level * 0.22) * (0.8 + w.rng() * 0.4);
  }

  // --- motes fall, sway, get collected or splash into the sea
  for (let i = w.motes.length - 1; i >= 0; i--) {
    const m = w.motes[i];
    m.y += m.vy * dt;
    m.x += Math.sin(w.time * m.sway + m.phase) * 34 * dt;
    m.spin += dt * 2;
    const dx = m.x - p.x;
    const dy = m.y - p.y;
    if (dx * dx + dy * dy < (m.r + PLAYER_R) * (m.r + PLAYER_R)) {
      w.motes.splice(i, 1);
      w.combo += 1;
      w.comboTimer = COMBO_WINDOW;
      if (w.combo > w.maxCombo) w.maxCombo = w.combo;
      const mult = 1 + Math.floor(w.combo / 4);
      const pts = 10 * Math.min(mult, 5);
      w.score += pts;
      w.motesCollected += 1;
      burst(w, m.x, m.y, m.hue === 'gold' ? '#ffd166' : '#7dd3fc', 12, 130);
      popup(w, m.x, m.y - 14, '+' + pts, m.hue === 'gold' ? '#ffe9a8' : '#bae6fd');
      w.events.push({ type: 'collect', combo: w.combo });
      const lv = levelOf(w.motesCollected);
      if (lv > w.level) {
        w.level = lv;
        setBanner(w, 'LEVEL ' + lv, lv === 6 ? 'The tide is at its fastest' : 'The tide quickens');
        w.events.push({ type: 'level' });
      }
      if (w.motesCollected >= MOTES_TO_DAWN) {
        w.state = 'dawn';
        w.dawnT = 0;
        w.events.push({ type: 'win' });
      }
      continue;
    }
    if (m.y > SEA_Y + 6) {
      w.motes.splice(i, 1);
      w.motesMissed += 1;
      if (w.combo > 0) {
        w.combo = 0;
        popup(w, m.x, SEA_Y - 12, 'missed', '#94a3b8');
      }
      burst(w, m.x, SEA_Y, '#38bdf8', 5, 60);
    }
  }

  // --- shadow wisps drift across; touching one costs a heart
  for (let i = w.wisps.length - 1; i >= 0; i--) {
    const s = w.wisps[i];
    s.x += s.vx * dt;
    s.bob = Math.sin(w.time * s.sway + s.phase) * 26;
    const dx = s.x - p.x;
    const dy = (s.y + s.bob) - p.y;
    if (p.invuln <= 0 && dx * dx + dy * dy < (s.r + PLAYER_R - 4) * (s.r + PLAYER_R - 4)) {
      w.wisps.splice(i, 1);
      w.hearts -= 1;
      w.combo = 0;
      p.invuln = 1.6;
      w.shake = 14;
      w.flash = 0.5;
      burst(w, p.x, p.y, '#a78bfa', 18, 190);
      w.events.push({ type: 'hit' });
      if (w.hearts <= 0) {
        w.state = 'gameover';
        if (w.score > w.best) w.best = w.score;
        w.events.push({ type: 'lose' });
      }
      continue;
    }
    if (s.x < -60 || s.x > WORLD_W + 60) w.wisps.splice(i, 1);
  }

  // --- particles, popups, banner, shake, flash
  stepFx(w, dt);
}

function stepFx(w, dt) {
  for (let i = w.particles.length - 1; i >= 0; i--) {
    const pt = w.particles[i];
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 60 * dt;
    if (pt.t >= pt.life) w.particles.splice(i, 1);
  }
  for (let i = w.popups.length - 1; i >= 0; i--) {
    const pp = w.popups[i];
    pp.t += dt;
    pp.y -= 34 * dt;
    if (pp.t >= pp.life) w.popups.splice(i, 1);
  }
  if (w.banner) {
    w.banner.t += dt;
    if (w.banner.t >= w.banner.life) w.banner = null;
  }
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 30);
  if (w.flash > 0) w.flash = Math.max(0, w.flash - dt * 1.4);
}

function update(w, dt, input) {
  w.time += dt;
  if (w.state === 'playing') {
    updatePlaying(w, dt, input);
  } else if (w.state === 'dawn') {
    w.dawnT = Math.min(1, w.dawnT + dt / 1.8);
    stepFx(w, dt);
    // The dawn cinematic: motes rise and burst as the sun climbs.
    if (w.rng() < dt * 14) {
      burst(w, 80 + w.rng() * (WORLD_W - 160), 120 + w.rng() * 200,
        w.rng() < 0.5 ? '#ffd166' : '#fda4af', 6, 90);
    }
    if (w.dawnT >= 1) {
      w.state = 'victory';
      if (w.score > w.best) w.best = w.score;
    }
  } else {
    // Title / victory / game over: the sky keeps breathing.
    stepFx(w, dt);
  }
}
