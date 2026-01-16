import { useState, useRef } from 'react';
import { Mic, Square, Upload, Play, Pause, Trash2, Loader2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface FlowAudioUploaderProps {
  value: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
}

export function FlowAudioUploader({ value, onChange, onRemove }: FlowAudioUploaderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  
  const mp3RecorderRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error('[FlowAudioUploader] Error starting recording:', error);
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
      console.log('[FlowAudioUploader] MP3 recorded, size:', mp3Blob.size);
      mp3RecorderRef.current = null;
      await uploadAudio(mp3Blob, 'audio/mpeg', `gravacao_${Date.now()}.mp3`);
    } catch (error) {
      console.error('[FlowAudioUploader] Error stopping recording:', error);
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
      const filePath = `flow-audio/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('chatbot-audio')
        .upload(filePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chatbot-audio')
        .getPublicUrl(filePath);

      onChange(publicUrl);
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
    event.target.value = '';
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
    onChange('');
    setRecordingTime(0);
    if (onRemove) onRemove();
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      toast({ title: 'URL do áudio definida!' });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Se já tem áudio, mostra o player
  if (value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            className="h-9 w-9 shrink-0"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </Button>

          <audio
            ref={audioRef}
            src={value}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{value}</p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="record" className="text-xs">Gravar</TabsTrigger>
          <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
            size="sm"
          >
            {isUploading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Upload size={16} className="mr-2" />
            )}
            Selecionar arquivo de áudio
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-2">
            MP3, OGG, WAV, M4A ou WEBM
          </p>
        </TabsContent>
        
        <TabsContent value="record" className="mt-3">
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
            className="w-full"
            size="sm"
          >
            {isRecording ? (
              <>
                <Square size={16} className="mr-2" />
                Parar ({formatTime(recordingTime)})
              </>
            ) : (
              <>
                <Mic size={16} className="mr-2" />
                Iniciar gravação
              </>
            )}
          </Button>
          
          {isRecording && (
            <div className="flex items-center justify-center gap-2 text-destructive mt-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-xs font-medium">Gravando...</span>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="url" className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/audio.mp3"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              <Link size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole a URL direta para o arquivo de áudio
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
