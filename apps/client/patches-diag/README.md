# Diagnostic Reanimated sync-props patch (not auto-applied)

Source: [react-native-reanimated#10280](https://github.com/software-mansion/react-native-reanimated/issues/10280), fix [\#10435](https://github.com/software-mansion/react-native-reanimated/pull/10435) (shipped in **Reanimated 4.7.1**).

Do **not** copy into `patches/` for normal builds. Opt in via:

```bash
export DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1
# after pnpm install (or via package.json postinstall when env is set):
node apps/client/scripts/diag-maybe-apply-reanimated-patch.cjs
```

A full upgrade to 4.7.1 also needs Worklets **0.13.x** (compatibility table) — too invasive for this A/B; prefer the 4.5.1 surgical patch above.
