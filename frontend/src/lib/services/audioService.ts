import type { AudioConfigMessage, ServerMessage, StateMessage } from '../types/protocol';
import { audioStore } from '../stores/audioStore.svelte';
import { runtimeSocket } from './runtimeSocket';

type BrowserAudioContext = typeof AudioContext;

const DEFAULT_PLAYBACK_SPEED = '1x';
const WORKLET_URL = '/audio-player-worklet.js';

class AudioService {
  private attached = false;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private config: AudioConfigMessage | null = null;
  private currentSpeed = DEFAULT_PLAYBACK_SPEED;
  private startPromise: Promise<void> | null = null;

  attach(): void {
    if (this.attached) {
      return;
    }

    this.attached = true;
    runtimeSocket.onMessage((msg) => this.handleMessage(msg));
    runtimeSocket.onBinaryMessage((payload) => this.handleBinary(payload));
    runtimeSocket.onDisconnect(() => this.handleDisconnect());
  }

  async toggle(): Promise<void> {
    if (audioStore.enabled) {
      await this.disable();
      return;
    }

    await this.enable();
  }

  async enable(): Promise<void> {
    audioStore.setEnabled(true);
    await this.ensureGraph();

    if (!this.context) {
      return;
    }

    try {
      if (this.context.state !== 'running') {
        await this.context.resume();
      }
    } catch (error) {
      audioStore.setBlockedReason(`Failed to resume audio: ${String(error)}`);
      return;
    }

    const blockedReason = this.getBlockedReason();
    audioStore.setMuted(Boolean(blockedReason));
    audioStore.setBlockedReason(blockedReason);
  }

  async disable(): Promise<void> {
    audioStore.setEnabled(false);
    audioStore.setMuted(true);
    audioStore.setBlockedReason(null);
    this.resetBuffer();

    if (this.context && this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  setVolume(value: number): void {
    audioStore.setVolume(value);
    if (this.gainNode) {
      this.gainNode.gain.value = audioStore.volume;
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'audio_config':
        this.handleAudioConfig(msg);
        break;
      case 'audio_reset':
        this.resetBuffer();
        audioStore.setBlockedReason(this.getBlockedReason());
        break;
      case 'state':
        this.handleState(msg);
        break;
      default:
        break;
    }
  }

  private handleAudioConfig(msg: AudioConfigMessage): void {
    this.config = msg;
    audioStore.applyConfig(msg);
    audioStore.setAvailable(msg.enabled);

    if (!msg.enabled) {
      audioStore.setReady(false);
      audioStore.setMuted(true);
      audioStore.setBlockedReason('Runtime audio is unavailable.');
      return;
    }

    audioStore.setBlockedReason(audioStore.enabled ? this.getBlockedReason() : null);
    if (audioStore.enabled) {
      void this.enable();
    }
  }

  private handleState(msg: StateMessage): void {
    this.currentSpeed = msg.speed;
    const blockedReason = this.getBlockedReason();

    if (blockedReason) {
      audioStore.setMuted(true);
      this.resetBuffer();
    } else {
      audioStore.setMuted(!audioStore.enabled);
    }

    audioStore.setBlockedReason(audioStore.enabled ? blockedReason : null);
  }

  private handleBinary(payload: ArrayBuffer): void {
    if (!audioStore.enabled || audioStore.muted || this.getBlockedReason()) {
      return;
    }
    if (!this.node || !this.config) {
      return;
    }

    this.node.port.postMessage({ type: 'chunk', payload }, [payload]);
  }

  private handleDisconnect(): void {
    this.currentSpeed = DEFAULT_PLAYBACK_SPEED;
    this.resetBuffer();
    audioStore.setMuted(true);
    audioStore.setBlockedReason(audioStore.enabled ? 'Waiting for runtime connection.' : null);
  }

  private async ensureGraph(): Promise<void> {
    if (this.node && this.context && this.gainNode) {
      this.pushConfig();
      audioStore.setReady(true);
      audioStore.setSupported(true);
      return;
    }

    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (!this.config?.enabled) {
      audioStore.setBlockedReason('Waiting for runtime audio config.');
      return;
    }

    const AudioContextCtor = this.getAudioContextCtor();
    if (!AudioContextCtor || typeof AudioWorkletNode === 'undefined') {
      audioStore.setSupported(false);
      audioStore.setReady(false);
      audioStore.setBlockedReason('This browser does not support AudioWorklet audio playback.');
      return;
    }

    audioStore.setSupported(true);
    this.startPromise = this.startGraph(AudioContextCtor);
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startGraph(AudioContextCtor: BrowserAudioContext): Promise<void> {
    try {
      const context = new AudioContextCtor({ latencyHint: 'interactive' });
      await context.audioWorklet.addModule(WORKLET_URL);

      const node = new AudioWorkletNode(context, 'pcm-player', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      const gainNode = context.createGain();
      gainNode.gain.value = audioStore.volume;

      node.connect(gainNode);
      gainNode.connect(context.destination);

      this.context = context;
      this.node = node;
      this.gainNode = gainNode;

      this.pushConfig();
      this.resetBuffer();
      audioStore.setReady(true);
      audioStore.setMuted(false);
      audioStore.setBlockedReason(null);
    } catch (error) {
      audioStore.setReady(false);
      audioStore.setMuted(true);
      audioStore.setBlockedReason(`Failed to start audio: ${String(error)}`);
    }
  }

  private pushConfig(): void {
    if (!this.node || !this.config) {
      return;
    }

    this.node.port.postMessage({
      type: 'config',
      sourceSampleRate: this.config.sample_rate,
      channels: this.config.channels,
    });
  }

  private resetBuffer(): void {
    if (this.node) {
      this.node.port.postMessage({ type: 'reset' });
    }
  }

  private getBlockedReason(): string | null {
    if (!this.config?.enabled) {
      return 'Waiting for runtime audio config.';
    }

    const requiredSpeed = this.config.playback_speed || DEFAULT_PLAYBACK_SPEED;
    if (this.currentSpeed !== requiredSpeed) {
      return `Audio is only available at ${requiredSpeed}.`;
    }

    return null;
  }

  private getAudioContextCtor(): BrowserAudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
  }
}

export const audioService = new AudioService();