import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Pick-one buttons + Submit when the question has options, otherwise a typed box + Submit.
@Component({
  selector: 'app-answer-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="choices" *ngIf="options?.length; else typed">
      <button type="button" class="choice" *ngFor="let o of options"
              [class.selected]="o === selected" [disabled]="disabled" (click)="selected = o">
        {{ o }}
      </button>
      <button type="button" class="submit" [disabled]="disabled || !selected" (click)="send(selected!)">
        Submit
      </button>
    </div>
    <ng-template #typed>
      <form class="typed" (ngSubmit)="send(text)">
        <input name="answer" [(ngModel)]="text" [disabled]="disabled" placeholder="Type your answer" autocomplete="off" />
        <button type="submit" class="submit" [disabled]="disabled || !text.trim()">Submit</button>
      </form>
    </ng-template>
  `,
  styles: [`
    .choices, .typed { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .choice { min-height: 48px; min-width: 64px; font-size: 1.2rem; padding: 12px 18px; border-radius: 12px; border: 2px solid #8aa; background: #fff; cursor: pointer; }
    .choice.selected { background: #cfe8ff; border-color: #2a7de1; font-weight: 600; }
    .submit { min-height: 48px; font-size: 1.1rem; padding: 12px 22px; border-radius: 12px; border: 0; background: #2a9d4b; color: #fff; cursor: pointer; }
    .submit:disabled, .choice:disabled { opacity: 0.5; cursor: default; }
    input { min-height: 48px; max-width: 100%; font-size: 1.2rem; padding: 10px; border-radius: 10px; border: 2px solid #8aa; }
  `],
})
export class AnswerInputComponent {
  @Input() options: string[] | null = null;
  @Input() disabled = false;
  @Output() submitted = new EventEmitter<string>();
  selected: string | null = null;
  text = '';

  send(value: string) {
    this.submitted.emit(value.trim());
    this.selected = null;
    this.text = '';
  }
}
