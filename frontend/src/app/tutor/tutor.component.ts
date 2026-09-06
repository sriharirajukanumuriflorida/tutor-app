import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class TutorComponent implements OnInit {
  state: State = 'idle';
  sessionId = this.generateSessionId();
  subject: 'math' | 'english' | null = null;
  messages: any[] = [];
  displayText = 'Say "hello my teaching friend" to start!';
  userText = '';

  constructor(
    private speech: SpeechService,
    private audio: AudioService,
    private api: ApiService
  ) {}

  ngOnInit() {}

  onMicClick() {
    if (this.state === 'idle') {
      this.startListening();
    }
  }

  private startListening() {
    this.state = 'listening';
    this.userText = '';
    this.displayText = 'Listening...';

    this.speech.startListening().subscribe({
      next: (transcript: string) => {
        this.userText = transcript;
        this.onUserSpoke(transcript);
      },
      error: (err) => {
        console.error('Speech error:', err);
        this.state = 'idle';
        this.displayText = 'Sorry, I didn\'t catch that. Try again!';
      },
    });
  }

  private onUserSpoke(transcript: string) {
    this.state = 'thinking';
    this.displayText = 'Thinking...';

    const newMessage = { role: 'user', content: transcript };
    const allMessages = [...this.messages, newMessage];

    this.api.chat(allMessages, this.sessionId, this.subject || undefined).subscribe({
      next: (response: any) => {
        const reply = response.reply;
        this.messages = allMessages.concat([{ role: 'assistant', content: reply }]);
        this.displayText = reply;
        this.speakReply(reply);
      },
      error: (err) => {
        console.error('Chat error:', err);
        this.state = 'idle';
        this.displayText = 'Oops, something went wrong. Try again!';
      },
    });
  }

  private speakReply(text: string) {
    this.state = 'speaking';
    this.api.tts(text).subscribe({
      next: (audioBlob: Blob) => {
        this.audio.playAudio(audioBlob).then(() => {
          this.state = 'idle';
          this.displayText = 'Ready to continue!';
        });
      },
      error: (err) => {
        console.error('TTS error:', err);
        this.state = 'idle';
        this.displayText = 'Audio playback failed. Try again!';
      },
    });
  }

  selectSubject(subject: 'math' | 'english') {
    this.subject = subject;
    this.displayText = `Great! Let's learn ${subject}. Say anything to continue!`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
