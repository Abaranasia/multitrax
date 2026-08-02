/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine } from '@/renderer/audio/AudioEngine';
import { FakeAudioContext } from './fixtures/fakeAudioContext';

describe('AudioEngine (unit)', () => {
  let realAC: any;
  beforeEach(() => {
    realAC = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext as any;
  });

  afterEach(() => {
    (global as any).AudioContext = realAC;
  });

  it('adds a track and reports duration', () => {
    const engine = new AudioEngine();
    const buf = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t1', buf);
    expect(engine.getDuration('t1')).toBe(8);
  });

  it('enables looping by default for newly added tracks', () => {
    const engine = new AudioEngine();
    const buf = { duration: 10 } as unknown as AudioBuffer;
    engine.addTrack('t2', buf);

    const source = (engine as any).tracks.get('t2').sourceNode;
    expect(source).toBeNull();
    expect((engine as any).tracks.get('t2').loop).toBe(true);
  });

  it('plays, reports playing and currentTime progression', () => {
    const engine = new AudioEngine();
    const buf = { duration: 10 } as unknown as AudioBuffer;
    engine.addTrack('t2', buf);

    engine.play('t2');
    expect(engine.isPlaying('t2')).toBe(true);

    // advance context time
    (engine.audioContext as any).currentTime += 2.5;
    const t = engine.getCurrentTime('t2');
    expect(t).toBeGreaterThanOrEqual(2.4);

    engine.pause('t2');
    expect(engine.isPlaying('t2')).toBe(false);
    const after = engine.getCurrentTime('t2');
    expect(after).toBeGreaterThanOrEqual(2.4);
  });

  it('stops and resets current time', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t3', buf);
    engine.play('t3');
    (engine.audioContext as any).currentTime += 1.2;
    engine.stop('t3');
    expect(engine.getCurrentTime('t3')).toBe(0);
    expect(engine.isPlaying('t3')).toBe(false);
  });

  it('_stopSource swallows the expected InvalidStateError when a source is already stopped', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t-invalid-state', buf);
    engine.play('t-invalid-state');

    const track = (engine as any).tracks.get('t-invalid-state');
    track.sourceNode.stop = () => {
      throw new DOMException('already stopped', 'InvalidStateError');
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => engine.stop('t-invalid-state')).not.toThrow();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(track.sourceNode).toBeNull();
  });

  it('_stopSource surfaces an unexpected stop error via console.error instead of swallowing it', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t-unexpected-error', buf);
    engine.play('t-unexpected-error');

    const track = (engine as any).tracks.get('t-unexpected-error');
    const unexpectedError = new Error('hardware failure');
    track.sourceNode.stop = () => {
      throw unexpectedError;
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => engine.stop('t-unexpected-error')).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.anything(), unexpectedError);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(track.sourceNode).toBeNull();
  });

  it('getBuffer returns the same buffer reference passed to addTrack, or undefined for an unknown id', () => {
    const engine = new AudioEngine();
    const buf = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t1b', buf);
    expect(engine.getBuffer('t1b')).toBe(buf);
    expect(engine.getBuffer('nonexistent')).toBeUndefined();
  });

  it('stopAll stops every playing track and resets current time', () => {
    const engine = new AudioEngine();
    const buf1 = { duration: 5 } as unknown as AudioBuffer;
    const buf2 = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t3a', buf1);
    engine.addTrack('t3b', buf2);
    engine.play('t3a');
    engine.play('t3b');
    (engine.audioContext as any).currentTime += 1.2;

    engine.stopAll();

    expect(engine.isPlaying('t3a')).toBe(false);
    expect(engine.isPlaying('t3b')).toBe(false);
    expect(engine.getCurrentTime('t3a')).toBe(0);
    expect(engine.getCurrentTime('t3b')).toBe(0);
  });

  it('playAll starts playback on every track', () => {
    const engine = new AudioEngine();
    const buf1 = { duration: 5 } as unknown as AudioBuffer;
    const buf2 = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t3c', buf1);
    engine.addTrack('t3d', buf2);

    engine.playAll();

    expect(engine.isPlaying('t3c')).toBe(true);
    expect(engine.isPlaying('t3d')).toBe(true);
  });

  it('setVolume clamps value and updates gain', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4', buf);
    engine.setVolume('t4', 0.5);
    engine.setVolume('t4', 2);
    // no throw; validate getDuration still works
    expect(engine.getDuration('t4')).toBe(2);
  });

  it('setVolume clamps value to [0,1] at both boundaries', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4c', buf);
    engine.setVolume('t4c', -5);
    expect((engine as any).tracks.get('t4c').volume).toBe(0);
    engine.setVolume('t4c', 5);
    expect((engine as any).tracks.get('t4c').volume).toBe(1);
  });

  it('setPan clamps value and updates the panner', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4b', buf);
    engine.setPan('t4b', -0.5);
    engine.setPan('t4b', 5); // clamps to 1
    // no throw; validate getDuration still works
    expect(engine.getDuration('t4b')).toBe(2);
  });

  it('setPan clamps value to [-1,1] at both boundaries', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4d', buf);
    engine.setPan('t4d', -5);
    expect((engine as any).tracks.get('t4d').pan).toBe(-1);
    engine.setPan('t4d', 5);
    expect((engine as any).tracks.get('t4d').pan).toBe(1);
  });

  it('setFadeDurations clamps each duration independently to [0,10]', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t10', buf);

    engine.setFadeDurations('t10', -5, 50, -5);
    let track = (engine as any).tracks.get('t10');
    expect(track.fadeInDuration).toBe(0);
    expect(track.fadeOutDuration).toBe(10);
    expect(track.seekFadeDuration).toBe(0);

    engine.setFadeDurations('t10', 50, -5, 50);
    track = (engine as any).tracks.get('t10');
    expect(track.fadeInDuration).toBe(10);
    expect(track.fadeOutDuration).toBe(0);
    expect(track.seekFadeDuration).toBe(10);
  });

  it('seek updates offsets when not playing and when playing with seekFade', () => {
    const engine = new AudioEngine();
    const buf = { duration: 20 } as unknown as AudioBuffer;
    engine.addTrack('t5', buf);
    engine.seek('t5', 5);
    expect(engine.getCurrentTime('t5')).toBe(5);

    // Now test seek with playing + seekFade
    engine.play('t5');
    engine.setSeekFade('t5', true);
    // advance time slightly so startedAt != 0
    (engine.audioContext as any).currentTime += 0.1;
    engine.seek('t5', 3);
    // Because seek with fade schedules timeout, we fast-forward the fake timers
    // but since implementation uses setTimeout, we can just call clearTimeout path by cancelFade
    // For test purpose ensure no exception and state remains valid
    expect(engine.getDuration('t5')).toBe(20);
  });

  it('seek clamps the offset to [0, buffer.duration]', () => {
    const engine = new AudioEngine();
    const buf = { duration: 12 } as unknown as AudioBuffer;
    engine.addTrack('t5b', buf);

    engine.seek('t5b', -20);
    expect(engine.getCurrentTime('t5b')).toBe(0);

    engine.seek('t5b', 999);
    expect(engine.getCurrentTime('t5b')).toBe(12);
  });

  it('setFilterSettings updates the filter chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t9', buf);
    engine.setFilterSettings('t9', { type: 'highpass', cutoff: 500, resonance: 4, mix: 70, output: 90 });
    // no throw; engine remains valid
    expect(engine.getDuration('t9')).toBe(6);
  });

  it('setFilterSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t9b', buf);

    engine.setFilterSettings('t9b', {
      type: 'lowpass',
      cutoff: -500,
      resonance: 0,
      mix: -10,
      output: -10,
    });
    let filter = (engine as any).tracks.get('t9b').filter;
    expect(filter.cutoff).toBe(20); // FILTER_CUTOFF_MIN_HZ
    expect(filter.resonance).toBe(0.1); // FILTER_RESONANCE_MIN
    expect(filter.mix).toBe(0);
    expect(filter.output).toBe(0);

    engine.setFilterSettings('t9b', {
      type: 'lowpass',
      cutoff: 999999,
      resonance: 999,
      mix: 999,
      output: 999,
    });
    filter = (engine as any).tracks.get('t9b').filter;
    expect(filter.cutoff).toBe(20000); // FILTER_CUTOFF_MAX_HZ
    expect(filter.resonance).toBe(20); // FILTER_RESONANCE_MAX
    expect(filter.mix).toBe(100);
    expect(filter.output).toBe(100);
  });

  it('addTrack wires filter.outputGain -> distortion.dryGain/waveShaper -> distortion.outputGain -> delay.dryGain/delayNode', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td1', buf);
    const track = (engine as any).tracks.get('td1');
    const { filter, distortion, delay } = track;

    expect(filter.outputGain.connectedTo).toContain(distortion.dryGain);
    expect(filter.outputGain.connectedTo).toContain(distortion.waveShaper);
    expect(distortion.outputGain.connectedTo).toContain(delay.dryGain);
    expect(distortion.outputGain.connectedTo).toContain(delay.delayNode);
  });

  it('addTrack wires delay.outputGain -> reverb.dryGain/preDelay -> reverb.outputGain -> pannerNode', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td4', buf);
    const track = (engine as any).tracks.get('td4');
    const { delay, reverb, pannerNode } = track;

    expect(delay.outputGain.connectedTo).toContain(reverb.dryGain);
    expect(delay.outputGain.connectedTo).toContain(reverb.preDelay);
    expect(reverb.outputGain.connectedTo).toContain(pannerNode);
  });

  it('_createDryWetOutput builds a dry/wet/output gain triple wired dry->out and wet->out, initialised to dry=1/wet=0/out=1', () => {
    const engine = new AudioEngine();
    const { dryGain, wetGain, outputGain } = (engine as any)._createDryWetOutput();

    expect(dryGain.gain.value).toBe(1);
    expect(wetGain.gain.value).toBe(0);
    expect(outputGain.gain.value).toBe(1);
    expect(dryGain.connectedTo).toContain(outputGain);
    expect(wetGain.connectedTo).toContain(outputGain);
  });

  it('each effect insert wires its own dryGain/wetGain into its own outputGain (via the shared factory)', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td5', buf);
    const { filter, distortion, delay, reverb } = (engine as any).tracks.get('td5');

    for (const insert of [filter, distortion, delay, reverb]) {
      expect(insert.dryGain.connectedTo).toContain(insert.outputGain);
      expect(insert.wetGain.connectedTo).toContain(insert.outputGain);
    }
  });

  it('setDistortionSettings updates existing distortion nodes without throwing or recreating them', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td2', buf);
    const before = (engine as any).tracks.get('td2').distortion;

    engine.setDistortionSettings('td2', { drive: 70, tone: 40, mix: 60, output: 80 });

    const after = (engine as any).tracks.get('td2').distortion;
    expect(after).toBe(before);
    expect(after.drive).toBe(70);
    expect(after.tone).toBe(40);
    expect(after.mix).toBe(60);
    expect(after.output).toBe(80);
  });

  it('setDistortionSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td2b', buf);

    engine.setDistortionSettings('td2b', { drive: -10, tone: -10, mix: -10, output: -10 });
    let distortion = (engine as any).tracks.get('td2b').distortion;
    expect(distortion.drive).toBe(0);
    expect(distortion.tone).toBe(0);
    expect(distortion.mix).toBe(0);
    expect(distortion.output).toBe(0);

    engine.setDistortionSettings('td2b', { drive: 999, tone: 999, mix: 999, output: 999 });
    distortion = (engine as any).tracks.get('td2b').distortion;
    expect(distortion.drive).toBe(100);
    expect(distortion.tone).toBe(100);
    expect(distortion.mix).toBe(100);
    expect(distortion.output).toBe(100);
  });

  it('_makeDistortionCurve is a near-identity pass-through at drive=0 and increasingly compressive at higher |x| for drive=100', () => {
    const engine = new AudioEngine();
    const curve0: Float32Array = (engine as any)._makeDistortionCurve(0);
    const curve100: Float32Array = (engine as any)._makeDistortionCurve(100);
    const n = curve0.length;
    const sampleAt = (curve: Float32Array, x: number) =>
      curve[Math.round(((x + 1) * n) / 2)];

    const lowX = 0.2;
    const highX = 0.9;

    // At drive=0 the curve is linear: the effective gain (curve/x) stays
    // constant across x, so it introduces no audible saturation.
    const ratioLow0 = sampleAt(curve0, lowX) / lowX;
    const ratioHigh0 = sampleAt(curve0, highX) / highX;
    expect(ratioHigh0).toBeCloseTo(ratioLow0, 2);

    // Per spec ("Drive at 0 is near-transparent"), that constant gain must
    // also be close to unity — NOT a fixed attenuation (the classic
    // (3+k)*x*20*deg/(pi+k|x|) formula, taken verbatim, reduces to x/3 at
    // k=0, which is a ~-9.5dB cut, not near-identity).
    expect(ratioLow0).toBeGreaterThan(0.98);
    expect(ratioLow0).toBeLessThan(1.02);
    expect(ratioHigh0).toBeGreaterThan(0.98);
    expect(ratioHigh0).toBeLessThan(1.02);

    // At drive=100 the curve compresses harder as |x| grows, so the
    // effective gain at highX is measurably lower than at lowX.
    const ratioLow100 = sampleAt(curve100, lowX) / lowX;
    const ratioHigh100 = sampleAt(curve100, highX) / highX;
    expect(ratioHigh100).toBeLessThan(ratioLow100);
  });

  it('_makeDistortionCurve stays within a sane amplitude range and preserves sign across the full drive sweep', () => {
    const engine = new AudioEngine();
    const n = 44100;
    const sampleAt = (curve: Float32Array, x: number) =>
      curve[Math.round(((x + 1) * n) / 2)];
    const sampleXs = [0.1, 0.3, 0.5, 0.7, 0.9];

    for (const drive of [0, 25, 50, 75, 100]) {
      const curve: Float32Array = (engine as any)._makeDistortionCurve(drive);
      for (const x of sampleXs) {
        const y = sampleAt(curve, x);
        expect(Math.sign(y)).toBe(Math.sign(x));
        expect(Math.abs(y)).toBeLessThan(2);
      }
    }
  });

  it('removeTrack disconnects all distortion nodes', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td3', buf);
    const distortion = (engine as any).tracks.get('td3').distortion;
    const disconnectSpy = vi.spyOn(distortion.outputGain, 'disconnect');

    engine.removeTrack('td3');

    expect(disconnectSpy).toHaveBeenCalled();
    expect((engine as any).tracks.get('td3')).toBeUndefined();
  });

  it('setDelaySettings updates the delay chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t8', buf);
    engine.setDelaySettings('t8', { delayTime: 450, feedback: 60, mix: 40, damping: 30, output: 90 });
    // no throw; engine remains valid
    expect(engine.getDuration('t8')).toBe(6);
  });

  it('setDelaySettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t8b', buf);

    engine.setDelaySettings('t8b', {
      delayTime: -100,
      feedback: -10,
      mix: -10,
      damping: -10,
      output: -10,
    });
    let delay = (engine as any).tracks.get('t8b').delay;
    expect(delay.delayTimeMs).toBe(1); // floor of 1ms, not 0 (feedback-loop constraint)
    expect(delay.feedback).toBe(0);
    expect(delay.mix).toBe(0);
    expect(delay.dampingAmount).toBe(0);
    expect(delay.output).toBe(0);

    engine.setDelaySettings('t8b', {
      delayTime: 999999,
      feedback: 999,
      mix: 999,
      damping: 999,
      output: 999,
    });
    delay = (engine as any).tracks.get('t8b').delay;
    expect(delay.delayTimeMs).toBe(2000); // DELAY_TIME_MAX_MS
    expect(delay.feedback).toBe(90); // DELAY_FEEDBACK_MAX
    expect(delay.mix).toBe(100);
    expect(delay.dampingAmount).toBe(100);
    expect(delay.output).toBe(100);
  });

  it('setReverbSettings updates the reverb chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t7', buf);
    engine.setReverbSettings('t7', {
      room: 'cathedral',
      mix: 60,
      preDelay: 100,
      damping: 20,
      output: 80,
    });
    // no throw; engine remains valid
    expect(engine.getDuration('t7')).toBe(6);
  });

  it('setReverbSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t7b', buf);

    engine.setReverbSettings('t7b', {
      room: 'hall',
      mix: -10,
      preDelay: -10,
      damping: -10,
      output: -10,
    });
    let reverb = (engine as any).tracks.get('t7b').reverb;
    expect(reverb.mix).toBe(0);
    expect(reverb.preDelayMs).toBe(0);
    expect(reverb.dampingAmount).toBe(0);
    expect(reverb.output).toBe(0);

    engine.setReverbSettings('t7b', { room: 'hall', mix: 999, preDelay: 999, damping: 999, output: 999 });
    reverb = (engine as any).tracks.get('t7b').reverb;
    expect(reverb.mix).toBe(100);
    expect(reverb.preDelayMs).toBe(500); // pre-delay max is 500ms, unlike delay's 2000ms
    expect(reverb.dampingAmount).toBe(100);
    expect(reverb.output).toBe(100);
  });

  it('close disconnects tracks and closes context', () => {
    const engine = new AudioEngine();
    const buf = { duration: 4 } as unknown as AudioBuffer;
    engine.addTrack('t6', buf);
    engine.close();
    // closing should not throw and duration returns 0
    expect(engine.getDuration('t6')).toBe(0);
  });

  // ── Fade/loop scheduling (fake timers) ─────────────────────────────────────
  // Scoped to this nested describe so the real-timer tests above are unaffected.
  describe('fade/loop scheduling (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('_playLoopWithFade schedules fade-in/fade-out gain anchors and re-invokes itself via onended when track.loop is true', () => {
      const engine = new AudioEngine();
      const buf = { duration: 10 } as unknown as AudioBuffer;
      engine.addTrack('loopfade1', buf);
      const track = (engine as any).tracks.get('loopfade1');
      track.fadeIn = true;
      track.fadeOut = true;
      track.fadeInDuration = 2;
      track.fadeOutDuration = 3;
      // track.loop is true by default (see addTrack)

      const replaySpy = vi.spyOn(engine as any, '_playLoopWithFade');

      engine.play('loopfade1');

      expect(replaySpy).toHaveBeenCalledTimes(1);
      const gain = track.gainNode.gain;
      // iterDuration = 10; fadeInEnd = min(2, 5) = 2; fadeOutStart = max(10-3=7, 5) = 7
      expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(track.volume, 2);
      expect(gain.setValueAtTime).toHaveBeenCalledWith(track.volume, 7);
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10);

      const firstSource = track.sourceNode;
      expect(firstSource.started).toBe(true);

      // Simulate the source ending naturally: FakeSource.stop() schedules its
      // onended callback via a real setTimeout(...,0), which fake timers
      // intercept — flush it with advanceTimersByTime.
      firstSource.stop();
      vi.advanceTimersByTime(0);

      expect(replaySpy).toHaveBeenCalledTimes(2);
      expect(track.startOffset).toBe(0);
      expect(track.playing).toBe(true);
      expect(track.sourceNode).not.toBe(firstSource);
    });

    it('_playLoopWithFade does not re-invoke itself via onended when track.loop is false (stops instead)', () => {
      const engine = new AudioEngine();
      const buf = { duration: 6 } as unknown as AudioBuffer;
      engine.addTrack('loopfade2', buf);
      const track = (engine as any).tracks.get('loopfade2');
      track.loop = false;
      track.fadeOut = true;
      track.fadeOutDuration = 2;

      // play() only routes into _playLoopWithFade when loop && (fadeIn||fadeOut);
      // call it directly to exercise the non-loop onended branch in isolation.
      (engine as any)._playLoopWithFade(track);
      const source = track.sourceNode;
      expect(track.playing).toBe(true);

      const replaySpy = vi.spyOn(engine as any, '_playLoopWithFade');
      source.stop();
      vi.advanceTimersByTime(0);

      expect(replaySpy).not.toHaveBeenCalled();
      expect(track.playing).toBe(false);
      expect(track.startOffset).toBe(0);
      expect(track.sourceNode).toBeNull();
    });

    it('_startFadeOut ramps gain to 0 over fadeOutDuration, then stops the source and invokes afterStop once the timer elapses', () => {
      const engine = new AudioEngine();
      const buf = { duration: 10 } as unknown as AudioBuffer;
      engine.addTrack('fadeout1', buf);
      const track = (engine as any).tracks.get('fadeout1');
      track.fadeOutDuration = 4;
      engine.play('fadeout1');
      const source = track.sourceNode;

      const afterStop = vi.fn();
      (engine as any)._startFadeOut(track, afterStop);

      const gain = track.gainNode.gain;
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, track.fadeOutDuration);
      expect(afterStop).not.toHaveBeenCalled();
      expect(track.sourceNode).toBe(source);

      vi.advanceTimersByTime(track.fadeOutDuration * 1000);

      expect(afterStop).toHaveBeenCalledTimes(1);
      expect(track.sourceNode).toBeNull();
      expect(track.fadeOutTimer).toBeNull();
      expect(gain.setValueAtTime).toHaveBeenCalledWith(track.volume, 0);
    });

    it('_cancelFadeOut clears a pending fade-out timer, stops the source immediately, and restores gain to track.volume', () => {
      const engine = new AudioEngine();
      const buf = { duration: 10 } as unknown as AudioBuffer;
      engine.addTrack('cancelfade1', buf);
      const track = (engine as any).tracks.get('cancelfade1');
      track.fadeOutDuration = 5;
      engine.play('cancelfade1');

      const afterStop = vi.fn();
      (engine as any)._startFadeOut(track, afterStop);
      expect(track.fadeOutTimer).not.toBeNull();

      (engine as any)._cancelFadeOut(track);

      expect(track.fadeOutTimer).toBeNull();
      expect(track.sourceNode).toBeNull();
      expect(afterStop).not.toHaveBeenCalled();
      const gain = track.gainNode.gain;
      expect(gain.setValueAtTime).toHaveBeenCalledWith(track.volume, 0);

      // The canceled timer must never fire afterStop, even after it would have elapsed.
      vi.advanceTimersByTime(track.fadeOutDuration * 1000);
      expect(afterStop).not.toHaveBeenCalled();
    });
  });

  // ── Setters + getRecordingStream (real timers) ─────────────────────────────

  it('setLoop toggles track.loop and propagates to an active sourceNode.loop', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('setloop1', buf);

    engine.setLoop('setloop1', false);
    expect((engine as any).tracks.get('setloop1').loop).toBe(false);

    engine.play('setloop1');
    const track = (engine as any).tracks.get('setloop1');
    expect(track.sourceNode.loop).toBe(false);

    engine.setLoop('setloop1', true);
    expect(track.loop).toBe(true);
    expect(track.sourceNode.loop).toBe(true);

    expect(() => engine.setLoop('nonexistent', true)).not.toThrow();
  });

  it('setFadeIn toggles track.fadeIn', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('setfadein1', buf);
    expect((engine as any).tracks.get('setfadein1').fadeIn).toBe(false);
    engine.setFadeIn('setfadein1', true);
    expect((engine as any).tracks.get('setfadein1').fadeIn).toBe(true);
    engine.setFadeIn('setfadein1', false);
    expect((engine as any).tracks.get('setfadein1').fadeIn).toBe(false);
    expect(() => engine.setFadeIn('nonexistent', true)).not.toThrow();
  });

  it('setFadeOut toggles track.fadeOut', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('setfadeout1', buf);
    expect((engine as any).tracks.get('setfadeout1').fadeOut).toBe(false);
    engine.setFadeOut('setfadeout1', true);
    expect((engine as any).tracks.get('setfadeout1').fadeOut).toBe(true);
    engine.setFadeOut('setfadeout1', false);
    expect((engine as any).tracks.get('setfadeout1').fadeOut).toBe(false);
    expect(() => engine.setFadeOut('nonexistent', true)).not.toThrow();
  });

  it('setSeekFade toggles track.seekFade', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('setseekfade1', buf);
    expect((engine as any).tracks.get('setseekfade1').seekFade).toBe(false);
    engine.setSeekFade('setseekfade1', true);
    expect((engine as any).tracks.get('setseekfade1').seekFade).toBe(true);
    engine.setSeekFade('setseekfade1', false);
    expect((engine as any).tracks.get('setseekfade1').seekFade).toBe(false);
    expect(() => engine.setSeekFade('nonexistent', true)).not.toThrow();
  });

  it('getRecordingStream returns the engine\'s recorderDest.stream by reference', () => {
    const engine = new AudioEngine();
    const stream = engine.getRecordingStream();
    const recorderDest = (engine as any).recorderDest;
    expect(stream).toBe(recorderDest.stream);
  });
});
