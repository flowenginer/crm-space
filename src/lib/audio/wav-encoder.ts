/**
 * Encodes audio Blob to WAV format (PCM 16-bit mono)
 * Used for Instagram which supports WAV but not MP3
 */
export async function encodeToWav(audioBlob: Blob): Promise<Blob> {
  console.log('[WAVEncoder] Starting conversion, input size:', audioBlob.size);

  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  console.log('[WAVEncoder] Decoded audio - sampleRate:', audioBuffer.sampleRate, 'duration:', audioBuffer.duration);

  const numChannels = 1; // mono
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);

  // Convert Float32 samples to Int16
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Build WAV file
  const dataLength = int16Samples.length * 2; // 2 bytes per Int16 sample
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // Sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true);           // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);  // Number of channels
  view.setUint32(24, sampleRate, true);   // Sample rate
  view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
  view.setUint16(32, numChannels * 2, true); // Block align
  view.setUint16(34, 16, true);          // Bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  const output = new Int16Array(buffer, 44);
  output.set(int16Samples);

  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  console.log('[WAVEncoder] Conversion complete, output size:', wavBlob.size);

  await audioContext.close();

  return wavBlob;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
