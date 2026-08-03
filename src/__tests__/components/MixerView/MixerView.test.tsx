import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/renderer/components/MixerView/ChannelStrip', () => ({
  ChannelStrip: ({ track }: { track: { state: { id: string; title: string } } }) => (
    <div data-testid="channel-strip">{track.state.title}</div>
  ),
}));

import { MixerView } from '@/renderer/components/MixerView/MixerView';
import { TrackEntry } from '@/renderer/context/audioContextInstance';

describe('MixerView', () => {
  afterEach(() => cleanup());

  const track = (id: string, title: string): TrackEntry =>
    ({
      state: { id, title },
      filePath: `/tmp/${id}.wav`,
      x: 0,
      y: 0,
    }) as unknown as TrackEntry;

  it('renders an empty rack when there are no tracks', () => {
    render(<MixerView tracks={[]} />);

    expect(screen.queryAllByTestId('channel-strip')).toHaveLength(0);
  });

  it('renders one ChannelStrip per track, preserving array order', () => {
    render(<MixerView tracks={[track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')]} />);

    const strips = screen.getAllByTestId('channel-strip');
    expect(strips.map((s) => s.textContent)).toEqual(['Vocals', 'Bass', 'Drums']);
  });
});
