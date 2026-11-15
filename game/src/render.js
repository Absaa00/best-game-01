'use strict';
/* Lumen Tide — all drawing. Every pixel is procedural canvas art: the night
   sky, aurora ribbons, moon, mountains, sea, the lantern wisp, the motes,
   the shadow wisps, the HUD and the title / end screens. */

function mix(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function rgb(c, alpha) {
  return alpha === undefined
    ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
    : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
}

const NIGHT_TOP = [7, 10, 30];
const NIGHT_MID = [23, 32, 84];
const NIGHT_BOT = [43, 54, 120];
const DAWN_TOP = [64, 84, 160];
const DAWN_MID = [214, 130, 110];
const DAWN_BOT = [255, 196, 120];

function drawSky(ctx, w) {
  const d = w.state === 'dawn' || w.state === 'victory' ? (w.state === 'victory' ? 1 : w.dawnT) : 0;
  const top = mix(NIGHT_TOP, DAWN_TOP, d);
  const mid = mix(NIGHT_MID, DAWN_MID, d);
  const bot = mix(NIGHT_BOT, DAWN_BOT, d);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, rgb(top));
  g.addColorStop(0.55, rgb(mid));
  g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function drawStars(ctx, w) {
  for (const s of w.stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(w.time * s.speed + s.phase));
    ctx.globalAlpha = tw * (1 - (w.state === 'victory' ? 0.7 : 0));
    ctx.fillStyle = '#e8eeff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon(ctx, w) {
  // The moon sets as the dawn rises.
  const d = w.state === 'dawn' ? w.dawnT : w.state === 'victory' ? 1 : 0;
  if (d >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - d * 0.9;
  const x = 1130;
  const y = 66;
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 90);
  glow.addColorStop(0, 'rgba(255, 244, 200, 0.55)');
  glow.addColorStop(1, 'rgba(255, 244, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, y - 90, 180, 180);
  ctx.fillStyle = '#fdf3cf';
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(214, 196, 140, 0.5)';
  ctx.beginPath();
  ctx.arc(x - 9, y - 6, 6, 0, TAU);
  ctx.arc(x + 8, y + 9, 4.5, 0, TAU);
  ctx.arc(x + 11, y - 11, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function auroraBand(ctx, w, baseY, amp, hue, alpha, speed) {
  ctx.beginPath();
  ctx.moveTo(0, WORLD_H);
  for (let x = 0; x <= WORLD_W; x += 16) {
    const y = baseY
      + Math.sin(x * 0.004 + w.time * speed) * amp
      + Math.sin(x * 0.011 - w.time * speed * 0.7) * amp * 0.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, baseY - amp * 1.6, 0, WORLD_H);
  g.addColorStop(0, hue.replace('A', String(alpha)));
  g.addColorStop(1, hue.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.fill();
}

function drawAurora(ctx, w) {
  const d = w.state === 'dawn' || w.state === 'victory' ? (w.state === 'victory' ? 1 : w.dawnT) : 0;
  if (d > 0.85) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  auroraBand(ctx, w, 150, 34, 'rgba(45, 226, 197, A)', 0.20 * (1 - d), 0.24);
  auroraBand(ctx, w, 190, 44, 'rgba(139, 92, 246, A)', 0.16 * (1 - d), 0.17);
  auroraBand(ctx, w, 120, 26, 'rgba(244, 114, 182, A)', 0.12 * (1 - d), 0.31);
  ctx.restore();
}

function drawMountains(ctx) {
  ctx.fillStyle = '#0d1233';
  ctx.beginPath();
  ctx.moveTo(0, SEA_Y);
  const peaks = [0, 120, 260, 430, 610, 790, 960, 1120, 1280];
  const heights = [66, 108, 74, 128, 88, 118, 70, 104, 60];
  peaks.forEach((x, i) => ctx.lineTo(x, SEA_Y - heights[i]));
  ctx.lineTo(WORLD_W, SEA_Y);
  ctx.closePath();
  ctx.fill();
  // Snow caps catch the moonlight.
  ctx.fillStyle = 'rgba(220, 230, 255, 0.75)';
  [[260, 74], [430, 128], [790, 118], [1120, 104]].forEach(([x, h]) => {
    ctx.beginPath();
    ctx.moveTo(x - 16, SEA_Y - h + 12);
    ctx.lineTo(x, SEA_Y - h);
    ctx.lineTo(x + 16, SEA_Y - h + 12);
    ctx.lineTo(x + 6, SEA_Y - h + 16);
    ctx.lineTo(x, SEA_Y - h + 11);
    ctx.lineTo(x - 6, SEA_Y - h + 16);
    ctx.closePath();
    ctx.fill();
  });
}

function drawSea(ctx, w) {
  const g = ctx.createLinearGradient(0, SEA_Y, 0, WORLD_H);
  g.addColorStop(0, '#101a45');
  g.addColorStop(1, '#05070f');
  ctx.fillStyle = g;
  ctx.fillRect(0, SEA_Y, WORLD_W, WORLD_H - SEA_Y);
  // Shimmering light streaks on the water.
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const x = ((i * 173 + w.time * (12 + (i % 5) * 6)) % (WORLD_W + 120)) - 60;
    const y = SEA_Y + 8 + (i * 37) % 52;
    const len = 26 + (i % 4) * 14;
    ctx.globalAlpha = 0.10 + (i % 3) * 0.05;
    ctx.fillStyle = i % 4 === 0 ? '#ffd166' : '#7dd3fc';
    ctx.fillRect(x, y, len, 2);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(180, 200, 255, 0.35)';
  ctx.fillRect(0, SEA_Y, WORLD_W, 2);
}

function drawSun(ctx, w) {
  const d = w.state === 'dawn' ? w.dawnT : w.state === 'victory' ? 1 : 0;
  if (d <= 0) return;
  const x = WORLD_W / 2;
  const y = SEA_Y + 40 - d * 190;
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 190);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.85)');
  glow.addColorStop(0.4, 'rgba(255, 170, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 200, y - 200, 400, 400);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff7d6';
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, TAU);
  ctx.fill();
}

function drawMote(ctx, m, time) {
  const pulse = 0.75 + 0.25 * Math.sin(time * 4 + m.phase);
  const col = m.hue === 'gold' ? '255, 209, 102' : '125, 211, 252';
  const glow = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.r * 3.1);
  glow.addColorStop(0, 'rgba(' + col + ', 0.85)');
  glow.addColorStop(1, 'rgba(' + col + ', 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(m.x - m.r * 3.1, m.y - m.r * 3.1, m.r * 6.2, m.r * 6.2);
  ctx.fillStyle = 'rgba(' + col + ', 1)';
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(m.x - m.r * 0.25, m.y - m.r * 0.25, m.r * 0.45, 0, TAU);
  ctx.fill();
  // Four-point sparkle.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.4;
  const s = m.r * 1.9 * pulse;
  ctx.beginPath();
  ctx.moveTo(m.x - s, m.y);
  ctx.lineTo(m.x + s, m.y);
  ctx.moveTo(m.x, m.y - s);
  ctx.lineTo(m.x, m.y + s);
  ctx.stroke();
}

function drawWisp(ctx, s, time) {
  const y = s.y + s.bob;
  const glow = ctx.createRadialGradient(s.x, y, 2, s.x, y, s.r * 2.6);
  glow.addColorStop(0, 'rgba(139, 92, 246, 0.5)');
  glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.x - s.r * 2.6, y - s.r * 2.6, s.r * 5.2, s.r * 5.2);
  // Smoky body: three overlapping dark orbs with a ragged tail.
  ctx.fillStyle = '#241640';
  ctx.beginPath();
  ctx.arc(s.x, y, s.r, 0, TAU);
  ctx.arc(s.x - s.r * 0.55, y + s.r * 0.3, s.r * 0.62, 0, TAU);
  ctx.arc(s.x + s.r * 0.5, y + s.r * 0.35, s.r * 0.58, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a0f30';
  ctx.beginPath();
  ctx.moveTo(s.x - s.r * 0.9, y + s.r * 0.4);
  ctx.quadraticCurveTo(s.x - s.r * 1.5, y + s.r * 1.3, s.x - s.r * 0.4, y + s.r * 1.1);
  ctx.quadraticCurveTo(s.x, y + s.r * 1.5, s.x + s.r * 0.5, y + s.r * 1.05);
  ctx.quadraticCurveTo(s.x + s.r * 1.4, y + s.r * 1.2, s.x + s.r * 0.9, y + s.r * 0.4);
  ctx.closePath();
  ctx.fill();
  // Glowing violet eyes.
  const blink = Math.sin(time * 2 + s.phase) > -0.86 ? 1 : 0.15;
  ctx.fillStyle = '#d8b4fe';
  ctx.beginPath();
  ctx.ellipse(s.x - s.r * 0.32, y - s.r * 0.12, 3.4, 4.4 * blink, 0, 0, TAU);
  ctx.ellipse(s.x + s.r * 0.32, y - s.r * 0.12, 3.4, 4.4 * blink, 0, 0, TAU);
  ctx.fill();
}

function drawPlayer(ctx, w) {
  const p = w.player;
  // Fading trail.
  p.trail.forEach((s, i) => {
    const a = 0.35 * (1 - i / p.trail.length) * (1 - s.t * 2);
    if (a <= 0) return;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5 * (1 - i / p.trail.length) + 1, 0, TAU);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  // Invulnerability blink.
  if (p.invuln > 0 && Math.floor(w.time * 12) % 2 === 0) return;
  const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 52);
  glow.addColorStop(0, 'rgba(165, 243, 252, 0.9)');
  glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - 52, p.y - 52, 104, 104);
  // Little lantern-keeper: a teardrop flame body with a tiny face.
  ctx.fillStyle = '#ecfeff';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 20);
  ctx.quadraticCurveTo(p.x + 13, p.y - 2, p.x + 9, p.y + 8);
  ctx.quadraticCurveTo(p.x + 5, p.y + 15, p.x, p.y + 15);
  ctx.quadraticCurveTo(p.x - 5, p.y + 15, p.x - 9, p.y + 8);
  ctx.quadraticCurveTo(p.x - 13, p.y - 2, p.x, p.y - 20);
  ctx.fill();
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.arc(p.x - 4.5, p.y - 2, 1.8, 0, TAU);
  ctx.arc(p.x + 4.5, p.y - 2, 1.8, 0, TAU);
  ctx.fill();
  // The lantern it carries.
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(p.x + 12, p.y + 2, 8, 10);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(p.x + 11, p.y + 1, 10, 2);
  ctx.fillRect(p.x + 11, p.y + 12, 10, 2);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(p.x + 13.5, p.y + 4, 5, 6);
}

function drawParticles(ctx, w) {
  for (const pt of w.particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, w) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px system-ui, sans-serif';
  for (const pp of w.popups) {
    ctx.globalAlpha = Math.max(0, 1 - pp.t / pp.life);
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, pp.x, pp.y);
  }
  ctx.globalAlpha = 1;
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-11, -4, -6, -12, 0, -6);
  ctx.bezierCurveTo(6, -12, 11, -4, 0, 5);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#fb7185';
    ctx.shadowColor = '#fb7185';
    ctx.shadowBlur = 8;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHUD(ctx, w) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Score, top-left.
  ctx.fillStyle = 'rgba(7, 10, 30, 0.45)';
  roundRect(ctx, 14, 12, 218, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#e8eeff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(fmtInt(w.score), 28, 40);
  ctx.fillStyle = 'rgba(232, 238, 255, 0.65)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('SCORE   ·   BEST ' + fmtInt(Math.max(w.best, w.score)), 28, 58);
  // Dawn meter, top-center.
  const mw = 340;
  const mx = (WORLD_W - mw) / 2;
  ctx.fillStyle = 'rgba(7, 10, 30, 0.45)';
  roundRect(ctx, mx - 8, 12, mw + 16, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('☀  DAWN  ' + w.motesCollected + ' / ' + MOTES_TO_DAWN, WORLD_W / 2, 31);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  roundRect(ctx, mx, 40, mw, 12, 6);
  ctx.fill();
  const frac = w.motesCollected / MOTES_TO_DAWN;
  const dg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  dg.addColorStop(0, '#f59e0b');
  dg.addColorStop(1, '#fde68a');
  ctx.fillStyle = dg;
  if (frac > 0) {
    roundRect(ctx, mx, 40, Math.max(12, mw * frac), 12, 6);
    ctx.fill();
  }
  // Hearts + level, top-right.
  ctx.fillStyle = 'rgba(7, 10, 30, 0.45)';
  roundRect(ctx, WORLD_W - 232, 12, 218, 58, 10);
  ctx.fill();
  for (let i = 0; i < MAX_HEARTS; i++) {
    drawHeart(ctx, WORLD_W - 196 + i * 30, 42, 26, i < w.hearts);
  }
  ctx.fillStyle = '#e8eeff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('LEVEL ' + w.level, WORLD_W - 28, 47);
  // Combo badge near the player.
  if (w.combo >= 2 && w.state === 'playing') {
    const mult = 1 + Math.floor(w.combo / 4);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fillText('×' + Math.min(mult, 5) + '  COMBO ' + w.combo, w.player.x, w.player.y - 36);
    ctx.shadowBlur = 0;
  }
  // Banner (level up / night one).
  if (w.banner) {
    const a = w.banner.t < 0.3 ? w.banner.t / 0.3 : w.banner.t > w.banner.life - 0.5 ? (w.banner.life - w.banner.t) / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillStyle = '#fef3c7';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;
    ctx.fillText(w.banner.text, WORLD_W / 2, 190);
    ctx.shadowBlur = 0;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232, 238, 255, 0.9)';
    ctx.fillText(w.banner.sub, WORLD_W / 2, 216);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7, 10, 30, 0.62)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTitle(ctx, w) {
  panel(ctx, 330, 74, 620, 332);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 24;
  ctx.fillText('LUMEN TIDE', WORLD_W / 2, 152);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText('a lantern-keeper’s night', WORLD_W / 2, 184);
  ctx.fillStyle = '#e8eeff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Catch the falling starlight to fill the dawn meter.', WORLD_W / 2, 224);
  ctx.fillText('Dodge the shadow wisps — three touches and the night wins.', WORLD_W / 2, 248);
  ctx.fillStyle = 'rgba(232, 238, 255, 0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('ARROWS / WASD or MOUSE to glide  ·  P pause  ·  M mute  ·  R restart', WORLD_W / 2, 284);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  const pulse = 0.65 + 0.35 * Math.sin(w.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillText('CLICK  or  press  SPACE  to begin', WORLD_W / 2, 326);
  ctx.globalAlpha = 1;
  if (w.best > 0) {
    ctx.fillStyle = 'rgba(232, 238, 255, 0.7)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('BEST  ' + fmtInt(w.best), WORLD_W / 2, 362);
  }
  ctx.fillStyle = 'rgba(232, 238, 255, 0.45)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('60 motes bring the dawn  ·  combos multiply your score', WORLD_W / 2, 388);
}

