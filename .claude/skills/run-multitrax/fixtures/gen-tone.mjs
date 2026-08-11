import fs from 'node:fs';

const sampleRate = 44100;
const seconds = 1;
const freq = 440;
const numSamples = sampleRate * seconds;
const dataSize = numSamples * 2; // 16-bit mono

const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
buf.writeUInt16LE(2, 32); // block align
buf.writeUInt16LE(16, 34); // bits per sample
buf.write('data', 36);
buf.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const sample = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.3 * 32767);
  buf.writeInt16LE(sample, 44 + i * 2);
}

fs.writeFileSync(process.argv[2], buf);
console.log('wrote', process.argv[2]);
