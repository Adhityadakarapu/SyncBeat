import { getAudioContext } from './audioContext';

// Not real recorded ambience (rain, cafe, forest, etc.) — there's no way to
// fetch audio assets in this environment. This is a soft synthesized pad
// per theme: a couple of detuned oscillators through a slowly-modulated
// lowpass filter, with a filtered noise layer for Forest to suggest a
// gentle breeze without using any sourced sample.
interface ThemeAmbientConfig {
  freqs: number[];
  type: OscillatorType;
  filterHz: number;
  lfoRate: number;
  useNoise?: boolean;
}

const THEME_CONFIG: Record<string, ThemeAmbientConfig> = {
  classic: { freqs: [110, 165], type: 'sine', filterHz: 900, lfoRate: 0.05 },
  night: { freqs: [82, 123], type: 'sine', filterHz: 500, lfoRate: 0.03 },
  sunset: { freqs: [130.8, 196], type: 'triangle', filterHz: 1200, lfoRate: 0.08 },
  neon: { freqs: [146.8, 220], type: 'sawtooth', filterHz: 1800, lfoRate: 0.15 },
  forest: { freqs: [98, 147], type: 'sine', filterHz: 700, lfoRate: 0.04, useNoise: true },
};

interface AmbientVoice {
  master: GainNode;
  nodes: AudioNode[];
}

let voice: AmbientVoice | null = null;
let activeTheme: string | null = null;

function buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function startAmbient(themeId: string, volume = 0.1) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  if (voice && activeTheme === themeId) {
    voice.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.5);
    return;
  }
  stopAmbient();

  const cfg = THEME_CONFIG[themeId] ?? THEME_CONFIG.classic;
  const nodes: AudioNode[] = [];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cfg.filterHz;
  filter.connect(master);
  nodes.push(filter);

  cfg.freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = cfg.type;
    osc.frequency.value = freq;
    osc.detune.value = i === 0 ? -4 : 4;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.5;
    osc.connect(oscGain);
    oscGain.connect(filter);
    osc.start();
    nodes.push(osc, oscGain);
  });

  // Slow LFO on the filter cutoff so the pad breathes instead of sitting static.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = cfg.lfoRate;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = cfg.filterHz * 0.3;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
  nodes.push(lfo, lfoGain);

  if (cfg.useNoise) {
    const noise = ctx.createBufferSource();
    noise.buffer = buildNoiseBuffer(ctx);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    nodes.push(noise, noiseFilter, noiseGain);
  }

  voice = { master, nodes };
  activeTheme = themeId;
}

export function stopAmbient() {
  if (!voice) return;
  const ctx = getAudioContext();
  const { master, nodes } = voice;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  window.setTimeout(() => {
    nodes.forEach((n) => {
      try {
        (n as { stop?: () => void }).stop?.();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    });
    try {
      master.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 900);
  voice = null;
  activeTheme = null;
}
