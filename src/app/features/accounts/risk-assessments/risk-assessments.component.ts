import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { InvestorDetailComponent } from '../shared/investor-detail.component';

/**
 * Investor risk questionnaire (JSF accounts/investor-risks-assessments.xhtml).
 * Questions show in their view order; all answers are saved together and
 * scored, and a complete questionnaire sets the investor's risk level.
 */
@Component({
  selector: 'app-risk-assessments',
  imports: [FormsModule, ButtonModule, SelectModule, TagModule, PageHeaderComponent, EntityPickerComponent, InvestorDetailComponent, StatTilesComponent],
  templateUrl: './risk-assessments.component.html',
  styleUrl: './risk-assessments.component.scss',
})
export class RiskAssessmentsComponent {
  private api = inject(ApiService);

  picked: any = null;
  investor: any = null;
  view: any = null;
  answers: Record<string, string | null> = {};
  tiles: StatTile[] = [];
  saving = false;

  async select(picked: any) {
    this.picked = picked;
    this.investor = null;
    this.view = null;
    if (!picked) {
      return;
    }
    const [inv, view] = await Promise.all([this.api.get(`investors/${picked.id}`), this.api.get(`investor-risk-assessments/${picked.id}`)]);
    if (inv.success) {
      this.investor = inv.data;
    }
    if (view.success) {
      this.setView(view.data);
    }
  }

  private setView(view: any) {
    this.view = view;
    this.resetAnswers();
    this.tiles = [
      { label: 'Answered', value: `${view.answeredCount} of ${view.questionCount}`, format: 'text' },
      { label: 'Total Score', value: view.totalScore, format: 'number' },
      { label: 'Scored Level', value: view.scoredLevelName || '-', format: 'text' },
      { label: 'Investor Risk Level', value: view.riskLevelName || 'Not set', format: 'text', tone: view.riskLevelName ? 'ok' : 'warn' },
    ];
    if (this.investor) {
      this.investor = { ...this.investor, riskLevelName: view.riskLevelName };
    }
  }

  resetAnswers() {
    this.answers = {};
    for (const q of this.view?.questions || []) {
      this.answers[q.id] = q.answerId || null;
    }
  }

  scoreOf(q: any): number | null {
    const id = this.answers[q.id];
    const a = id ? q.answers.find((x: any) => x.id === id) : null;
    return a ? a.riskScore : null;
  }

  async save() {
    this.saving = true;
    const answers: Record<string, string> = {};
    for (const q of this.view.questions) {
      answers[q.id] = this.answers[q.id] || '';
    }
    const response = await this.api.put(`investor-risk-assessments/${this.investor.id}`, { answers });
    this.saving = false;
    if (response.success) {
      this.setView(response.data);
    }
  }
}
