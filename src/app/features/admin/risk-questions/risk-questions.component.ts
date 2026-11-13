import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Investor risk-assessment questionnaire (JSF
 * sysadmin/risk-assessment-question.xhtml): ordered questions (drag to
 * reorder, saved in one call) and, per question, its answers with risk scores.
 */
@Component({
  selector: 'app-risk-questions',
  imports: [FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, TableModule, TagModule, TextareaModule, PageHeaderComponent],
  templateUrl: './risk-questions.component.html',
  styleUrl: './risk-questions.component.scss',
})
export class RiskQuestionsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  questions: any[] = [];
  loading = false;
  saving = false;
  question: any = null;
  questionVisible = false;
  managed: any = null;
  answers: any[] = [];
  answer: any = {};

  ngOnInit() {
    this.loadQuestions();
  }

  async loadQuestions() {
    this.loading = true;
    const response = await this.api.get('risk-questions');
    this.loading = false;
    if (response.success) {
      this.questions = response.data || [];
    }
  }

  createQuestion() {
    this.question = { assessmentQuestion: '' };
    this.questionVisible = true;
  }

  editQuestion(row: any) {
    this.question = { ...row };
    this.questionVisible = true;
  }

  async saveQuestion() {
    if (!this.question.assessmentQuestion?.trim()) {
      this.notify.warn('Enter the assessment question', 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.save('risk-questions', this.question);
    this.saving = false;
    if (response.success) {
      this.questionVisible = false;
      this.loadQuestions();
    }
  }

  async removeQuestion(row: any) {
    if (!(await this.notify.confirmDelete('this question and all its answers'))) {
      return;
    }
    const response = await this.api.delete(`risk-questions/${row.id}`);
    if (response.success) {
      this.loadQuestions();
    }
  }

  async saveOrder() {
    const response = await this.api.put('risk-questions/reorder', { ids: this.questions.map((q) => q.id) });
    // reload either way: on success to show new numbers, on failure to undo the drag
    this.loadQuestions();
    return response;
  }

  manage(row: any) {
    this.managed = row;
    this.clearAnswer();
    this.loadAnswers();
  }

  closeManage() {
    this.managed = null;
    this.answers = [];
    this.loadQuestions();
  }

  async loadAnswers() {
    const response = await this.api.get(`risk-questions/${this.managed.id}/answers`);
    if (response.success) {
      this.answers = response.data || [];
    }
  }

  clearAnswer() {
    this.answer = { answerDescription: '', riskScore: null };
  }

  async saveAnswer() {
    if (!this.answer.answerDescription?.trim()) {
      this.notify.warn('Enter the answer description', 'Required');
      return;
    }
    if (this.answer.riskScore === null || this.answer.riskScore === undefined || !Number.isInteger(Number(this.answer.riskScore))) {
      this.notify.warn('Enter the risk score as a whole number', 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.save(`risk-questions/${this.managed.id}/answers`, this.answer);
    this.saving = false;
    if (response.success) {
      this.clearAnswer();
      this.loadAnswers();
    }
  }

  async removeAnswer(row: any) {
    if (await this.notify.confirmDelete('this answer')) {
      const response = await this.api.delete(`risk-questions/${this.managed.id}/answers/${row.id}`);
      if (response.success) {
        if (this.answer.id === row.id) {
          this.clearAnswer();
        }
        this.loadAnswers();
      }
    }
  }
}
