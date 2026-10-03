import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpeechService } from '../services/speech.service';
import { AudioService } from '../services/audio.service';
import { AudioRecorderService } from '../services/audio-recorder.service';
import { ApiService } from '../services/api.service';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

@Component({
  selector: 'app-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tutor.component.html',
  styleUrl: './tutor.component.scss',
})
export class TutorComponent implements OnInit, OnDestroy {
  state: State = 'idle';
  sessionId = this.generateSessionId();
  subject: 'math' | 'english' | null = null;
  messages: any[] = [];
  userText = '';
  typedText = '';
  errorDetail = '';
  // ponytail: iOS (Safari + Chrome) has no Web Speech API — WebKit blocks it system-wide
  speechSupported = !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;
  displayText = this.speechSupported ? 'Say "hello" to start!' : 'Type below to start!';
  private speechSubscription: Subscription | null = null;
  private recordingTimer: any = null;

  constructor(
    private speech: SpeechService,
    private recorder: AudioRecorderService,
    private audio: AudioService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.speechSubscription?.unsubscribe();
    clearTimeout(this.recordingTimer);
  }

  onMicClick() {
    console.log('[TUTOR] onMicClick() called, state:', this.state);
    this.audio.unlock();
    if (this.state === 'idle') {
      this.speechSupported ? this.startListening() : this.startRecording();
    } else if (this.state === 'listening' && !this.speechSupported) {
      this.stopRecording(); // second tap stops early
    }
  }

  private startRecording() {
    this.state = 'listening';
    this.displayText = 'Listening... tap again to send!';
    this.cdr.detectChanges();
    this.recorder.start().then(() => {
      // auto-stop after 8s — enough for a child's answer
      this.recordingTimer = setTimeout(() => this.stopRecording(), 8000);
    }).catch(err => {
      console.error('[TUTOR] Recording start error:', err);
      this.state = 'idle';
      this.displayText = 'Could not access microphone. Try typing instead!';
      this.errorDetail = `mic: ${err?.message || err}`;
      this.cdr.detectChanges();
    });
  }

  private stopRecording() {
    clearTimeout(this.recordingTimer);
    const wavBlob = this.recorder.stop();
    this.state = 'thinking';
    this.displayText = 'Thinking...';
    this.cdr.detectChanges();
    this.api.transcribe(wavBlob).subscribe({
      next: (transcript: string) => {
        if (!transcript.trim()) {
          this.state = 'idle';
          this.displayText = 'Didn\'t catch that — tap the mic to try again!';
          this.cdr.detectChanges();
          return;
        }
        this.userText = transcript;
        this.onUserSpoke(transcript);
      },
      error: (err) => {
        console.error('[TUTOR] Transcription error:', err);
        this.state = 'idle';
        this.displayText = 'Couldn\'t hear you. Try again!';
        this.errorDetail = `stt: ${err?.message || err}`;
        this.cdr.detectChanges();
      }
    });
  }

  // Text fallback — works when speech recognition is unavailable (mobile Safari).
  submitTyped() {
    const text = this.typedText.trim();
    if (!text || this.state !== 'idle') return;
    this.audio.unlock(); // tap gesture — unlock mobile audio here too
    this.typedText = '';
    this.userText = text;
    this.onUserSpoke(text);
  }

  private startListening() {
    console.log('[TUTOR] startListening() called at', new Date().toISOString());
    if (this.speechSubscription) {
      console.log('[TUTOR] Cleaning up previous speech subscription');
      this.speechSubscription.unsubscribe();
    }

    this.state = 'listening';
    this.userText = '';
    this.displayText = 'Listening...';
    console.log('[TUTOR] State changed to: listening, UI should show "Listening..."');

    this.speechSubscription = this.speech.startListening().subscribe({
      next: (transcript: string) => {
        console.log('[TUTOR] next() - Got transcript:', transcript, 'at', new Date().toISOString());
        this.userText = transcript;
        this.onUserSpoke(transcript);
      },
      error: (err) => {
        console.error('[TUTOR] error() - Speech error:', err, 'at', new Date().toISOString());
        this.state = 'idle';
        const msg = err?.message || '';
        this.displayText = msg.includes('not-allowed')
          ? 'Microphone access denied. Please allow mic access and try again!'
          : 'Something went wrong. You can type instead!';
        this.errorDetail = `mic: ${msg}`;
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('[TUTOR] complete() - Speech ended at', new Date().toISOString());
        if (this.state === 'listening') {
          this.state = 'idle';
          this.displayText = 'Didn\'t catch that — tap the mic to try again!';
          this.cdr.detectChanges();
        }
      }
    });
    console.log('[TUTOR] Speech subscription created');
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
        this.errorDetail = `chat: ${err?.status || ''} ${err?.message || err}`;
        this.cdr.detectChanges();
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
        const resetToIdle = () => {
          this.state = 'idle';
          this.displayText = 'Ready to continue!';
          this.cdr.detectChanges();
        };
        // ponytail: safety valve — if onended never fires, unlock the button after 60s
        const safetyTimer = setTimeout(() => {
          console.warn('[TUTOR] Safety timeout: resetting state after 60s');
          resetToIdle();
        }, 60000);
        this.audio.playAudio(audioBlob).then(() => {
          console.log('[TUTOR] Audio playback finished');
          clearTimeout(safetyTimer);
          resetToIdle();
        }).catch((err) => {
          console.error('[TUTOR] Audio playback error:', err);
          clearTimeout(safetyTimer);
          this.errorDetail = `audio: ${err?.message || err}`;
          resetToIdle();
        });
      },
      error: (err) => {
        console.error('[TUTOR] TTS error:', err);
        this.state = 'idle';
        this.errorDetail = `tts: ${err?.status || ''} ${err?.message || err}`;
        this.cdr.detectChanges();
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
