/**
 * Non-fatal sound error logging — never silent-drop caught audio errors.
 * Tests may mock `console.warn`.
 */
export function soundWarn(context: string, err?: unknown): void {
  try {
    if (err === undefined) {
      console.warn(`[sound] ${context}`);
    } else {
      console.warn(`[sound] ${context}`, err);
    }
  } catch {
    // Logging must never throw into the audio path.
  }
}
