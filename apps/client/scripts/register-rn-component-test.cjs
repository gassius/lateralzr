/**
 * Node/tsx harness for mounting RN components with RNTL / react-test-renderer.
 * Mocks `react-native` + `react-native-svg` so RasterizedSvgXml can mount
 * without Metro. Also loads the audio-asset register used by unit tests.
 */
'use strict';

require('./register-audio-assets.cjs');

const Module = require('module');
const React = require('react');
const originalLoad = Module._load;

const AbsoluteFill = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

function host(name) {
  return React.forwardRef(function Host(props, ref) {
    return React.createElement(name, { ...props, ref });
  });
}

const View = host('View');

const Image = React.forwardRef(function MockImage(props, ref) {
  React.useEffect(() => {
    // Mimic async decode completing so RasterizedSvgXml can drop SvgAst.
    if (typeof props.onLoad === 'function') {
      props.onLoad({ nativeEvent: {} });
    }
  }, [props.source?.uri, props.onLoad]);
  return React.createElement('Image', { ...props, ref });
});

/** Captured by SvgAst ref so tests / capture can call toDataURL. */
const mockSvgHandles = {
  toDataURLImpl: null,
  callCount: 0,
};

function SvgAst(props) {
  const override = props.override || {};
  React.useEffect(() => {
    const handle = {
      toDataURL(cb, _opts) {
        mockSvgHandles.callCount += 1;
        if (typeof mockSvgHandles.toDataURLImpl === 'function') {
          mockSvgHandles.toDataURLImpl(cb, _opts);
          return;
        }
        // Minimal valid base64 for a 1×1 PNG.
        cb(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        );
      },
    };
    if (typeof override.ref === 'function') {
      override.ref(handle);
    }
    return () => {
      if (typeof override.ref === 'function') {
        override.ref(null);
      }
    };
  }, [override.ref]);
  return React.createElement('SvgAst', {
    width: override.width,
    height: override.height,
  });
}

const reactNativeMock = {
  Platform: { OS: 'ios', select: (spec) => spec.ios ?? spec.default },
  PixelRatio: { get: () => 2 },
  StyleSheet: {
    absoluteFill: AbsoluteFill,
    absoluteFillObject: AbsoluteFill,
    create: (styles) => styles,
    flatten: (style) => style,
  },
  View,
  Image,
  Text: host('Text'),
};

const reactNativeSvgMock = {
  parse: (xml) => ({ type: 'svg', xml }),
  SvgAst,
  default: host('Svg'),
};

Module._load = function load(request, parent, isMain) {
  if (request === 'react-native') {
    return reactNativeMock;
  }
  if (request === 'react-native-svg') {
    return reactNativeSvgMock;
  }
  return originalLoad(request, parent, isMain);
};

globalThis.__rasterizedSvgXmlTestMocks = mockSvgHandles;
