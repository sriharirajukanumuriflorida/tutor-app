import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = '/api'; // will be replaced by backend URL in production

  constructor(private http: HttpClient) {}

  chat(messages: any[], sessionId: string, subject?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/chat`, {
      messages,
      session_id: sessionId,
      subject,
    });
  }

  tts(text: string): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/tts`, { text }, { responseType: 'blob' });
  }

  getProgress(sessionId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/progress/${sessionId}`);
  }
}
