import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[AUDIO] Creating audio element for blob size:', audioBlob.size);
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.onended = () => {
        console.log('[AUDIO] Audio playback ended');
        URL.revokeObjectURL(audio.src);
        resolve();
      };
      audio.onerror = (err) => {
        console.error('[AUDIO] Audio error:', err);
        reject(new Error('Failed to play audio'));
      };
      console.log('[AUDIO] Starting playback');
      audio.play().catch((err) => {
        console.error('[AUDIO] Play promise rejected:', err);
        reject(err);
      });
    });
  }
}
