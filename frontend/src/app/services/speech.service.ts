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

      recognition.onstart = () => {
        console.log('Listening...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        observer.next(transcript);
        observer.complete();
      };

      recognition.onerror = (event: any) => {
        observer.error(new Error(event.error));
      };

      recognition.onend = () => {
        if (!observer.closed) {
          observer.complete();
        }
      };

      recognition.start();

      return () => {
        recognition.stop();
      };
    });
  }
}
