import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Teams (desks) that support cases are routed to (JSF sysadmin/case-teams.xhtml). */
@Component({
  selector: 'app-case-teams',
  imports: [CrudPageComponent],
  templateUrl: './case-teams.component.html',
  styleUrl: './case-teams.component.scss',
})
export class CaseTeamsComponent {
  config: CrudConfig = {
    title: 'Case Teams',
    subtitle: 'The desks support cases are routed to, with who picks up new cases',
    resource: 'case-teams',
    noun: 'team',
    invalidates: ['case-teams'],
    defaults: () => ({ active: true }),
    columns: [
      { field: 'teamCode', header: 'Code' },
      { field: 'teamName', header: 'Team Name' },
      { field: 'defaultAssigneeName', header: 'Default Assignee' },
      { field: 'teamLeadName', header: 'Team Lead' },
      { field: 'active', header: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'teamCode', label: 'Code', type: 'text', required: true },
      { key: 'teamName', label: 'Team name', type: 'text', required: true },
      { key: 'defaultAssigneeId', label: 'Default assignee', type: 'select', list: 'users', hint: 'Owns new cases routed to this team. Leave empty for nobody.' },
      { key: 'teamLeadId', label: 'Team lead', type: 'select', list: 'users' },
      { key: 'active', label: 'Active', type: 'checkbox' },
    ],
  };
}
