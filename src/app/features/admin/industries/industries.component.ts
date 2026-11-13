import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Industries (JSF sysadmin/industry.xhtml). */
@Component({
  selector: 'app-industries',
  imports: [CrudPageComponent],
  templateUrl: './industries.component.html',
  styleUrl: './industries.component.scss',
})
export class IndustriesComponent {
  config: CrudConfig = {
    title: 'Industries',
    subtitle: 'Industries (sectors) used to classify stocks',
    resource: 'industries',
    noun: 'industry',
    invalidates: ['industries'],
    columns: [
      { field: 'industryCode', header: 'Industry Code' },
      { field: 'industryName', header: 'Industry Name' },
    ],
    fields: [
      { key: 'industryCode', label: 'Industry code', type: 'text', required: true },
      { key: 'industryName', label: 'Industry name', type: 'text', required: true },
    ],
  };
}
