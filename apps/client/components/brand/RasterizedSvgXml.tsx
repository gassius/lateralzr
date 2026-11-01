import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  InteractionManager,
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
   * When false, never call toDataURL (keep SvgAst). Defaults true; callers can
   * gate this if they have a stronger idle signal. Capture itself always waits
   * for InteractionManager.runAfterInteractions so a swipe never rasterises.
   */
  captureEnabled?: boolean;
};

type SvgHandle = InstanceType<typeof Svg>;

/**
 * Draw an SvgXml tree once into a PNG texture, then show a single Image.
 * SVG stays mounted under the Image until onLoad (no blank flash). Capture
 * runs only after interactions idle — never mid-swipe.
 */
export function RasterizedSvgXml({
  xml,
  width,
  height,
  preserveAspectRatio = 'xMidYMid slice',
  style,
  captureEnabled = true,
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

  // Reset failure / attempt bookkeeping when the visual key changes.
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

    let cancelled = false;
    captureAttemptedForKey.current = cacheKey;

    const capture = resolveCapturePixelSize({
      width,
      height,
      pixelRatio: devicePixelRatio,
    });
    const bytes = estimatePatternBitmapBytes(capture.width, capture.height);

    // B2: never rasterise on the gesture path — wait until interactions settle.
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const node = svgRef.current;
      if (node == null || typeof node.toDataURL !== 'function') {
        // Web / missing native module: stay on SVG, do not retry-loop.
        setCaptureFailed(true);
        return;
      }
      void runPatternBitmapCapture(
        cacheKey,
        () =>
          new Promise<string>((resolve, reject) => {
            try {
              node.toDataURL(
                (base64) => {
                  if (!base64) {
                    reject(new Error('empty toDataURL'));
                    return;
                  }
                  resolve(`data:image/png;base64,${base64}`);
                },
                { width: capture.width, height: capture.height },
              );
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          }),
        bytes,
      )
        .then((next) => {
          if (cancelled) return;
          setSessionCapture({ cacheKey, uri: next });
        })
        .catch(() => {
          if (!cancelled) setCaptureFailed(true);
        });
    });

    return () => {
      cancelled = true;
      if (typeof task.cancel === 'function') {
        task.cancel();
      }
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
