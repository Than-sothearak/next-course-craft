export function setMediaPlayback(media: HTMLMediaElement, ranges: readonly (readonly [number, number])[], currentTime: number, duration = 10) {
  Object.defineProperties(media, {
    duration: { configurable: true, value: duration },
    played: { configurable: true, value: {
      length: ranges.length,
      start: (index: number) => ranges[index][0],
      end: (index: number) => ranges[index][1],
    } satisfies TimeRanges },
  });
  media.currentTime = currentTime;
}

export function finishMediaPlayback(media: HTMLMediaElement) {
  setMediaPlayback(media, [[0, 10]], 10);
  media.dispatchEvent(new Event("timeupdate"));
  media.dispatchEvent(new Event("ended"));
}
