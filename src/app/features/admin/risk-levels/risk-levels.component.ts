import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Risk Levels (JSF sysadmin/risk-level.xhtml). */
@Component({
  selector: 'app-risk-levels',
  imports: [CrudPageComponent],
  templateUrl: './risk-levels.component.html',
  styleUrl: './risk-levels.component.scss',
})
export class RiskLevelsComponent {
  config: CrudConfig = {
    title: 'Risk Levels',
    subtitle: 'Investor risk levels and the questionnaire score band each one covers',
    resource: 'risk-levels',
    noun: 'risk level',
    invalidates: ['risk-levels'],
    defaults: () => ({ levelValue: 0, riskScoreFrom: 0, riskScoreTo: 0 }),
    columns: [
      { field: 'levelName', header: 'Level Name' },
      { field: 'levelValue', header: 'Level Value', type: 'number' },
      { field: 'riskScoreFrom', header: 'Risk Score From', type: 'number' },
      { field: 'riskScoreTo', header: 'Risk Score To', type: 'number' },
    ],
    fields: [
      { key: 'levelName', label: 'Level name', type: 'text', required: true },
      { key: 'levelValue', label: 'Level value', type: 'number', required: true },
      { key: 'riskScoreFrom', label: 'Risk score from', type: 'number', required: true },
      { key: 'riskScoreTo', label: 'Risk score to', type: 'number', required: true, hint: 'Bands may not overlap another level.' },
    ],
  };
}
