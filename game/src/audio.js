// audio.js — every sound is synthesized with WebAudio, so the game ships
// no audio files: soft steps, a chime for loot, a coin's tink, a rising
// siren as the alarm climbs, and a low ambient drone underneath it all.
// Nothing plays until the player first interacts (the browser insists).

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    drone: null,
    sirenOsc: null,
    sirenGain: null,
    started: false,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.startDrone();
      audio.startSiren();
      audio.started = true;
    } catch {
      audio.ctx = null;
    }
  };

  audio.startDrone = () => {
    const ctx = audio.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 55.7;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(audio.master);
    oscA.start();
    oscB.start();
    lfo.start();
    audio.drone = { oscA, oscB, lfo, gain };
  };

  audio.startSiren = () => {
    const ctx = audio.ctx;
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sawtooth';
    audio.sirenOsc.frequency.value = 620;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    audio.sirenOsc.connect(filter);
    filter.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  };

  // The siren follows the alarm: silent while calm, wailing at lockdown.
  audio.setAlarm = (level) => {
    if (!audio.ctx || !audio.sirenGain) return;
    const t = audio.ctx.currentTime;
    const target = level >= 100 ? 0.085 : level > 40 ? 0.02 + (level - 40) * 0.0006 : 0;
    audio.sirenGain.gain.setTargetAtTime(target, t, 0.2);
    audio.sirenOsc.frequency.setTargetAtTime(620 + level * 2.4, t, 0.2);
  };

  audio.blip = (freq, dur, type, vol, when = 0) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  audio.noise = (dur, vol, filterFreq) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  };

  audio.play = (event) => {
    if (!audio.ctx || audio.muted) return;
    switch (event.type) {
      case 'step':
        audio.noise(0.05, event.quiet ? 0.03 : 0.06, 500);
        break;
      case 'coin-pickup':
        audio.blip(1320, 0.12, 'sine', 0.12);
        audio.blip(1760, 0.14, 'sine', 0.1, 0.06);
        break;
      case 'loot':
        audio.blip(880, 0.14, 'triangle', 0.16);
        audio.blip(1174, 0.16, 'triangle', 0.16, 0.08);
        audio.blip(1568, 0.22, 'triangle', 0.14, 0.16);
        break;
      case 'coin-thrown':
        audio.noise(0.08, 0.1, 3000);
        break;
      case 'coin-landed':
        audio.blip(2093, 0.1, 'sine', 0.14);
        audio.blip(1568, 0.12, 'sine', 0.1, 0.05);
        break;
      case 'smoke':
        audio.noise(0.5, 0.16, 400);
        break;
      case 'emp':
        audio.blip(220, 0.5, 'sawtooth', 0.1);
        audio.blip(110, 0.6, 'sawtooth', 0.1, 0.1);
        break;
      case 'all-loot':
        audio.blip(1046, 0.16, 'triangle', 0.16);
        audio.blip(1318, 0.16, 'triangle', 0.16, 0.1);
        audio.blip(1568, 0.3, 'triangle', 0.18, 0.2);
        break;
      case 'lockdown':
        audio.blip(440, 0.4, 'sawtooth', 0.16);
        audio.blip(415, 0.4, 'sawtooth', 0.16, 0.15);
        break;
      case 'laser':
        audio.blip(1800, 0.08, 'square', 0.05);
        break;
      case 'startled':
        audio.blip(330, 0.25, 'sawtooth', 0.14);
        break;
      case 'caught':
        audio.blip(220, 0.5, 'sawtooth', 0.2);
        audio.blip(175, 0.7, 'sawtooth', 0.2, 0.2);
        break;
      case 'level-clear':
        [523, 659, 784, 1046].forEach((f, i) => audio.blip(f, 0.24, 'triangle', 0.16, i * 0.11));
        break;
      case 'win':
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => audio.blip(f, 0.3, 'triangle', 0.16, i * 0.12));
        break;
      default:
        break;
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
