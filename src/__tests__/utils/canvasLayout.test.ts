import { describe, expect, it } from 'vitest';
import {
  computeGridPositions,
  SIDE_INSET,
  TOP_INSET,
  TRACK_CARD_WIDTH,
  TRACK_CARD_HEIGHT,
  GRID_GAP,
} from '@/renderer/utils/canvasLayout';

describe('computeGridPositions', () => {
  it('returns an empty array when count is 0', () => {
    expect(computeGridPositions(0, 1920)).toEqual([]);
  });

  it('returns exactly `count` positions', () => {
    const positions = computeGridPositions(5, 1920);
    expect(positions).toHaveLength(5);
  });

  it('never places a card above TOP_INSET or left of SIDE_INSET', () => {
    const positions = computeGridPositions(10, 1920);
    for (const { x, y } of positions) {
      expect(y).toBeGreaterThanOrEqual(TOP_INSET);
      expect(x).toBeGreaterThanOrEqual(SIDE_INSET);
    }
  });

  it('wraps every item to a new row when the viewport only fits one column', () => {
    const viewportWidth = SIDE_INSET * 2 + TRACK_CARD_WIDTH;
    const positions = computeGridPositions(4, viewportWidth);

    expect(positions.map((p) => p.x)).toEqual([SIDE_INSET, SIDE_INSET, SIDE_INSET, SIDE_INSET]);

    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].y).toBeGreaterThan(positions[i - 1].y);
    }
    expect(positions.map((p) => p.y)).toEqual([
      TOP_INSET,
      TOP_INSET + (TRACK_CARD_HEIGHT + GRID_GAP),
      TOP_INSET + 2 * (TRACK_CARD_HEIGHT + GRID_GAP),
      TOP_INSET + 3 * (TRACK_CARD_HEIGHT + GRID_GAP),
    ]);
  });

  it('fits multiple columns in the same row before wrapping on a wide viewport', () => {
    const viewportWidth = SIDE_INSET * 2 + 3 * TRACK_CARD_WIDTH + 2 * GRID_GAP;
    const positions = computeGridPositions(3, viewportWidth);

    expect(positions.every((p) => p.y === TOP_INSET)).toBe(true);
    expect(positions.map((p) => p.x)).toEqual([
      SIDE_INSET,
      SIDE_INSET + (TRACK_CARD_WIDTH + GRID_GAP),
      SIDE_INSET + 2 * (TRACK_CARD_WIDTH + GRID_GAP),
    ]);
  });
});
