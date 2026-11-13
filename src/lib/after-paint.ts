/** Yield two animation frames, then start bounded, cancellable background work. */
export function afterPaint(work: () => void): () => void {
  let cancelled = false;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => { if (!cancelled) work(); };
  if (typeof requestAnimationFrame === 'function' && document.visibilityState !== 'hidden') {
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { timer = setTimeout(run, 150); });
    });
  } else {
    timer = setTimeout(run, 150);
  }
  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
}