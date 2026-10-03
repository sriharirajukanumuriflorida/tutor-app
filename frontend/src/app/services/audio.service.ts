import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  // ponytail: reuse ONE element so mobile keeps the user-activation.
  // A fresh `new Audio()` per reply loses it and iOS/Android block play().
  private audio = new Audio();
  private unlocked = false;

  // Call inside a real user gesture (tap) to unlock mobile autoplay.
  // ponytail: iOS rejects play() on empty src — use a silent WAV data URI so the unlock actually sticks.
  private readonly SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.audio.src = this.SILENT_WAV;
    this.audio.play().then(() => this.audio.pause()).catch(() => {});
  }

  playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(audioBlob);
      console.log('[AUDIO] Playing blob size:', audioBlob.size);
      this.audio.src = url;
      this.audio.onended = () => {
        console.log('[AUDIO] onended fired');
        URL.revokeObjectURL(url);
        resolve();
      };
      this.audio.onerror = (e) => {
        console.error('[AUDIO] onerror fired:', e);
        URL.revokeObjectURL(url);
        reject(new Error('audio element error'));
      };
      this.audio.play()
        .then(() => console.log('[AUDIO] play() resolved — audio started'))
        .catch((err) => {
          console.error('[AUDIO] play() rejected:', err);
          reject(err);
        });
    });
  }
}
