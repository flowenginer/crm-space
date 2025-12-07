import { useState, useRef } from 'react';
import { Mic, Square, Upload, Play, Pause, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onAudioUploaded: (url: string, type: string) => void;
  existingUrl?: string | null;
  onRemove?: () => void;
}

export function AudioRecorder({ onAudioUploaded, existingUrl, onRemove }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob, 'audio/webm');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ 
        title: 'Erro ao iniciar gravação', 
        description: 'Verifique as permissões do microfone',
        variant: 'destructive' 
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadAudio = async (blob: Blob, mimeType: string) => {
    setIsUploading(true);
    try {
      const fileName = `audio_${Date.now()}.${mimeType.includes('webm') ? 'webm' : mimeType.split('/')[1]}`;
      const filePath = `audios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(filePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-attachments')
        .getPublicUrl(filePath);

      setAudioUrl(publicUrl);
      onAudioUploaded(publicUrl, 'audio');
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

    await uploadAudio(file, file.type);
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

  return (
    <div className="space-y-4">
      {/* Recording/Upload Buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant={isRecording ? 'destructive' : 'outline'}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading || !!audioUrl}
          className="flex-1"
        >
          {isRecording ? (
            <>
              <Square size={16} className="mr-2" />
              Parar ({formatTime(recordingTime)})
            </>
          ) : (
            <>
              <Mic size={16} className="mr-2" />
              Gravar Áudio
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || isUploading || !!audioUrl}
          className="flex-1"
        >
          {isUploading ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Upload size={16} className="mr-2" />
          )}
          Upload de Áudio
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="flex items-center gap-3 bg-muted rounded-xl p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            className="h-10 w-10"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </Button>

          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary w-0 transition-all" />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 text-destructive">
          <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-medium">Gravando...</span>
        </div>
      )}
    </div>
  );
}
