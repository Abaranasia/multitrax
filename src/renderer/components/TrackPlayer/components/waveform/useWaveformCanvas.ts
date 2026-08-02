import { useEffect, useRef } from 'react';

export const useWaveformCanvas = (waveform: number[] | undefined, progress: number) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const waveformData = waveform ?? [];
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || canvas.clientWidth || 280;
    const height = rect.height || canvas.clientHeight || 65;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 6 * dpr;
    const availableWidth = Math.max(0, canvas.width - padding * 2);
    const barWidth = Math.max(dpr, Math.min(1.4 * dpr, 2 * dpr));
    const count = Math.max(waveformData.length, Math.floor(availableWidth / (barWidth * 1.1)));
    const step = availableWidth / Math.max(count, 1);
    const centerY = canvas.height / 2;
    const maxBarHeight = canvas.height * 0.78;

    const drawWaveform = (fillStyle: CanvasGradient | string, alpha: number) => {
      ctx.fillStyle = fillStyle;
      ctx.globalAlpha = alpha;

      for (let i = 0; i < count; i += 1) {
        const idx = Math.floor(
          (i / Math.max(count - 1, 1)) * Math.max(waveformData.length - 1, 0),
        );
        const value = waveformData[idx] ?? 0.25;
        const normalized = 0.3 + value * 0.7;
        const barHeight = Math.max(canvas.height * 0.25, normalized * maxBarHeight);
        const x = padding + i * step + (step - barWidth) / 2;
        const y = centerY - barHeight / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGradient.addColorStop(0, 'rgba(125, 211, 252, 0.28)');
    baseGradient.addColorStop(1, 'rgba(192, 132, 252, 0.28)');
    drawWaveform(baseGradient, 0.72);

    if (progress > 0) {
      const playedWidth = (canvas.width * progress) / 100;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playedWidth, canvas.height);
      ctx.clip();

      const activeGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      activeGradient.addColorStop(0, '#7dd3fc');
      activeGradient.addColorStop(1, '#c084fc');
      drawWaveform(activeGradient, 0.94);

      ctx.restore();
    }
  }, [waveform, progress]);

  return canvasRef;
};
