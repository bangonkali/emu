import type { AudioConfigMessage } from '../types/protocol';

const AUDIO_VOLUME_KEY = 'poke-audio-volume';

function loadVolume(): number {
  try {
    const saved = Number(localStorage.getItem(AUDIO_VOLUME_KEY));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 1) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 0.8;
}

class AudioStore {
  supported = $state(true);
  available = $state(false);
  enabled = $state(false);
  ready = $state(false);
  muted = $state(false);
  blockedReason = $state<string | null>(null);
  sampleRate = $state(0);
  channels = $state(0);
  format = $state('unknown');
  playbackSpeed = $state('1x');
  volume = $state(loadVolume());

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setSupported(value: boolean): void {
    this.supported = value;
  }

  setAvailable(value: boolean): void {
    this.available = value;
  }

  setReady(value: boolean): void {
    this.ready = value;
  }

  setMuted(value: boolean): void {
    this.muted = value;
  }

  setBlockedReason(value: string | null): void {
    this.blockedReason = value;
  }

  setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volume = clamped;
    try {
      localStorage.setItem(AUDIO_VOLUME_KEY, String(clamped));
    } catch {
      // ignore
    }
  }

  applyConfig(config: AudioConfigMessage): void {
    this.available = config.enabled;
    this.sampleRate = config.sample_rate;
    this.channels = config.channels;
    this.format = config.format;
    this.playbackSpeed = config.playback_speed;
  }
}

export const audioStore = new AudioStore();