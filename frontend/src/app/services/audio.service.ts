import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        resolve();
      };
      audio.onerror = () => {
        reject(new Error('Failed to play audio'));
      };
      audio.play();
    });
  }
}
