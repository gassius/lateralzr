import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startPatternCaptureSession } from './patternCaptureSession.ts';

describe('startPatternCaptureSession (component cancel / web path)', () => {
  it('cancel before scheduled run prevents toDataURL (key-change path)', async () => {
    let ran = false;
    let scheduledRun: (() => void) | undefined;
    let cancelled = false;
    const session = startPatternCaptureSession({
      captureEnabled: true,
      hasUri: false,
      captureFailed: false,
      getSvgNode: () => ({
        toDataURL(cb) {
          ran = true;
          cb('abc');
        },
      }),
      captureWidth: 10,
      captureHeight: 10,
      runCapture: (work) => work(),
      onMissingToDataURL: () => {
        assert.fail('should not miss');
      },
      onCaptured: () => {
        assert.fail('should not capture after cancel');
      },
      onError: () => {
        assert.fail('should not error after cancel');
      },
      schedule: (run) => {
        scheduledRun = run;
        return {
          cancel() {
            cancelled = true;
          },
        };
      },
    });
    session.cancel();
    assert.equal(cancelled, true);
    scheduledRun?.();
    await Promise.resolve();
    assert.equal(ran, false);
  });

  it('missing toDataURL is a terminal web fallback (onMissingToDataURL once)', () => {
    let missing = 0;
    let scheduledRun: (() => void) | undefined;
    startPatternCaptureSession({
      captureEnabled: true,
      hasUri: false,
      captureFailed: false,
      getSvgNode: () => ({}),
      captureWidth: 10,
      captureHeight: 10,
      runCapture: (work) => work(),
      onMissingToDataURL: () => {
        missing += 1;
      },
      onCaptured: () => {
        assert.fail('no capture on web');
      },
      onError: () => {
        assert.fail('no error path');
      },
      schedule: (run) => {
        scheduledRun = run;
        return { cancel() {} };
      },
    });
    scheduledRun?.();
    assert.equal(missing, 1);
  });

  it('does not schedule when captureEnabled is false (swipe gate)', () => {
    let scheduled = false;
    startPatternCaptureSession({
      captureEnabled: false,
      hasUri: false,
      captureFailed: false,
      getSvgNode: () => ({
        toDataURL(cb) {
          cb('x');
        },
      }),
      captureWidth: 10,
      captureHeight: 10,
      runCapture: (work) => work(),
      onMissingToDataURL: () => {},
      onCaptured: () => {},
      onError: () => {},
      schedule: (run) => {
        scheduled = true;
        run();
        return { cancel() {} };
      },
    });
    assert.equal(scheduled, false);
  });
});
