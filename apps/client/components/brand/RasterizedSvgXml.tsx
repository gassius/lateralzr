import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PixelRatio,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { parse, SvgAst } from 'react-native-svg';
import type Svg from 'react-native-svg';
import {
  buildPatternBitmapCacheKey,
  getCachedPatternBitmap,
  runPatternBitmapCapture,
} from '@/lib/patternBitmapCache';

type RasterizedSvgXmlProps = {
  xml: string;
  width: number;
  height: number;
  preserveAspectRatio?: string;
  style?: StyleProp<ImageStyle>;
};

type SvgHandle = InstanceType<typeof Svg>;

/**
 * Draw an SvgXml tree once into a PNG texture, then show a single Image.
 * Subsequent mounts with the same size+xml hit the process cache and never
 * remount RNSVG UseViews — cards animate one layer.
 */
export function RasterizedSvgXml({
  xml,
  width,
  height,
  preserveAspectRatio = 'xMidYMid slice',
  style,
}: RasterizedSvgXmlProps) {
  const pixelRatio = PixelRatio.get();
  const cacheKey = useMemo(
    () =>
      buildPatternBitmapCacheKey({
        width,
        height,
        pixelRatio,
        xml,
      }),
    [width, height, pixelRatio, xml],
  );

  const [uri, setUri] = useState<string | null>(() => getCachedPatternBitmap(cacheKey));
  const [captureFailed, setCaptureFailed] = useState(false);
  const svgRef = useRef<SvgHandle | null>(null);
  const captureStarted = useRef(false);

  const ast = useMemo(() => parse(xml), [xml]);

  useEffect(() => {
    setUri(getCachedPatternBitmap(cacheKey));
    setCaptureFailed(false);
    captureStarted.current = false;
  }, [cacheKey]);

  useEffect(() => {
    if (uri != null || captureFailed || captureStarted.current || ast == null) {
      return;
    }
    captureStarted.current = true;

    let cancelled = false;
    const pixelW = Math.max(1, Math.round(width * pixelRatio));
    const pixelH = Math.max(1, Math.round(height * pixelRatio));

    const timer = setTimeout(() => {
      const node = svgRef.current;
      if (node == null || typeof node.toDataURL !== 'function') {
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
                { width: pixelW, height: pixelH },
              );
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          }),
      )
        .then((next) => {
          if (!cancelled) setUri(next);
        })
        .catch(() => {
          if (!cancelled) setCaptureFailed(true);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ast, cacheKey, captureFailed, height, pixelRatio, uri, width]);

  if (uri != null) {
    return (
      <Image
        source={{ uri }}
        style={[{ width, height }, style]}
        resizeMode="stretch"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  // First paint / capture (or permanent fallback if capture fails): one SvgAst mount.
  return (
    <View style={[{ width, height }, style]} collapsable={false}>
      {ast != null ? (
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
      ) : null}
    </View>
  );
}
