/**
 * Wrap an AccessibilityInfo announcement so reshuffle SFX stay quiet (Sound 7).
 * Sound 5 wires DeckStatusLine through this; Sound 7 supplies real begin/end.
 */

export function runAccessibilityAnnounce(
  message: string,
  deps: {
    announce: (message: string) => void;
    begin: () => void;
    end: () => void;
  },
): () => void {
  deps.begin();
  deps.announce(message);
  return () => {
    deps.end();
  };
}
