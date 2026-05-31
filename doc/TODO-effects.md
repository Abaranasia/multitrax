# Audio Effects — Future Development TODO

Effects to be added per-track in `AudioEngine.ts`.  
Integration point: `SourceNode → GainNode → [effects chain] → masterGain`.  
Each effect node should be stored in `TrackNodes` and exposed via the standard
`TrackState` + setter pattern already used for volume and fades.

---

## Native Web Audio API (no extra dependencies)

- [ ] **Equalizer** — `BiquadFilterNode`; 8 filter types (`lowpass`, `highpass`,
  `bandpass`, `lowshelf`, `highshelf`, `peaking`, `notch`, `allpass`);
  chain multiple nodes for a parametric EQ.

- [ ] **Compressor / Limiter** — `DynamicsCompressorNode`; params: threshold,
  knee, ratio, attack, release; doubles as a master limiter at gain=1.

- [ ] **Stereo Pan** — `StereoPannerNode`; range -1 (full left) to +1 (full
  right); straightforward drop-in before `masterGain`.

- [ ] **3-D Spatial Audio** — `PannerNode` with HRTF model; full x/y/z position
  and orientation control; useful for immersive mixing.

- [ ] **Reverb / Convolution** — `ConvolverNode`; loads an impulse-response WAV
  as an `AudioBuffer`; free IR libraries widely available online.

- [ ] **Delay / Echo** — `DelayNode` (up to 180 s); add a feedback `GainNode`
  looped back into the delay input for classic echo.

- [ ] **Distortion / Saturation** — `WaveShaperNode`; apply an arbitrary
  waveshaping curve; covers soft-clip, overdrive, and bit-crush.

- [ ] **Playback Rate** — `AudioBufferSourceNode.playbackRate` (already present
  on every source node); changes speed and pitch together.

- [ ] **Waveform / Spectrum Analyser** — `AnalyserNode`; exposes
  `getByteTimeDomainData` and `getByteFrequencyData`; foundation for
  waveform and FFT visualisations in the UI.

- [ ] **Channel Routing** — `ChannelSplitterNode` + `ChannelMergerNode`;
  enables mid-side processing, per-channel EQ, and mono downmix.

---

## AudioWorklet (custom DSP, still no external libraries)

- [ ] **Pitch Shift** (time-preserving) — phase vocoder implemented in a
  worklet; high complexity.

- [ ] **Time Stretch** (pitch-preserving) — phase vocoder or WSOLA in a worklet;
  alternatively pre-process with `OfflineAudioContext`; high complexity.

- [ ] **Chorus / Flanger** — short modulated delay; can be approximated with
  `DelayNode` + `OscillatorNode` LFO without a worklet; medium complexity.

- [ ] **Tremolo** — `OscillatorNode` modulating a `GainNode`; low complexity.

- [ ] **Vibrato** — `OscillatorNode` modulating `AudioBufferSourceNode.playbackRate`;
  low complexity.

- [ ] **Noise Gate** — RMS envelope follower that mutes the signal below a
  threshold; medium complexity; requires a worklet.

- [ ] **Tape Saturation / Vintage Warmth** — `WaveShaperNode` soft-clip curve
  combined with a mild high-frequency roll-off `BiquadFilterNode`; medium
  complexity.
