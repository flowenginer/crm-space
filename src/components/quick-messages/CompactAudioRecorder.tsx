import { useState, useRef } from 'react';
import { Mic, Square, Upload, Play, Pause, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CompactAudioRecorderProps {
  onAudioUploaded: (url: string, type: string, name: string) => void;
  existingUrl?: string | null;
  onRemove?: () => void;
}

export function CompactAudioRecorder({ onAudioUploaded, existingUrl, onRemove }: CompactAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mp3RecorderRef = useRef<any>(null);
  
  const startRecording = async () => {
    try {
      const { Mp3Recorder } = await import('@/lib/audio/mp3-recorder');
      mp3RecorderRef.current = new Mp3Recorder();
      await mp3RecorderRef.current.start();
      
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[CompactAudioRecorder] Error starting recording:', error);
      toast({ 
        title: 'Erro ao iniciar gravação', 
        description: 'Verifique as permissões do microfone',
        variant: 'destructive' 
      });
    }
  };

  const stopRecording = async () => {
    if (!mp3RecorderRef.current || !isRecording) return;
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    try {
      const mp3Blob = mp3RecorderRef.current.stop();
      console.log('[CompactAudioRecorder] MP3 recorded, size:', mp3Blob.size);
      mp3RecorderRef.current = null;
      await uploadAudio(mp3Blob, 'audio/mpeg', `gravacao_${Date.now()}.mp3`);
    } catch (error) {
      console.error('[CompactAudioRecorder] Error stopping recording:', error);
      toast({ 
        title: 'Erro ao finalizar gravação', 
        variant: 'destructive' 
      });
    }
  };

  const uploadAudio = async (blob: Blob, mimeType: string, originalName?: string) => {
    setIsUploading(true);
    try {
      const extension = mimeType.includes('webm') ? 'webm' : mimeType.split('/')[1];
      const fileName = originalName || `audio_${Date.now()}.${extension}`;
      const filePath = `audios/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(filePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-attachments')
        .getPublicUrl(filePath);

      setAudioUrl(publicUrl);
      onAudioUploaded(publicUrl, 'audio', fileName);
      toast({ title: 'Áudio salvo com sucesso!' });
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast({ title: 'Erro ao salvar áudio', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/m4a', 'audio/webm'];
    if (!allowedTypes.some(type => file.type.includes(type.split('/')[1]))) {
      toast({ title: 'Formato não suportado', description: 'Use MP3, OGG, WAV, M4A ou WEBM', variant: 'destructive' });
      return;
    }

    await uploadAudio(file, file.type, file.name);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRemove = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    if (onRemove) onRemove();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlayback}
          className="h-8 w-8"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>

        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />

        <div className="flex-1 flex items-center gap-2">
          <Mic size={14} className="text-primary" />
          <span className="text-xs text-muted-foreground">Áudio anexado</span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 rounded-xl p-3">
        <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
        <span className="text-sm text-destructive font-medium flex-1">
          Gravando... {formatTime(recordingTime)}
        </span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={stopRecording}
          className="h-7"
        >
          <Square size={12} className="mr-1" />
          Parar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startRecording}
        disabled={isUploading}
        className="flex-1 h-9"
      >
        <Mic size={14} className="mr-2" />
        Gravar áudio
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex-1 h-9"
      >
        {isUploading ? (
          <Loader2 size={14} className="mr-2 animate-spin" />
        ) : (
          <Upload size={14} className="mr-2" />
        )}
        Upload áudio
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
