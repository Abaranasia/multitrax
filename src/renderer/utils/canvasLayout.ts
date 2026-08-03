// Reserved vertical space so cards clear both the SessionMenu and RecorderBar top buttons.
export const TOP_INSET = 90;
// Left starting margin, matching today's cascade start.
export const SIDE_INSET = 20;
// Must stay in sync with `.track-player`'s width in TrackPlayer.css.
export const TRACK_CARD_WIDTH = 380;
// Card height is dynamic (content-driven); this is just a spacing approximation for the
// grid layout, not an enforced height.
export const TRACK_CARD_HEIGHT = 260;
export const GRID_GAP = 20;

export function computeGridPositions(
  count: number,
  viewportWidth: number,
): { x: number; y: number }[] {
  const columns = Math.max(
    1,
    Math.floor((viewportWidth - SIDE_INSET * 2 + GRID_GAP) / (TRACK_CARD_WIDTH + GRID_GAP)),
  );

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    positions.push({
      x: SIDE_INSET + col * (TRACK_CARD_WIDTH + GRID_GAP),
      y: TOP_INSET + row * (TRACK_CARD_HEIGHT + GRID_GAP),
    });
  }

  return positions;
}
