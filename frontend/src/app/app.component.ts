import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DecisionStudioComponent } from './features/decision-studio/decision-studio.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DecisionStudioComponent],
  template: `
    <main>
      <app-decision-studio></app-decision-studio>
    </main>
  `
})
export class AppComponent {
  title = 'NexusOptima Decision Studio';
}
