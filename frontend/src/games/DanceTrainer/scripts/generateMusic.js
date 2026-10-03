// Script to generate original, royalty-free dance music loops for public/music/
import fs from 'fs';
import path from 'path';

function createWavBuffer(sampleRate, samples) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Chunk size
  buffer.writeUInt16LE(1, 20);  // Audio format 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), offset);
    offset += 2;
  }

  return buffer;
}

function generateDanceTrack(bpm, numBars = 4) {
  const sampleRate = 44100;
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const totalDuration = numBars * barDuration;
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const samples = new Float32Array(totalSamples);

  // Bass notes frequencies (A minor: A1 = 55Hz, C2 = 65.4Hz, D2 = 73.4Hz, E2 = 82.4Hz)
  const bassNotes = [55.0, 55.0, 65.41, 73.42, 82.41, 73.42, 65.41, 55.0];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatTime = t % beatDuration;
    const currentBeat = Math.floor(t / beatDuration);
    const beatFraction = beatTime / beatDuration;

    let sample = 0;

    // 1. Kick Drum on every beat (beats 1, 2, 3, 4)
    if (beatTime < 0.22) {
      const kickEnv = Math.exp(-beatTime * 18);
      const kickFreq = 45 + 110 * Math.exp(-beatTime * 35);
      const kick = Math.sin(2 * Math.PI * kickFreq * beatTime) * kickEnv;
      sample += kick * 0.45;
    }

    // 2. Snare / Clap on beats 2 & 4
    if ((currentBeat % 2 === 1) && beatTime < 0.2) {
      const snareEnv = Math.exp(-beatTime * 22);
      const noise = (Math.random() * 2 - 1) * snareEnv * 0.25;
      const snareBody = Math.sin(2 * Math.PI * 180 * beatTime) * snareEnv * 0.15;
      sample += noise + snareBody;
    }

    // 3. Hi-Hat on off-beats (8th notes)
    const eighthTime = (t % (beatDuration / 2));
    if (eighthTime < 0.08) {
      const hatEnv = Math.exp(-eighthTime * 60);
      const hatNoise = (Math.random() * 2 - 1) * hatEnv * 0.12;
      sample += hatNoise;
    }

    // 4. Synth Bassline Groove
    const sixteenthIndex = Math.floor((t % barDuration) / (beatDuration / 2));
    const bassNote = bassNotes[sixteenthIndex % bassNotes.length];
    const bassSubTime = (t % (beatDuration / 2));
    const bassEnv = Math.exp(-bassSubTime * 6);
    const bass = (Math.sin(2 * Math.PI * bassNote * t) + 0.3 * Math.sin(2 * Math.PI * bassNote * 2 * t)) * bassEnv;
    sample += bass * 0.25;

    // 5. Synth Pluck / Chord pad
    const chordFreqs = [220, 261.63, 329.63]; // A minor chord (A3, C4, E4)
    const chordTime = (t % beatDuration);
    const chordEnv = Math.exp(-chordTime * 4);
    let chord = 0;
    for (let f = 0; f < chordFreqs.length; f++) {
      chord += Math.sin(2 * Math.PI * chordFreqs[f] * t);
    }
    sample += chord * 0.06 * chordEnv;

    samples[i] = sample * 0.85; // Master gain
  }

  return createWavBuffer(sampleRate, samples);
}

// Ensure public/music exists
const musicDir = path.resolve('public/music');
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

// 1. Slow Tempo (80 BPM - Learn Mode)
console.log('Generating slow_tempo_80bpm.wav...');
const slowBuf = generateDanceTrack(80, 4);
fs.writeFileSync(path.join(musicDir, 'slow_tempo_80bpm.wav'), slowBuf);

// 2. Medium Tempo (105 BPM - Practice Mode)
console.log('Generating medium_tempo_105bpm.wav...');
const medBuf = generateDanceTrack(105, 4);
fs.writeFileSync(path.join(musicDir, 'medium_tempo_105bpm.wav'), medBuf);

// 3. Target Tempo (125 BPM - Final Performance Mode)
console.log('Generating target_tempo_125bpm.wav...');
const targetBuf = generateDanceTrack(125, 4);
fs.writeFileSync(path.join(musicDir, 'target_tempo_125bpm.wav'), targetBuf);

console.log('Successfully generated all 3 royalty-free dance music tracks in public/music/!');
