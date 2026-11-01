/**
 * Pattern raster capture session — same cancel / web-fallback path the
 * RasterizedSvgXml effect uses. Extracted so tests exercise the real cancel
 * contract (not only the display-layer helper).
 */

export type PatternCaptureSvgNode = {
  toDataURL?: (
    callback: (base64: string) => void,
    options?: object,
  ) => void;
};

export type PatternCaptureSessionOptions = {
  /** Real deck-settled gate (not InteractionManager). */
  captureEnabled: boolean;
  /**
   * Re-read when the scheduled callback fires. Pan `onStart` → React re-render
   * can land after schedule() but before this run; without a second check the
   * capture overlaps the swipe. Cancel drops late results but cannot abort an
   * already-running toDataURL — this gate skips starting it.
   */
  isCaptureStillEnabled?: () => boolean;
  hasUri: boolean;
  captureFailed: boolean;
  getSvgNode: () => PatternCaptureSvgNode | null;
  /** Pixel size passed to toDataURL. */
  captureWidth: number;
  captureHeight: number;
  runCapture: (work: () => Promise<string>) => Promise<string>;
  onMissingToDataURL: () => void;
  onCaptured: (uri: string) => void;
  onError: () => void;
  /** Inject for tests; defaults to setTimeout(0). */
  schedule?: (run: () => void) => { cancel: () => void };
};

function defaultSchedule(run: () => void): { cancel: () => void } {
  const id = setTimeout(run, 0);
  return {
    cancel() {
      clearTimeout(id);
    },
  };
}

/**
 * Start one capture attempt. Caller must invoke `cancel` on key change /
 * unmount / captureEnabled→false so mid-swipe work never lands.
 */
export function startPatternCaptureSession(
  options: PatternCaptureSessionOptions,
): { cancel: () => void } {
  if (options.captureEnabled !== true || options.hasUri || options.captureFailed) {
    return { cancel() {} };
  }

  let cancelled = false;
  const schedule = options.schedule ?? defaultSchedule;
  const handle = schedule(() => {
    if (cancelled) return;
    // m1: settle may have flipped false between schedule and run (pan start).
    if (options.isCaptureStillEnabled?.() === false) {
      return;
    }
    const node = options.getSvgNode();
    if (node == null || typeof node.toDataURL !== 'function') {
      options.onMissingToDataURL();
      return;
    }
    void options
      .runCapture(
        () =>
          new Promise<string>((resolve, reject) => {
            try {
              node.toDataURL!(
                (base64) => {
                  if (!base64) {
                    reject(new Error('empty toDataURL'));
                    return;
                  }
                  resolve(`data:image/png;base64,${base64}`);
                },
                { width: options.captureWidth, height: options.captureHeight },
              );
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          }),
      )
      .then((uri) => {
        if (!cancelled) options.onCaptured(uri);
      })
      .catch(() => {
        if (!cancelled) options.onError();
      });
  });

  return {
    cancel() {
      cancelled = true;
      handle.cancel();
    },
  };
}
