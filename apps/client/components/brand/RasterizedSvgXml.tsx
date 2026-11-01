import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PixelRatio,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { parse, SvgAst } from 'react-native-svg';
import type Svg from 'react-native-svg';
import {
  buildPatternBitmapCacheKey,
  estimatePatternBitmapBytes,
  peekCachedPatternBitmap,
  resolveCapturePixelSize,
  runPatternBitmapCapture,
} from '@/lib/patternBitmapCache';
import { startPatternCaptureSession } from '@/lib/patternCaptureSession';
import {
  resolveRasterizedSvgXmlLayers,
  uriForCacheKey,
} from '@/lib/rasterizedSvgXmlState';

type RasterizedSvgXmlProps = {
  xml: string;
  width: number;
  height: number;
  preserveAspectRatio?: string;
  style?: StyleProp<ImageStyle>;
  /**
   * Must be a real deck-settled signal (e.g. !pulseDragging from the stack).
   * When false, toDataURL never runs — swipe cannot rasterise on the UI thread.
   * Idle + upcoming underlay cards set this true to pre-capture before show.
   */
  captureEnabled: boolean;
};

type SvgHandle = InstanceType<typeof Svg>;

/**
 * Draw an SvgXml tree once into a PNG texture, then show a single Image.
 * SVG stays mounted under the Image until onLoad (no blank flash). Capture
 * only when `captureEnabled` (deck settled) — never mid-swipe.
 */
export function RasterizedSvgXml({
  xml,
  width,
  height,
  preserveAspectRatio = 'xMidYMid slice',
  style,
  captureEnabled,
}: RasterizedSvgXmlProps) {
  const devicePixelRatio = PixelRatio.get();
  const cacheKey = useMemo(
    () =>
      buildPatternBitmapCacheKey({
        width,
        height,
        pixelRatio: devicePixelRatio,
        xml,
        preserveAspectRatio,
      }),
    [width, height, devicePixelRatio, xml, preserveAspectRatio],
  );

  const peekedUri = peekCachedPatternBitmap(cacheKey);
  const [sessionCapture, setSessionCapture] = useState<{
    cacheKey: string;
    uri: string;
  } | null>(null);
  const [loadedCacheKey, setLoadedCacheKey] = useState<string | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  const svgRef = useRef<SvgHandle | null>(null);
  const captureAttemptedForKey = useRef<string | null>(null);

  const uri = uriForCacheKey(cacheKey, peekedUri, sessionCapture);
  const layers = resolveRasterizedSvgXmlLayers({
    cacheKey,
    uri,
    loadedCacheKey,
    captureFailed,
  });

  const ast = useMemo(() => parse(xml), [xml]);

  useEffect(() => {
    setCaptureFailed(false);
    captureAttemptedForKey.current = null;
  }, [cacheKey]);

  useEffect(() => {
    if (
      !captureEnabled ||
      uri != null ||
      captureFailed ||
      ast == null ||
      captureAttemptedForKey.current === cacheKey
    ) {
      return;
    }

    captureAttemptedForKey.current = cacheKey;
    const capture = resolveCapturePixelSize({
      width,
      height,
      pixelRatio: devicePixelRatio,
    });
    const bytes = estimatePatternBitmapBytes(capture.width, capture.height);

    const session = startPatternCaptureSession({
      captureEnabled: true,
      hasUri: false,
      captureFailed: false,
      getSvgNode: () => svgRef.current,
      captureWidth: capture.width,
      captureHeight: capture.height,
      runCapture: (work) => runPatternBitmapCapture(cacheKey, work, bytes),
      onMissingToDataURL: () => setCaptureFailed(true),
      onCaptured: (next) => setSessionCapture({ cacheKey, uri: next }),
      onError: () => setCaptureFailed(true),
    });

    return () => {
      session.cancel();
    };
  }, [
    ast,
    cacheKey,
    captureEnabled,
    captureFailed,
    devicePixelRatio,
    height,
    uri,
    width,
  ]);

  return (
    <View style={[{ width, height }, style]} collapsable={false}>
      {layers.showSvg && ast != null ? (
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <SvgAst
            ast={ast}
            override={{
              width,
              height,
              preserveAspectRatio,
              ref: (node: SvgHandle | null) => {
                svgRef.current = node;
              },
            }}
          />
        </View>
      ) : null}
      {layers.showImage && layers.imageUri != null ? (
        <Image
          key={cacheKey}
          source={{ uri: layers.imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => {
            setLoadedCacheKey(cacheKey);
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  );
}
