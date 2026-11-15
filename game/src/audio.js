'use strict';
/* Procedural sound: every effect is synthesized with WebAudio oscillators.
   No audio files, no network. Audio starts only after a user gesture. */

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // minor pentatonic steps

function SoundFX() {
  this.ctx = null;
  this.muted = false;
  this.master = null;
}

SoundFX.prototype.ensure = function () {
  if (this.ctx) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  } catch (e) {
    this.ctx = null;
  }
};

SoundFX.prototype.toggleMute = function () {
  this.muted = !this.muted;
  if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
  return this.muted;
};

SoundFX.prototype.tone = function (freq, dur, type, vol, when, slideTo) {
  if (!this.ctx || this.muted) return;
  const t0 = this.ctx.currentTime + (when || 0);
  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(this.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

/* A bright chime that climbs the pentatonic ladder with the combo. */
SoundFX.prototype.collect = function (combo) {
  const step = PENTA[Math.min(combo, PENTA.length - 1)];
  const f = 523.25 * Math.pow(2, step / 12);
  this.tone(f, 0.35, 'sine', 0.55);
  this.tone(f * 2, 0.22, 'triangle', 0.18, 0.01);
};

/* A dull thud plus a falling tone when a shadow wisp hits. */
SoundFX.prototype.hit = function () {
  this.tone(140, 0.3, 'sawtooth', 0.5, 0, 55);
  this.tone(70, 0.35, 'square', 0.3, 0, 40);
};

/* A rising three-note arpeggio on level up. */
SoundFX.prototype.levelUp = function () {
  const base = 392;
  [0, 4, 7, 12].forEach((s, i) => {
    this.tone(base * Math.pow(2, s / 12), 0.3, 'triangle', 0.4, i * 0.07);
  });
};

/* A warm major arpeggio when dawn breaks. */
SoundFX.prototype.win = function () {
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
    this.tone(261.63 * Math.pow(2, s / 12), 0.5, 'sine', 0.45, i * 0.09);
  });
};

/* A slow descending line when the night prevails. */
SoundFX.prototype.lose = function () {
  [12, 10, 7, 3, 0].forEach((s, i) => {
    this.tone(220 * Math.pow(2, s / 12), 0.55, 'triangle', 0.35, i * 0.16);
  });
};

/* A soft click for the title screen. */
SoundFX.prototype.click = function () {
  this.tone(880, 0.12, 'sine', 0.35);
  this.tone(1318.5, 0.1, 'sine', 0.15, 0.03);
};
