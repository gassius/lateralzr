/**
 * Node/tsx unit tests cannot parse binary `.m4a` as JS modules.
 * Register a stable numeric export so `require('…m4a')` mirrors Metro's
 * asset module id shape used by `lib/soundAssets.ts`.
 */
'use strict';

const Module = require('module');

let nextId = 900_000;
const cache = new Map();

function register(ext) {
  Module._extensions[ext] = function registerAudioAsset(module, filename) {
    if (!cache.has(filename)) {
      cache.set(filename, nextId);
      nextId += 1;
    }
    module.exports = cache.get(filename);
  };
}

register('.m4a');
