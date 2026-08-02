import { TrackState } from '../../../../domain/TrackState';

export const useTransportControls = (
  state: TrackState,
  actions: {
    play: (id: string) => void;
    pause: (id: string) => void;
    stop: (id: string) => void;
    setLoop: (id: string, v: boolean) => void;
    setFadeIn: (id: string, v: boolean) => void;
    setFadeOut: (id: string, v: boolean) => void;
    setSeekFade: (id: string, v: boolean) => void;
    onOpenFadeSettings: () => void;
  },
  fmt: (v: number) => string,
) => ({
  playPauseIcon: state.playing ? '⏸' : '▶',
  playPauseTitle: state.playing ? 'Pause' : 'Play',
  isPlaying: state.playing,
  onPlayPauseClick: () => (state.playing ? actions.pause(state.id) : actions.play(state.id)),
  onStopClick: () => actions.stop(state.id),
  loopOn: state.loop,
  loopTitle: state.loop ? 'Disable loop' : 'Enable loop',
  onLoopClick: () => actions.setLoop(state.id, !state.loop),
  fadeInOn: state.fadeIn,
  fadeInTitle: state.fadeIn ? 'Disable fade in' : `Enable ${fmt(state.fadeInDuration)}s fade in on play`,
  onFadeInClick: () => actions.setFadeIn(state.id, !state.fadeIn),
  fadeOutOn: state.fadeOut,
  fadeOutTitle: state.fadeOut
    ? 'Disable fade out'
    : `Enable ${fmt(state.fadeOutDuration)}s fade out on stop/pause`,
  onFadeOutClick: () => actions.setFadeOut(state.id, !state.fadeOut),
  seekFadeOn: state.seekFade,
  seekFadeTitle: state.seekFade
    ? 'Disable seek fade'
    : `Enable ${fmt(state.seekFadeDuration)}s fade out/in on seek`,
  onSeekFadeClick: () => actions.setSeekFade(state.id, !state.seekFade),
  onOpenFadeSettings: actions.onOpenFadeSettings,
});
