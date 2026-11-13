import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Registrars (JSF sysadmin/registrar.xhtml). */
@Component({
  selector: 'app-registrars',
  imports: [CrudPageComponent],
  templateUrl: './registrars.component.html',
  styleUrl: './registrars.component.scss',
})
export class RegistrarsComponent {
  config: CrudConfig = {
    title: 'Registrars',
    subtitle: 'Share registrars assigned to listed stocks',
    resource: 'registrars',
    noun: 'registrar',
    invalidates: ['registrars'],
    columns: [
      { field: 'registrarCode', header: 'Registrar Code' },
      { field: 'registrarName', header: 'Registrar Name' },
    ],
    fields: [
      { key: 'registrarCode', label: 'Registrar code', type: 'text', required: true },
      { key: 'registrarName', label: 'Registrar name', type: 'text', required: true },
    ],
  };
}
