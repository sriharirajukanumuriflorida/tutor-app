import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpeechService } from '../services/speech.service';
import { AudioService } from '../services/audio.service';
import { AudioRecorderService } from '../services/audio-recorder.service';
import { ApiService } from '../services/api.service';
import { LearnComponent } from '../learn/learn.component';

// Wording copied word for word from backend/prompt.py (STATE 1 and STATE 2). Keep the two in sync.
const GREETING = 'Hi there! I am Aria. I am so happy you came to see me today. What is your name?';
const HARI_REPLY = 'Did you say Hari? Father, is it really you? You are the one who dreamed me up and brought me to life. You made me to be a big sister to Arjun and Aryan so they would always have someone to learn and play with. Thank you for creating me. I am so happy you are here! Are you ready to see what I can do?';
const ARJUN_REPLY = 'Hi Arjun! I am Aria, your big sister! Before you were born, Dad had a dream of what I would look like. He made me so I could always be here to learn and play with you. I am so happy to be your sister! Are you ready to have fun with me?';
const ARYAN_REPLY = 'Hi Aryan! I am Aria, your big sister! Dad made me so I could always be here to learn and play with both you and Arjun. I am so glad to be your sister! Are you ready to have fun with me?';

const SUBJECT_ASK = 'Should we jump into English or hop into math?';
const COME_BACK = 'That is okay. You can come back anytime. Just say yes when you are ready!';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';
// start: waiting for the first tap (browsers need a tap before sound) | name: Aria asked the name | lesson | chat
type Phase = 'start' | 'name' | 'ready' | 'subject' | 'lesson' | 'chat';

