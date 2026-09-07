import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SpeechService } from '../services/speech.service';
import { AudioService } from '../services/audio.service';
import { ApiService } from '../services/api.service';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

@Component({
  selector: 'app-tutor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutor.component.html',
  styleUrl: './tutor.component.scss',
})
export class TutorComponent implements OnInit, OnDestroy {
  state: State = 'idle';
  sessionId = this.generateSessionId();
  subject: 'math' | 'english' | null = null;
  messages: any[] = [];
  displayText = 'Say "hello" to start!';
  userText = '';
  private speechSubscription: Subscription | null = null;

  constructor(
    private speech: SpeechService,
    private audio: AudioService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
    }
  }

  onMicClick() {
    console.log('[TUTOR] onMicClick() called, state:', this.state);
    if (this.state === 'idle') {
      console.log('[TUTOR] State is idle, starting to listen');
      this.startListening();
    } else {
      console.warn('[TUTOR] onMicClick but state is NOT idle:', this.state);
    }
  }

  private startListening() {
    console.log('[TUTOR] Starting to listen...');
    if (this.speechSubscription) {
      console.log('[TUTOR] Cleaning up previous speech subscription');
      this.speechSubscription.unsubscribe();
    }

    this.state = 'listening';
    this.userText = '';
    this.displayText = 'Listening...';

    this.speechSubscription = this.speech.startListening().subscribe({
      next: (transcript: string) => {
        console.log('[TUTOR] Got transcript:', transcript);
        this.userText = transcript;
        this.onUserSpoke(transcript);
      },
      error: (err) => {
        console.error('[TUTOR] Speech error:', err);
        this.state = 'idle';
        this.displayText = 'Sorry, I didn\'t catch that. Try again!';
      },
      complete: () => {
        console.log('[TUTOR] Speech subscription completed');
      }
    });
  }

  private onUserSpoke(transcript: string) {
    console.log('[TUTOR] User spoke:', transcript);
    this.state = 'thinking';
    this.displayText = 'Thinking...';

    const newMessage = { role: 'user', content: transcript };
    const allMessages = [...this.messages, newMessage];
    console.log('[TUTOR] Sending to chat API. Subject:', this.subject, 'Messages count:', allMessages.length);

    this.api.chat(allMessages, this.sessionId, this.subject || undefined).subscribe({
      next: (response: any) => {
        console.log('[TUTOR] Chat response received:', response.reply);
        const reply = response.reply;
        this.messages = allMessages.concat([{ role: 'assistant', content: reply }]);
        this.displayText = reply;
        this.speakReply(reply);
      },
      error: (err) => {
        console.error('[TUTOR] Chat error:', err);
        this.state = 'idle';
        this.displayText = 'Oops, something went wrong. Try again!';
      },
    });
  }

  private speakReply(text: string) {
    console.log('[TUTOR] Speaking reply (first 100 chars):', text.substring(0, 100));
    this.state = 'speaking';
    console.log('[TUTOR] State changed to: speaking');
    this.api.tts(text).subscribe({
      next: (audioBlob: Blob) => {
        console.log('[TUTOR] TTS audio received, blob size:', audioBlob.size, 'bytes');
        this.audio.playAudio(audioBlob).then(() => {
          console.log('[TUTOR] Audio playback finished, current state:', this.state);
          setTimeout(() => {
            console.log('[TUTOR] NOW resetting state to idle, current state before:', this.state);
            this.state = 'idle';
            console.log('[TUTOR] State now:', this.state, '- Button should be enabled!');
            this.displayText = 'Ready to continue!';
            this.cdr.detectChanges();
            console.log('[TUTOR] Change detection triggered');
          }, 500);
        }).catch((err) => {
          console.error('[TUTOR] Audio playback error:', err);
          this.state = 'idle';
          console.log('[TUTOR] State reset to idle due to error');
          this.displayText = 'Audio playback failed. Try again!';
        });
      },
      error: (err) => {
        console.error('[TUTOR] TTS error:', err);
        this.state = 'idle';
        console.log('[TUTOR] State reset to idle due to TTS error');
        this.displayText = 'Audio playback failed. Try again!';
      },
    });
  }

  selectSubject(subject: 'math' | 'english') {
    console.log('[TUTOR] Subject selected:', subject);
    this.subject = subject;
    this.displayText = `Great! Let's learn ${subject}. Say anything to continue!`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
