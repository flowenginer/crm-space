/**
 * Mp3Recorder - Records audio directly to MP3 format
 * 
 * Uses ScriptProcessorNode to capture PCM samples from the microphone
 * and encodes them to MP3 in real-time using lamejs (loaded globally via CDN).
 * 
 * This bypasses the need for AudioContext.decodeAudioData() which
 * doesn't reliably support WebM/Opus in all browsers.
 */
export class Mp3Recorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mp3Encoder: any = null;
  private mp3Data: Int8Array[] = [];
  private isRecording = false;
  
  private sampleRate = 44100;
  private channels = 1;
  private kbps = 128;
  private bufferSize = 4096;

  async start(): Promise<void> {
    this.mp3Data = [];
    
    // Access lamejs from global scope (loaded via script in index.html)
    const lamejs = (window as any).lamejs;
    
    console.log('[Mp3Recorder] Starting, lamejs:', lamejs);
    console.log('[Mp3Recorder] Mp3Encoder:', lamejs?.Mp3Encoder);
    
    if (!lamejs?.Mp3Encoder) {
      throw new Error('Mp3Encoder not available - lamejs script may not be loaded');
    }
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: this.sampleRate 
        } 
      });
      
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      
      // Get actual sample rate from context (may differ from requested)
      const actualSampleRate = this.audioContext.sampleRate;
      console.log('[Mp3Recorder] AudioContext sampleRate:', actualSampleRate);
      
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(this.bufferSize, this.channels, this.channels);
      
      // Initialize MP3 encoder with actual sample rate using global lamejs
      this.mp3Encoder = new lamejs.Mp3Encoder(this.channels, actualSampleRate, this.kbps);
      
      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || !this.mp3Encoder) return;
        
        const samples = e.inputBuffer.getChannelData(0);
        const samples16 = new Int16Array(samples.length);
        
        // Convert Float32 to Int16
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const mp3buf = this.mp3Encoder.encodeBuffer(samples16);
        if (mp3buf.length > 0) {
          this.mp3Data.push(new Int8Array(mp3buf));
        }
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isRecording = true;
      
      console.log('[Mp3Recorder] Recording started');
    } catch (error) {
      console.error('[Mp3Recorder] Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  stop(): Blob {
    console.log('[Mp3Recorder] Stopping recording...');
    this.isRecording = false;
    
    // Flush remaining MP3 data
    if (this.mp3Encoder) {
      const mp3buf = this.mp3Encoder.flush();
      if (mp3buf.length > 0) {
        this.mp3Data.push(new Int8Array(mp3buf));
      }
    }
    
    // Cleanup resources
    this.cleanup();
    
    // Combine MP3 chunks
    const totalLength = this.mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
    const mp3Array = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.mp3Data) {
      mp3Array.set(new Uint8Array(chunk.buffer), offset);
      offset += chunk.length;
    }
    
    console.log('[Mp3Recorder] MP3 created, size:', mp3Array.length, 'bytes');
    
    return new Blob([mp3Array], { type: 'audio/mpeg' });
  }

  cancel(): void {
    console.log('[Mp3Recorder] Recording cancelled');
    this.isRecording = false;
    this.cleanup();
    this.mp3Data = [];
  }

  private cleanup(): void {
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      this.mediaStream?.getTracks().forEach(track => track.stop());
      this.audioContext?.close();
    } catch (e) {
      console.warn('[Mp3Recorder] Cleanup error:', e);
    }
    
    this.processor = null;
    this.source = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.mp3Encoder = null;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
