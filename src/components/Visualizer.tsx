import { useEffect, useRef, type RefObject } from 'react';
import { getAudioContext } from '../lib/audioContext';


// The Web Audio API throws if you call createMediaElementSource() more than
// once on the same <audio> element (e.g. React StrictMode's double-invoke
// in dev, or this component remounting while the element persists). Track
// per-element wiring here so re-mounts safely reuse the existing analyser
// instead of erroring or creating a duplicate audio graph.
const wired = new WeakMap<HTMLMediaElement, AnalyserNode>();

function connect(el: HTMLMediaElement): AnalyserNode | null {
  const existing = wired.get(el);
  if (existing) return existing;
  try {
    const ctx = getAudioContext();
    const source = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    // Route through the analyser and back out to speakers — without this
    // second connection, wiring up the analyser would silence playback.
    source.connect(analyser);
    analyser.connect(ctx.destination);
    wired.set(el, analyser);
    return analyser;
  } catch {
    // Cross-origin audio without permissive CORS headers, or an
    // already-tainted element, will land here. Bars just fall back to a
    // flat idle look in that case — playback itself is unaffected.
    return null;
  }
}

/**
 * Real audio-reactive visualizer for direct <audio> playback, driven by an
 * AnalyserNode reading actual frequency data off the element.
 */
export function AudioBars({ audioRef, playing }: { audioRef: RefObject<HTMLAudioElement>; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const analyser = connect(el);
    analyserRef.current = analyser;
    dataRef.current = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  }, [audioRef]);

  useEffect(() => {
    if (playing) getAudioContext().resume().catch(() => {});
  }, [playing]);

  useEffect(() => {
    let raf: number;
    const barCount = 28;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      const data = dataRef.current;
      const c = canvas?.getContext('2d');
      if (canvas && c) {
        const w = canvas.width;
        const h = canvas.height;
        c.clearRect(0, 0, w, h);
        if (analyser && data && playing) analyser.getByteFrequencyData(data);
        const barW = w / barCount;
        for (let i = 0; i < barCount; i++) {
          let v = 5;
          if (analyser && data && playing) {
            const idx = Math.floor((i / barCount) * data.length);
            v = Math.max(4, (data[idx] / 255) * h);
          }
          const x = i * barW;
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(x + barW * 0.18, h - v, barW * 0.64, v);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return <canvas ref={canvasRef} width={320} height={72} className="w-full max-w-xs h-16" aria-hidden="true" />;
}

/**
 * Decorative bar animation for YouTube tracks. NOT audio-reactive — the
 * YouTube IFrame API doesn't expose raw audio, so this is a smooth looping
 * animation (layered sine waves per bar) that just reflects play/pause
 * state, sitting below the video rather than pretending to analyze it.
 */
export function DecorativeBars({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf: number;
    const barCount = 28;
    const start = performance.now();
    const draw = (t: number) => {
      const canvas = canvasRef.current;
      const c = canvas?.getContext('2d');
      if (canvas && c) {
        const w = canvas.width;
        const h = canvas.height;
        c.clearRect(0, 0, w, h);
        const elapsed = (t - start) / 1000;
        const barW = w / barCount;
        for (let i = 0; i < barCount; i++) {
          let v = 4;
          if (playing) {
            const phase = i * 0.7;
            const speed = 2.1 + (i % 5) * 0.32;
            const wave = (Math.sin(elapsed * speed + phase) + 1) / 2;
            const wave2 = (Math.sin(elapsed * speed * 1.6 + phase * 1.3) + 1) / 2;
            v = 4 + (wave * 0.6 + wave2 * 0.4) * (h - 6);
          }
          const x = i * barW;
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.fillRect(x + barW * 0.18, h - v, barW * 0.64, v);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return <canvas ref={canvasRef} width={320} height={40} className="w-full h-10" aria-hidden="true" />;
}
