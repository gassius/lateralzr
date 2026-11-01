#!/usr/bin/env node
/**
 * Opt-in diagnostic patch for Reanimated 4.5.1 on RN 0.86:
 * skip MountingManager.updatePropsSynchronously when getViewExists is false,
 * and log a one-line warning (no full stack) on reflection failure.
 *
 * Mirrors software-mansion/react-native-reanimated#10435 / issue #10280.
 *
 * Enable by exporting DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1 before
 * this script runs (survives ~/builds/build-apk.sh force-checkout).
 * Default: no-op so production behaviour is unchanged.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function optedIn(raw) {
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

if (!optedIn(process.env.DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH)) {
  process.exit(0);
}

const clientRoot = path.resolve(__dirname, '..');
const candidates = [];

function walk(dir, depth) {
  // pnpm nests under node_modules/.pnpm/<pkg>/node_modules/... — allow deep walks.
  if (depth > 24 || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (
        ent.name === '.git' ||
        ent.name === 'dist' ||
        ent.name === 'ios' ||
        ent.name === 'windows' ||
        ent.name === 'scripts' ||
        ent.name === 'Common' ||
        ent.name === 'apple'
      ) {
        continue;
      }
      walk(full, depth + 1);
    } else if (
      ent.name === 'NativeProxy.kt' &&
      full.includes(`${path.sep}reanimated${path.sep}`)
    ) {
      candidates.push(full);
    }
  }
}

const searchRoots = [
  path.join(clientRoot, 'node_modules', 'react-native-reanimated'),
  path.join(clientRoot, '..', '..', 'node_modules', 'react-native-reanimated'),
  path.join(clientRoot, 'node_modules', '.pnpm'),
  path.join(clientRoot, '..', '..', 'node_modules', '.pnpm'),
];
for (const root of searchRoots) {
  walk(root, 0);
}

const unique = [...new Set(candidates)].filter((p) =>
  p.includes(`${path.sep}react-native-reanimated${path.sep}`),
);

if (unique.length === 0) {
  console.error(
    '[diag-reanimated-patch] NativeProxy.kt not found under node_modules; install deps first.',
  );
  process.exit(1);
}

const NEEDLE = [
  '    private val updatePropsSynchronouslyMethod by lazy {',
  '        mountingManager.javaClass.methods',
  '            .first {',
  '                it.name.startsWith("updatePropsSynchronously") && it.parameterTypes.size == 2',
  '            }.apply { isAccessible = true }',
  '    }',
  '',
  '    @DoNotStrip',
  '    fun synchronouslyUpdateUIProps(',
  '        intBuffer: IntArray,',
  '        doubleBuffer: DoubleArray,',
  '    ) {',
  '        SynchronousPropsBufferParser.parse(intBuffer, doubleBuffer) { viewTag, props ->',
  '            if (BuildConfig.IS_REACT_NATIVE_86_OR_NEWER) {',
  '                try {',
  '                    updatePropsSynchronouslyMethod.invoke(mountingManager, viewTag, props)',
  '                } catch (e: Exception) {',
  '                    Log.w("Reanimated", "synchronouslyUpdateUIProps failed for tag $viewTag", e)',
  '                }',
  '            } else {',
  '                mFabricUIManager.synchronouslyUpdateViewOnUIThread(viewTag, props)',
  '            }',
  '        }',
  '    }',
].join('\n');

const REPLACEMENT = [
  '    private val updatePropsSynchronouslyMethod by lazy {',
  '        mountingManager.javaClass.methods',
  '            .first {',
  '                it.name.startsWith("updatePropsSynchronously") && it.parameterTypes.size == 2',
  '            }.apply { isAccessible = true }',
  '    }',
  '',
  '    // DIAG (1amjtrex67j): getViewExists guard — Reanimated #10435 / #10280',
  '    private val getViewExistsMethod by lazy {',
  '        runCatching {',
  '            mountingManager.javaClass.getMethod("getViewExists", Int::class.javaPrimitiveType)',
  '        }.getOrNull()',
  '    }',
  '',
  '    @DoNotStrip',
  '    fun synchronouslyUpdateUIProps(',
  '        intBuffer: IntArray,',
  '        doubleBuffer: DoubleArray,',
  '    ) {',
  '        SynchronousPropsBufferParser.parse(intBuffer, doubleBuffer) { viewTag, props ->',
  '            if (BuildConfig.IS_REACT_NATIVE_86_OR_NEWER) {',
  '                try {',
  '                    if (getViewExistsMethod?.invoke(mountingManager, viewTag) == false) {',
  '                        return@parse',
  '                    }',
  '                    updatePropsSynchronouslyMethod.invoke(mountingManager, viewTag, props)',
  '                } catch (e: Exception) {',
  '                    Log.w(',
  '                        "Reanimated",',
  '                        "synchronouslyUpdateUIProps failed for tag $viewTag: ${e.cause ?: e}",',
  '                    )',
  '                }',
  '            } else {',
  '                mFabricUIManager.synchronouslyUpdateViewOnUIThread(viewTag, props)',
  '            }',
  '        }',
  '    }',
].join('\n');

let patched = 0;
let already = 0;
for (const file of unique) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('DIAG (1amjtrex67j): getViewExists guard')) {
    already += 1;
    continue;
  }
  if (!src.includes(NEEDLE)) {
    console.error(`[diag-reanimated-patch] unexpected NativeProxy.kt shape at ${file}`);
    process.exit(1);
  }
  fs.writeFileSync(file, src.replace(NEEDLE, REPLACEMENT));
  patched += 1;
  console.log(`[diag-reanimated-patch] patched ${file}`);
}

console.log(
  `[diag-reanimated-patch] done (patched=${patched}, already=${already}, files=${unique.length})`,
);
