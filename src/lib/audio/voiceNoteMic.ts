// Áudio gravado não tem outra ponta: o cancelamento de eco só cala o microfone
// quando sai som do PC, gerando cortes no meio da fala. Chamadas (WebRTC) mantêm o padrão.
export const VOICE_NOTE_MIC: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: true,
};
