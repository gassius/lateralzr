/**
 * Capture-effect body for RasterizedSvgXml — same guards + session the
 * component mounts in useEffect. Extracted so unit tests can "mount" the
 * effect (deps / cleanup) without a React Native renderer.
 */
import {
  estimatePatternBitmapBytes,
  resolveCapturePixelSize,
  runPatternBitmapCapture,
} from '@/lib/patternBitmapCache';
import {
  startPatternCaptureSession,
  type PatternCaptureSessionOptions,
  type PatternCaptureSvgNode,
} from '@/lib/patternCaptureSession';

export type RasterizedSvgXmlCaptureAttachOptions = {
  /** Web keeps live SVG — never schedule toDataURL / Image swap. */
  preferLiveSvg: boolean;
  captureEnabled: boolean;
  /** Live settle gate re-read when the scheduled capture runs (m1). */
  isCaptureStillEnabled: () => boolean;
  uri: string | null;
  captureFailed: boolean;
  hasAst: boolean;
  cacheKey: string;
  captureAttemptedForKey: { current: string | null };
  width: number;
  height: number;
  devicePixelRatio: number;
  getSvgNode: () => PatternCaptureSvgNode | null;
  onMissingToDataURL: () => void;
  onCaptured: (uri: string) => void;
  onError: () => void;
  schedule?: PatternCaptureSessionOptions['schedule'];
};

/**
 * Attach one capture attempt for the current effect deps. Caller must invoke
 * `cancel` on dep change / unmount (React effect cleanup).
 */
export function attachRasterizedSvgXmlCapture(
  options: RasterizedSvgXmlCaptureAttachOptions,
): { cancel: () => void } {
  if (
    options.preferLiveSvg ||
    !options.captureEnabled ||
    options.uri != null ||
    options.captureFailed ||
    !options.hasAst ||
    options.captureAttemptedForKey.current === options.cacheKey
  ) {
    return { cancel() {} };
  }

  options.captureAttemptedForKey.current = options.cacheKey;
  const capture = resolveCapturePixelSize({
    width: options.width,
    height: options.height,
    pixelRatio: options.devicePixelRatio,
  });
  const bytes = estimatePatternBitmapBytes(capture.width, capture.height);
  const cacheKey = options.cacheKey;

  return startPatternCaptureSession({
    captureEnabled: true,
    isCaptureStillEnabled: options.isCaptureStillEnabled,
    hasUri: false,
    captureFailed: false,
    getSvgNode: options.getSvgNode,
    captureWidth: capture.width,
    captureHeight: capture.height,
    runCapture: (work) => runPatternBitmapCapture(cacheKey, work, bytes),
    onMissingToDataURL: options.onMissingToDataURL,
    onCaptured: options.onCaptured,
    onError: options.onError,
    schedule: options.schedule,
  });
}
