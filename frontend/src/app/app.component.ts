import { Component } from '@angular/core';
import { TutorComponent } from './tutor/tutor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TutorComponent],
  template: '<app-tutor></app-tutor>',
  styles: [],
})
export class AppComponent {}