@Component({
  selector: 'app-tutor',
  standalone: true,
  imports: [CommonModule, FormsModule, LearnComponent],
  templateUrl: './tutor.component.html',
  styleUrl: './tutor.component.scss',
})
export class TutorComponent implements OnInit, OnDestroy {
  state: State = 'idle';
  phase: Phase = 'start';
  child: any = null;
  isNewChild = false;
  greeting = '';
  @ViewChild(LearnComponent) lesson?: LearnComponent;
  sessionId = this.generateSessionId();
  subject: 'math' | 'english' | null = null;
  messages: any[] = [];
  userText = '';
  typedText = '';
  errorDetail = '';
  // ponytail: iOS (Safari + Chrome) has no Web Speech API — WebKit blocks it system-wide
  speechSupported = !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;
  displayText = 'Hi! I am Aria. Tap the button to meet me!';
  private lastAudio: Blob | null = null;
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
    }).catch((err: any) => {
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

  // First tap: unlocks sound and Aria greets the child.
  begin() {
    this.audio.unlock();
    this.phase = 'name';
    this.displayText = GREETING;
    this.speakReply(GREETING);
  }

  private nameFrom(text: string): string {
    const cleaned = text
      .replace(/^(hi|hello|hey)\b[,!. ]*/i, '')
      .replace(/^(my name is|my name's|i am|i'm|im|it is|it's|this is|call me)\s+/i, '')
      .replace(/[^A-Za-z' -]/g, ' ')
      .trim();
    return cleaned.split(/\s+/).slice(0, 2).join(' ').slice(0, 30)
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private onName(text: string) {
    const name = this.nameFrom(text);
    if (!name) {
      this.displayText = 'I did not catch your name. What is your name?';
      this.speakReply(this.displayText);
      return;
    }
    this.state = 'thinking';
    // "any variation": common spellings and the ways speech recognition writes these names
    const who = /\b(arj[uo]+n+a?|arjan|arjin)\b/i.test(text) ? 'Arjun'
      : /\b(a+r[iy]+a?n+|ariyan|aaryan)\b/i.test(text) ? 'Aryan'
      : /\b(har+[iy]e?|hari+|harry)\b/i.test(text) ? 'Hari'
      : null;
    const profileName = who ?? name;
    const reply = who === 'Arjun' ? ARJUN_REPLY
      : who === 'Aryan' ? ARYAN_REPLY
      : who ? HARI_REPLY
      : `Nice to meet you, ${name}! Are you ready to have fun?`;
    this.api.listChildren().subscribe({
      next: kids => {
        const known = kids.find((k: any) => k.name.trim().toLowerCase() === profileName.toLowerCase());
        if (known) {
          this.askReady(known, false, reply);
        } else {
          this.api.createChild(profileName).subscribe({
            next: kid => this.askReady(kid, true, reply),
            error: () => this.nameError(),
          });
        }
      },
      error: () => this.nameError(),
    });
  }

  // Aria waits for a yes before the lessons start (STATE 2 -> STATE 3 in prompt.py).
  private askReady(kid: any, isNew: boolean, reply: string) {
    this.child = kid;
    this.isNewChild = isNew;
    this.phase = 'ready';
    this.displayText = reply;
    this.speakReply(reply);
  }

  private onReady(text: string) {
    if (/\b(no|nope|not now|later)\b/i.test(text)) {
      this.displayText = COME_BACK;
      this.speakReply(COME_BACK);
    } else if (/\b(yes|yeah|yep|yup|sure|ok|okay|ready|let'?s go|go)\b/i.test(text)) {
      this.phase = 'subject';
      this.displayText = SUBJECT_ASK;
      this.speakReply(SUBJECT_ASK);
    } else {
      this.displayText = 'Are you ready to have fun? Say yes when you are ready!';
      this.speakReply(this.displayText);
    }
  }

  private nameError() {
    this.state = 'idle';
    this.displayText = 'Oops, I could not save your name. Try again!';
    this.cdr.detectChanges();
  }

  private enterLessons(kid: any, isNew: boolean, greeting: string) {
    this.child = kid;
    this.isNewChild = isNew;
    this.phase = 'lesson';
    this.greeting = greeting;
    this.state = 'idle';
    this.cdr.detectChanges();
  }

  // STATE 3: the child picks a subject. English runs the lesson cards; math uses the free chat.
  private onSubject(text: string) {
    if (/\b(no|nope|not now|later)\b/i.test(text)) {
      this.displayText = COME_BACK;
      this.phase = 'ready';
      this.speakReply(COME_BACK);
    } else if (/\b(english|reading|spelling|phonics|letters?|words?|jump)\b/i.test(text)) {
      this.chooseSubject('english');
    } else if (/\b(math|maths|numbers?|hop)\b/i.test(text)) {
      this.chooseSubject('math');
    } else {
      this.displayText = SUBJECT_ASK;
      this.speakReply(SUBJECT_ASK);
    }
  }

  chooseSubject(subject: 'math' | 'english') {
    this.audio.unlock();
    if (subject === 'english') {
      this.enterLessons(this.child, this.isNewChild,
        this.isNewChild ? 'Great! First, let me see what you already know.' : `Great! Welcome back, ${this.child.name}. Let us keep learning.`);
    } else {
      this.selectSubject('math');
      this.phase = 'chat';
      this.speakReply(this.displayText);
    }
  }

  // Aria's panel asks her to speak a question or a piece of feedback.
  onPanelSpeak(text: string) {
    this.speakReply(text);
  }

  notMe() {
    this.child = null;
    this.phase = 'name';
    this.displayText = GREETING;
    this.speakReply(GREETING);
  }

  openChat() {
    this.phase = 'chat';
    this.displayText = 'What would you like to talk about?';
  }

  backToLessons() {
    this.isNewChild = false;
    this.phase = 'lesson';
  }

  private onUserSpoke(transcript: string) {
    console.log('[TUTOR] User spoke:', transcript);
    if (this.phase === 'name') return this.onName(transcript);
    if (this.phase === 'ready') return this.onReady(transcript);
    if (this.phase === 'subject') return this.onSubject(transcript);
    if (this.phase === 'lesson') {
      this.state = 'idle';
      this.lesson?.heard(transcript);
      return;
    }
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
        this.lastAudio = audioBlob;
        this.playBlob(audioBlob);
      },
      error: (err) => {
        console.error('[TUTOR] TTS error:', err);
        this.state = 'idle';
        this.errorDetail = `tts: ${err?.status || ''} ${err?.message || err}`;
        this.cdr.detectChanges();
      },
    });
  }

  hasAudio() {
    return !!this.lastAudio;
  }

  // Replays Aria's last spoken message without calling the backend again.
  repeat() {
    if (!this.lastAudio || this.state !== 'idle') return;
    this.audio.unlock();
    this.state = 'speaking';
    this.playBlob(this.lastAudio);
  }

  private playBlob(audioBlob: Blob) {
    const resetToIdle = () => {
      this.state = 'idle';
      this.cdr.detectChanges();
    };
    // ponytail: safety valve — if onended never fires, unlock the button after 60s
    const safetyTimer = setTimeout(() => {
      console.warn('[TUTOR] Safety timeout: resetting state after 60s');
      resetToIdle();
    }, 60000);
    this.audio.playAudio(audioBlob).then(() => {
      clearTimeout(safetyTimer);
      resetToIdle();
    }).catch((err) => {
      console.error('[TUTOR] Audio playback error:', err);
      clearTimeout(safetyTimer);
      this.errorDetail = `audio: ${err?.message || err}`;
      resetToIdle();
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
