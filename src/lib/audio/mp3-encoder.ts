import { getLamejs } from './lamejs-loader';

/**
 * Encodes audio Blob to MP3 format using lamejs
 * Uses CDN version if available, falls back to local bundle
 */
export async function encodeToMp3(audioBlob: Blob): Promise<Blob> {
  console.log('[MP3Encoder] Starting conversion, input size:', audioBlob.size);
  
  // Use loader with fallback instead of direct global access
  const lamejs = await getLamejs();
  
  if (!lamejs?.Mp3Encoder) {
    throw new Error('lamejs not loaded - Mp3Encoder not available');
  }
  
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  console.log('[MP3Encoder] Decoded audio - sampleRate:', audioBuffer.sampleRate, 'duration:', audioBuffer.duration);
  
  const channels = 1; // mono for WhatsApp compatibility
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 128;
  
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  
  // Get audio samples from the first channel
  const samples = audioBuffer.getChannelData(0);
  const sampleBlockSize = 1152;
  const mp3Data: Int8Array[] = [];
  
  // Convert Float32Array to Int16Array
  const samples16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Encode in blocks
  for (let i = 0; i < samples16.length; i += sampleBlockSize) {
    const sampleChunk = samples16.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }
  }
  
  // Finalize
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Int8Array(mp3buf));
  }
  
  // Combine all chunks
  const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
  const mp3Array = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    mp3Array.set(new Uint8Array(chunk.buffer), offset);
    offset += chunk.length;
  }
  
  const mp3Blob = new Blob([mp3Array], { type: 'audio/mpeg' });
  console.log('[MP3Encoder] Conversion complete, output size:', mp3Blob.size);
  
  await audioContext.close();
  
  return mp3Blob;
}
