import { useCallback, useRef } from 'react';

// Sons de gamificação (usando web audio API para sons sintéticos)
const SOUND_CONFIGS = {
  overtake: { frequency: 880, duration: 0.15, type: 'square' as OscillatorType },
  pole: { frequency: [523, 659, 784], duration: 0.3, type: 'sine' as OscillatorType },
  badge: { frequency: [440, 554, 659, 880], duration: 0.4, type: 'sine' as OscillatorType },
  sale: { frequency: [392, 523, 659], duration: 0.25, type: 'triangle' as OscillatorType },
  points: { frequency: 659, duration: 0.1, type: 'sine' as OscillatorType },
  levelUp: { frequency: [392, 523, 659, 784, 880], duration: 0.5, type: 'sine' as OscillatorType },
};

type SoundType = keyof typeof SOUND_CONFIGS;

export function useGamificationSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType, delay: number = 0) => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime + delay);
      oscillator.stop(ctx.currentTime + delay + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [getAudioContext]);

  const playSound = useCallback((soundType: SoundType) => {
    const config = SOUND_CONFIGS[soundType];
    const frequencies = config.frequency;
    
    if (Array.isArray(frequencies)) {
      // Tocar sequência de notas
      const len = frequencies.length;
      frequencies.forEach((freq, index) => {
        playTone(freq, config.duration / len, config.type, index * (config.duration / len));
      });
    } else {
      playTone(frequencies, config.duration, config.type);
    }
  }, [playTone]);

  const playOvertake = useCallback(() => playSound('overtake'), [playSound]);
  const playPolePosition = useCallback(() => playSound('pole'), [playSound]);
  const playBadgeUnlock = useCallback(() => playSound('badge'), [playSound]);
  const playSale = useCallback(() => playSound('sale'), [playSound]);
  const playPoints = useCallback(() => playSound('points'), [playSound]);
  const playLevelUp = useCallback(() => playSound('levelUp'), [playSound]);

  return {
    playSound,
    playOvertake,
    playPolePosition,
    playBadgeUnlock,
    playSale,
    playPoints,
    playLevelUp,
  };
}
