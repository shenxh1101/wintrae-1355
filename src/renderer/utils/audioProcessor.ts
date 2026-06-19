const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export async function decodeAudioFile(filePath: string): Promise<AudioBuffer> {
  let arrayBuffer: ArrayBuffer;

  if (window.electronAPI) {
    const byteArr = await window.electronAPI.readBinaryFile(filePath);
    arrayBuffer = new Uint8Array(byteArr).buffer;
  } else {
    const resp = await fetch(filePath);
    arrayBuffer = await resp.arrayBuffer();
  }

  return audioCtx.decodeAudioData(arrayBuffer);
}

export function calculateLufs(audioBuffer: AudioBuffer, startTime?: number, endTime?: number): number {
  const start = startTime || 0;
  const end = endTime || audioBuffer.duration;
  const sr = audioBuffer.sampleRate;
  const startSample = Math.floor(start * sr);
  const endSample = Math.min(Math.floor(end * sr), audioBuffer.length);
  const numChannels = audioBuffer.numberOfChannels;

  let sumSquares = 0;
  let count = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      sumSquares += data[i] * data[i];
      count++;
    }
  }

  if (count === 0 || sumSquares === 0) return -70;

  const rms = sumSquares / count;
  const rmsDb = 10 * Math.log10(rms);
  const lufs = rmsDb + 0.691;

  return Math.round(lufs * 10) / 10;
}

export function calculateGainForTarget(currentLufs: number, targetLufs: number): number {
  return Math.pow(10, (targetLufs - currentLufs) / 20);
}

export async function renderEpisodeAudio(
  episode: {
    intro?: { filePath: string; duration: number; volume: number };
    outro?: { filePath: string; duration: number; volume: number };
    segments: { materialId: string; startTime: number; endTime: number; volume: number; normalizedVolume?: number }[];
    materials: { id: string; filePath: string }[];
  },
  targetLufs?: number
): Promise<AudioBuffer> {
  const decodedCache = new Map<string, AudioBuffer>();

  const getDecoded = async (filePath: string): Promise<AudioBuffer> => {
    if (decodedCache.has(filePath)) return decodedCache.get(filePath)!;
    const buf = await decodeAudioFile(filePath);
    decodedCache.set(filePath, buf);
    return buf;
  };

  const tasks: { buffer: AudioBuffer; start: number; duration: number; volume: number; offset?: number }[] = [];
  let currentTime = 0;

  if (episode.intro) {
    const buf = await getDecoded(episode.intro.filePath);
    tasks.push({ buffer: buf, start: currentTime, duration: Math.min(episode.intro.duration, buf.duration), volume: episode.intro.volume, offset: 0 });
    currentTime += episode.intro.duration;
  }

  for (const seg of episode.segments) {
    const mat = episode.materials.find((m) => m.id === seg.materialId);
    if (!mat) continue;
    const buf = await getDecoded(mat.filePath);
    const segDuration = seg.endTime - seg.startTime;
    const effectiveVolume = seg.normalizedVolume ?? seg.volume;
    tasks.push({ buffer: buf, start: currentTime, duration: segDuration, volume: effectiveVolume, offset: seg.startTime });
    currentTime += segDuration;
  }

  if (episode.outro) {
    const buf = await getDecoded(episode.outro.filePath);
    tasks.push({ buffer: buf, start: currentTime, duration: Math.min(episode.outro.duration, buf.duration), volume: episode.outro.volume, offset: 0 });
    currentTime += episode.outro.duration;
  }

  const totalDuration = currentTime;
  const sampleRate = 44100;
  const numChannels = 2;
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);

  for (const task of tasks) {
    const segmentBuffer = task.buffer;
    const offset = task.offset || 0;

    const src = offlineCtx.createBufferSource();
    const trimmed = trimAudioBuffer(segmentBuffer, offset, offset + task.duration);
    src.buffer = trimmed;

    const gain = offlineCtx.createGain();
    gain.gain.value = task.volume;

    src.connect(gain);
    gain.connect(offlineCtx.destination);

    src.start(task.start);
  }

  return offlineCtx.startRendering();
}

function trimAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.min(Math.floor(endSec * sr), buffer.length);
  const length = endSample - startSample;

  const trimmed = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: sr
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = trimmed.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dst[i] = src[startSample + i];
    }
  }

  return trimmed;
}

export async function measureSegmentLufs(
  materialFilePath: string,
  startTime: number,
  endTime: number
): Promise<number> {
  const buf = await decodeAudioFile(materialFilePath);
  return calculateLufs(buf, startTime, endTime);
}
