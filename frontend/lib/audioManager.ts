// Audio Manager para notificaciones de pago
// Soporta archivos de audio y Web Audio API como fallback

interface AudioOptions {
  volume?: number;
  loop?: boolean;
}

class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isEnabled = true;
  private useWebAudio = false;

  constructor() {
    // Verificar soporte de Web Audio API
    if (typeof window !== 'undefined') {
      try {
        const AudioContextClass = window.AudioContext || 
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        this.useWebAudio = true;
      } catch {
        console.warn('Web Audio API no soportada');
        this.useWebAudio = false;
      }

      // Intentar cargar archivo de audio
      this.loadAudioFile();
    }
  }

  private loadAudioFile() {
    if (typeof window === 'undefined') return;

    try {
      this.audioElement = new Audio('/sounds/notification.mp3');
      this.audioElement.load();
      
      // Si el archivo existe, usarlo en lugar de Web Audio
      this.audioElement.addEventListener('canplaythrough', () => {
        this.useWebAudio = false;
        console.log('[AudioManager] Archivo de audio cargado correctamente');
      });

      this.audioElement.addEventListener('error', () => {
        console.log('[AudioManager] Usando Web Audio API como fallback');
        this.useWebAudio = true;
      });
    } catch {
      this.useWebAudio = true;
    }
  }

  // Habilitar/deshabilitar sonidos
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    localStorage.setItem('payalert_audio_enabled', enabled.toString());
  }

  // Verificar si los sonidos están habilitados
  isAudioEnabled(): boolean {
    const stored = localStorage.getItem('payalert_audio_enabled');
    return stored ? stored === 'true' : this.isEnabled;
  }

  // Reproducir sonido de notificación de pago (estilo caja registradora)
  async playPaymentNotification(options: AudioOptions = {}) {
    if (!this.isAudioEnabled()) return;

    const { volume = 0.7 } = options;

    try {
      if (!this.useWebAudio && this.audioElement) {
        // Usar archivo de audio
        this.audioElement.volume = volume;
        this.audioElement.currentTime = 0;
        await this.audioElement.play();
      } else if (this.useWebAudio && this.audioContext) {
        // Usar Web Audio API para generar sonido
        await this.playGeneratedSound(volume);
      }
    } catch (error) {
      console.warn('[AudioManager] Error reproduciendo sonido:', error);
    }
  }

  // Generar sonido de caja registradora usando Web Audio API
  private async playGeneratedSound(volume: number) {
    if (!this.audioContext) return;

    // Reanudar contexto si está suspendido (requerido en algunos navegadores)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    // Crear oscilador para sonido principal (tono "ding")
    const oscillator1 = this.audioContext.createOscillator();
    const gainNode1 = this.audioContext.createGain();

    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(1200, now);
    oscillator1.frequency.exponentialRampToValueAtTime(600, now + 0.1);

    gainNode1.gain.setValueAtTime(0, now);
    gainNode1.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator1.connect(gainNode1);
    gainNode1.connect(this.audioContext.destination);

    oscillator1.start(now);
    oscillator1.stop(now + 0.3);

    // Segundo tono (eco más agudo)
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode2 = this.audioContext.createGain();

    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(1800, now + 0.05);
    oscillator2.frequency.exponentialRampToValueAtTime(900, now + 0.15);

    gainNode2.gain.setValueAtTime(0, now + 0.05);
    gainNode2.gain.linearRampToValueAtTime(volume * 0.2, now + 0.06);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    oscillator2.connect(gainNode2);
    gainNode2.connect(this.audioContext.destination);

    oscillator2.start(now + 0.05);
    oscillator2.stop(now + 0.25);

    // Sonido de "campana" (ruido blanco filtrado)
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const noiseFilter = this.audioContext.createBiquadFilter();
    const noiseGain = this.audioContext.createGain();

    noise.buffer = buffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    noiseGain.gain.setValueAtTime(0, now + 0.02);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.1, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);

    noise.start(now + 0.02);
    noise.stop(now + 0.12);
  }

  // Solicitar permiso de audio (requerido en algunos navegadores móviles)
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Intentar reproducir un sonido silencioso para obtener permiso
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // En iOS, necesitamos una interacción del usuario
      if (this.audioElement) {
        this.audioElement.volume = 0;
        await this.audioElement.play();
        this.audioElement.pause();
        this.audioElement.volume = 0.7;
      }

      return true;
    } catch {
      return false;
    }
  }
}

// Instancia singleton
const audioManager = new AudioManager();

export default audioManager;
export { AudioManager };
