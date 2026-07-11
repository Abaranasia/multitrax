# Audio Effects — Future Development TODO

Effects to be added per-track in `AudioEngine.ts`.  
Integration point: `SourceNode → GainNode → [effects chain] → masterGain`.  
Each effect node should be stored in `TrackNodes` and exposed via the standard
`TrackState` + setter pattern already used for volume and fades.

---

## Architecture decision: per-track inserts vs. a shared effects rack

Considered whether effects should live directly on each track (current approach)
or as an independent "effects rack" section with a visual patchbay (cable-style
connections from tracks to shared effect units).

**Decided: keep per-track inserts for now.** Reuses the existing
`TrackState` + `TrackNodes` + `AudioEngine` setter pattern with no new
subsystem. A patchbay would require a routing graph, cable-drag UI on the
canvas, and rules for shared-instance behaviour — a lot of extra surface for
what's meant to stay a focused mixing/monitoring tool.

- [ ] **Future improvement: shared reverb send/return bus.** Real mixing
  consoles typically run reverb as a shared "send" effect — one reverb
  instance fed from multiple tracks via a per-track "send amount" — rather
  than one `ConvolverNode` duplicated per track. This is both more
  CPU-efficient (convolution is expensive) and matches how audio engineers
  expect reverb to behave. Could be implemented as a single shared bus
  without needing the full visual patchbay (just one reverb instance + a
  per-track send-level knob). Revisit if per-track `ConvolverNode` instances
  turn out to be a CPU bottleneck with many tracks, or if users want one
  consistent "room" applied across the whole mix.

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
  **Decided parameter set (5 controls):**
  - **Room / IR type** — preset dropdown; swaps `ConvolverNode.buffer` between
    preloaded IR files (e.g. Small Room, Hall, Plate, Cathedral).
  - **Wet/Dry mix** — slider 0–100%; parallel dry `GainNode` + wet `GainNode`
    (through the convolver), crossfaded.
  - **Pre-delay** — slider 0–~500 ms; `DelayNode` inserted before the convolver.
  - **Damping / tone** — slider; `BiquadFilterNode` (lowpass or highshelf) on
    the wet tail, cutting highs.
  - **Output level** — slider; trim `GainNode` after the convolver.
  - Reuses the existing per-track settings-overlay pattern (sliders + Apply/Cancel).
  - **Future improvement (not in initial scope):** continuous **Room Size** and
    **Decay Time** sliders require replacing static IR files with an
    algorithmically generated impulse response (white noise shaped by an
    exponential decay envelope). More DSP work, sounds less "real" than a
    captured space, but removes the fixed-preset limitation. Revisit if the
    static-IR version feels too limited.

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
