// One AudioContext for the whole page. Browsers cap how many can exist
// concurrently, and there's no reason for the visualizer and ambient sound
// to each own a separate one — they can share the same output graph.
let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}
