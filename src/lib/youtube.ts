// Loads the YouTube IFrame API once and resolves when ready.
let readyPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    document.head.appendChild(tag);
  });
  return readyPromise;
}

export function waitForPlayerReady(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (window.YT && window.YT.Player) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}
