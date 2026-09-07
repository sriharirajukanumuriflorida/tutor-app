import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  startListening(): Observable<string> {
    return new Observable(observer => {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      const timeout = setTimeout(() => {
        console.warn('Speech recognition timeout after 15s');
        recognition.stop();
        if (!observer.closed) {
          observer.error(new Error('Speech recognition timeout'));
        }
      }, 15000);

      recognition.onstart = () => {
        console.log('Listening...');
      };

      recognition.onresult = (event: any) => {
        clearTimeout(timeout);
        const transcript = event.results[0][0].transcript;
        console.log('Transcript:', transcript);
        observer.next(transcript);
        observer.complete();
      };

      recognition.onerror = (event: any) => {
        clearTimeout(timeout);
        console.error('Speech error:', event.error);
        observer.error(new Error(event.error));
      };

      recognition.onend = () => {
        clearTimeout(timeout);
        console.log('Speech recognition ended');
        if (!observer.closed) {
          observer.complete();
        }
      };

      recognition.start();

      return () => {
        clearTimeout(timeout);
        recognition.stop();
      };
    });
  }
}
