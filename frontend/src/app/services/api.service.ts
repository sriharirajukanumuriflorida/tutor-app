import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = '/api'; // will be replaced by backend URL in production

  constructor(private http: HttpClient) {}

  chat(messages: any[], sessionId: string, subject?: string): Observable<any> {
    console.log('[API] Calling /chat with', messages.length, 'messages, subject:', subject);
    const payload = { messages, session_id: sessionId, subject };
    return this.http.post(`${this.baseUrl}/chat`, payload);
  }

  tts(text: string): Observable<Blob> {
    console.log('[API] Calling /tts with text length:', text.length);
    return this.http.post(`${this.baseUrl}/tts`, { text }, { responseType: 'blob' });
  }

  transcribe(audioBlob: Blob): Observable<string> {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.wav');
    return this.http.post<{ transcript: string }>(`${this.baseUrl}/transcribe`, form).pipe(
      map(r => r.transcript)
    );
  }

  getQuestion(cardId: string, index: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/curriculum/question/${cardId}/${index}`);
  }

  checkAnswer(cardId: string, index: number, answer: string, reveal = false): Observable<any> {
    return this.http.post(`${this.baseUrl}/curriculum/check`, { card_id: cardId, index, answer, reveal });
  }

  getProgress(sessionId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/progress/${sessionId}`);
  }

  listChildren(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/children`);
  }

  createChild(name: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/children`, { name });
  }

  childProgress(childId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/children/${childId}/progress`);
  }

  placementQuestion(childId: string, position: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/children/${childId}/placement/${position}`);
  }

  placementAnswer(childId: string, position: number, answer: string, misses: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/children/${childId}/placement/${position}`, { answer, misses });
  }

  nextLesson(childId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/children/${childId}/next`);
  }

  lessonAnswer(childId: string, conceptId: string, index: number, answer: string, reveal = false): Observable<any> {
    return this.http.post(`${this.baseUrl}/children/${childId}/answer`, { concept_id: conceptId, index, answer, reveal });
  }
}
