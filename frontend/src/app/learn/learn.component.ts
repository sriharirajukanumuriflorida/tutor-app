import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { AnswerInputComponent } from '../answer/answer-input.component';

type Screen = 'placement' | 'lesson' | 'progress';

const NUM_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6' };

// Placement quiz, lessons and progress for one child. Aria (the parent page) does all the speaking.
@Component({
  selector: 'app-learn',
  standalone: true,
  imports: [CommonModule, AnswerInputComponent],
  templateUrl: './learn.component.html',
  styleUrl: './learn.component.scss',
})
export class LearnComponent implements OnInit {
  @Input() child: any;
  @Input() isNew = false;
  @Input() greeting = ''; // spoken together with the first question so the two don't overlap
  @Input() locked = false; // true while Aria is talking or thinking
  @Output() speak = new EventEmitter<string>();
  @Output() notMe = new EventEmitter<void>();
  @Output() chat = new EventEmitter<void>();

  screen: Screen = 'lesson';
  error = '';
  busy = false;

  position = 0;
  misses = 0;
  placementDone = false;
  placementNext: number | null = null;

  step: any = null; // response of /next
  question: any = null;
  feedback: { correct: boolean; text: string; mastered?: boolean } | null = null;
  progress: any = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.isNew ? this.startPlacement() : this.startLesson();
  }

  private say(text: string) {
    this.speak.emit(this.greeting ? `${this.greeting} ${text}` : text);
    this.greeting = '';
  }

  private fail(msg: string) {
    this.error = msg;
    this.busy = false;
    this.cdr.detectChanges();
  }

  // ---- spoken answers from the mic (choice questions only; spelling must be typed) ----
  heard(text: string) {
    if (this.busy || this.feedback || !this.question || this.screen === 'progress') return;
    const options: string[] | null = this.question.options;
    if (!options?.length) {
      this.speak.emit('Please type the spelling in the box.');
      return;
    }
    const said = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').map(w => NUM_WORDS[w] ?? w).join(' ');
    const hit = [...options]
      .sort((a, b) => b.length - a.length)
      .find(o => new RegExp(`(^| )${o.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()}( |$)`).test(said.replace(/\s+/g, ' ')));
    if (!hit) {
      this.speak.emit('I did not catch that. Tap an answer, or say it again.');
      return;
    }
    this.screen === 'placement' ? this.submitPlacement(hit) : this.submitLesson(hit);
  }

  // ---- placement ----
  startPlacement() {
    this.screen = 'placement';
    this.position = 0;
    this.misses = 0;
    this.loadPlacement();
  }

  private loadPlacement() {
    this.feedback = null;
    this.busy = true;
    this.api.placementQuestion(this.child.id, this.position).subscribe({
      next: q => { this.question = q; this.busy = false; this.say(q.speech); this.cdr.detectChanges(); },
      error: () => this.fail('Could not load the question.'),
    });
  }

  submitPlacement(answer: string) {
    if (this.busy) return;
    this.busy = true;
    this.api.placementAnswer(this.child.id, this.position, answer, this.misses).subscribe({
      next: r => {
        this.misses = r.misses;
        this.feedback = { correct: r.correct, text: r.display };
        this.placementDone = r.done;
        this.placementNext = r.next_position;
        this.busy = false;
        this.say(r.speech);
        this.cdr.detectChanges();
      },
      error: () => this.fail('Could not check the answer.'),
    });
  }

  afterPlacement() {
    if (this.placementDone) {
      this.startLesson();
    } else {
      this.position = this.placementNext ?? this.position + 1;
      this.loadPlacement();
    }
  }

  // ---- lessons ----
  startLesson() {
    this.screen = 'lesson';
    this.placementDone = false;
    this.loadNext();
  }

  loadNext() {
    this.feedback = null;
    this.busy = true;
    this.api.nextLesson(this.child.id).subscribe({
      next: s => {
        this.step = s;
        this.question = s.done ? null : s.question;
        this.busy = false;
        this.say(s.speech);
        this.cdr.detectChanges();
      },
      error: () => this.fail('Could not load the next lesson.'),
    });
  }

  submitLesson(answer: string, reveal = false) {
    if (this.busy || !this.step || this.step.done) return;
    this.busy = true;
    this.api.lessonAnswer(this.child.id, this.step.concept.id, this.question.index, answer, reveal).subscribe({
      next: r => {
        this.feedback = { correct: r.correct, text: r.display, mastered: r.mastered };
        this.busy = false;
        this.say(r.speech);
        this.cdr.detectChanges();
      },
      error: () => this.fail('Could not check the answer.'),
    });
  }

  // "show me the word" counts as a miss
  showMe() {
    this.submitLesson('', true);
  }

  get canReveal() {
    return this.screen === 'lesson' && !this.feedback && this.question?.hide_answer;
  }

  // ---- progress ----
  openProgress() {
    this.screen = 'progress';
    this.api.childProgress(this.child.id).subscribe({
      next: p => { this.progress = p; this.cdr.detectChanges(); },
      error: () => this.fail('Could not load progress.'),
    });
  }

  get pct() {
    return this.progress?.total ? Math.round((100 * this.progress.mastered) / this.progress.total) : 0;
  }
}
