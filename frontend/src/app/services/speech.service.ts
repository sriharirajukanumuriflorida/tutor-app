import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  startListening(): Observable<string> {
    return new Observable(observer => {
      console.log('[SPEECH] startListening() called at', new Date().toISOString());

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

      if (!SpeechRecognition) {
        console.error('[SPEECH] Speech Recognition API not available on this browser');
        observer.error(new Error('Speech Recognition not supported'));
        return;
      }

      console.log('[SPEECH] Speech Recognition API available, initializing...');
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      console.log('[SPEECH] Recognition configured: lang=en-US, continuous=false, interimResults=false');

      const timeout = setTimeout(() => {
        console.warn('[SPEECH] Recognition timeout after 15s - stopping recognition');
        recognition.stop();
        if (!observer.closed) {
          observer.error(new Error('Speech recognition timeout after 15s'));
        }
      }, 15000);

      recognition.onstart = () => {
        console.log('[SPEECH] onstart - Listening started at', new Date().toISOString());
      };

      recognition.onresult = (event: any) => {
        console.log('[SPEECH] onresult - Got', event.results.length, 'results');
        clearTimeout(timeout);

        if (event.results && event.results.length > 0) {
          const transcript = event.results[0][0].transcript;
          const confidence = event.results[0][0].confidence;
          console.log('[SPEECH] Transcript:', transcript, 'Confidence:', confidence);
          observer.next(transcript);
          observer.complete();
        } else {
          console.warn('[SPEECH] No results in event');
        }
      };

      recognition.onerror = (event: any) => {
        clearTimeout(timeout);
        console.error('[SPEECH] onerror - Error type:', event.error, 'at', new Date().toISOString());
        observer.error(new Error(`Speech error: ${event.error}`));
      };

      recognition.onend = () => {
        clearTimeout(timeout);
        console.log('[SPEECH] onend - Recognition ended at', new Date().toISOString());
        if (!observer.closed) {
          observer.complete();
        }
      };

      console.log('[SPEECH] Calling recognition.start() at', new Date().toISOString());
      try {
        recognition.start();
        console.log('[SPEECH] recognition.start() succeeded');
      } catch (err) {
        console.error('[SPEECH] recognition.start() threw error:', err);
        observer.error(err);
      }

      return () => {
        console.log('[SPEECH] Cleanup - stopping recognition');
        clearTimeout(timeout);
        recognition.stop();
      };
    });
  }
}