function drawEnd(ctx, w, win) {
  const title = win ? 'DAWN BREAKS' : 'THE NIGHT PREVAILS';
  const sub = win
    ? 'The lantern-keeper lit the morning — the tide is yours.'
    : 'The shadows took the last light. The tide will rise again.';
  panel(ctx, 330, 74, 620, 332);
  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#fef3c7' : '#e9d5ff';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.shadowColor = win ? '#f59e0b' : '#8b5cf6';
  ctx.shadowBlur = 22;
  ctx.fillText(title, WORLD_W / 2, 148);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8eeff';
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillText(sub, WORLD_W / 2, 182);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#e8eeff';
  const rows = [
    ['FINAL SCORE', fmtInt(w.score)],
    ['STARLIGHT CAUGHT', w.motesCollected + ' motes'],
    ['BEST COMBO', '×' + w.maxCombo],
    ['LEVEL REACHED', String(w.level)],
    ['BEST SCORE', fmtInt(Math.max(w.best, w.score))],
  ];
  rows.forEach(([label, value], i) => {
    const y = 222 + i * 26;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(232, 238, 255, 0.7)';
    ctx.fillText(label, WORLD_W / 2 - 12, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(value, WORLD_W / 2 + 12, y);
    ctx.font = '15px system-ui, sans-serif';
  });
  ctx.textAlign = 'center';
  const pulse = 0.65 + 0.35 * Math.sin(w.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('Press  R  or  CLICK  to play again', WORLD_W / 2, 372);
  ctx.globalAlpha = 1;
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(7, 10, 30, 0.55)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('PAUSED', WORLD_W / 2, 220);
  ctx.fillStyle = 'rgba(232, 238, 255, 0.85)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press P to keep playing  ·  R to restart', WORLD_W / 2, 254);
}

function render(ctx, w) {
  ctx.save();
  if (w.shake > 0) {
    ctx.translate((w.rng() - 0.5) * w.shake, (w.rng() - 0.5) * w.shake);
  }
  drawSky(ctx, w);
  drawStars(ctx, w);
  drawMoon(ctx, w);
  drawAurora(ctx, w);
  drawSun(ctx, w);
  drawMountains(ctx);
  drawSea(ctx, w);
  for (const m of w.motes) drawMote(ctx, m, w.time);
  for (const s of w.wisps) drawWisp(ctx, s, w.time);
  // The keeper is on screen only while the night is being played; on the
  // end screens the dawn (or the dark) has taken the stage.
  if (w.state === 'playing' || w.state === 'paused' || w.state === 'dawn') drawPlayer(ctx, w);
  drawParticles(ctx, w);
  drawPopups(ctx, w);
  if (w.state !== 'title') drawHUD(ctx, w);
  if (w.state === 'title') drawTitle(ctx, w);
  if (w.state === 'victory') drawEnd(ctx, w, true);
  if (w.state === 'gameover') drawEnd(ctx, w, false);
  if (w.state === 'paused') drawPaused(ctx);
  ctx.restore();
  // Red flash on taking a hit.
  if (w.flash > 0) {
    ctx.fillStyle = 'rgba(190, 60, 90, ' + (w.flash * 0.35) + ')';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}
