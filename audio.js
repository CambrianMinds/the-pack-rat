// Audio synthesizer for The Pack Rat (1992)
// Recreates authentic DOS PC speaker sound effects and musical jingles using Web Audio API

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.currentOsc = null;
    this.tickMs = 28; // authentic DOS PIT timer tick (~35 Hz)

    // Check localStorage, window.__MUTE_AUDIO__, or URL parameters
    let isMuted = false;
    try {
      if (typeof window !== 'undefined' && window.__MUTE_AUDIO__) {
        isMuted = true;
      } else if (typeof localStorage !== 'undefined' && localStorage.getItem('packrat_sound') === 'off') {
        isMuted = true;
      } else if (typeof window !== 'undefined' && window.location && window.location.search) {
        const search = window.location.search;
        if (search.includes('mute=1') || search.includes('muted=true') || search.includes('test=1')) {
          isMuted = true;
        }
      }
    } catch (e) {}

    this.enabled = !isMuted;
  }

  init() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  mute() {
    this.enabled = false;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('packrat_sound', 'off');
    } catch (e) {}
    this.stop();
    return false;
  }

  unmute() {
    this.enabled = true;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('packrat_sound', 'on');
    } catch (e) {}
    return true;
  }

  toggleSound() {
    if (this.enabled) {
      return this.mute();
    } else {
      return this.unmute();
    }
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.currentOsc) {
      try {
        this.currentOsc.stop();
        this.currentOsc.disconnect();
      } catch (e) {}
      this.currentOsc = null;
    }
  }

  play(soundIndex) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const sounds = window.PACKRAT_ASSETS && window.PACKRAT_ASSETS.sounds;
    if (!sounds || !sounds[soundIndex] || sounds[soundIndex].length === 0) return;

    const notes = sounds[soundIndex];
    this.playSequence(notes);
  }

  playSequence(notes) {
    this.stop();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // PC speaker is a crisp 1-bit square wave
    osc.type = 'square';

    // Lowpass filter to emulate PC speaker enclosure
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4500, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    let scheduleTime = now;
    let hasSound = false;

    for (let i = 0; i < notes.length; i++) {
      const durSec = (notes[i].dur * this.tickMs) / 1000;
      const freq = notes[i].freq;

      if (freq > 20 && freq < 12000) {
        hasSound = true;
        osc.frequency.setValueAtTime(freq, scheduleTime);
        gain.gain.setValueAtTime(0.12, scheduleTime);
        // tiny release at end of note for crisp separation
        gain.gain.setValueAtTime(0.10, scheduleTime + durSec - 0.003);
      } else {
        // Rest / silence
        gain.gain.setValueAtTime(0.0001, scheduleTime);
      }
      scheduleTime += durSec;
    }

    if (!hasSound) return;

    gain.gain.setValueAtTime(0, scheduleTime);
    osc.start(now);
    osc.stop(scheduleTime + 0.05);

    this.currentOsc = osc;
  }
}

window.SoundSystem = SoundSystem;
