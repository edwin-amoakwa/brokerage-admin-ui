import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { EditorModule } from 'primeng/editor';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Email and SMS templates per message type (JSF
 * sysadmin/messaging-templates.xhtml). The type stays attached to the
 * template being edited and is sent with every save, so saving twice no
 * longer stores a template without a type.
 */
@Component({
  selector: 'app-messaging-templates',
  imports: [FormsModule, ButtonModule, EditorModule, SelectModule, TagModule, TextareaModule, PageHeaderComponent],
  templateUrl: './messaging-templates.component.html',
  styleUrl: './messaging-templates.component.scss',
})
export class MessagingTemplatesComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  types: any[] = [];
  variables: any[] = [];
  selectedType: string | null = null;
  template: any = null;
  saving = false;

  async ngOnInit() {
    const [types, variables] = await Promise.all([this.api.get('messaging-templates'), this.api.get('messaging-templates/variables')]);
    if (types.success) {
      this.types = (types.data || []).map((t: any) => ({ ...t, label: t.messagingTemplateTypeName }));
    }
    if (variables.success) {
      this.variables = variables.data || [];
    }
  }

  async loadTemplate() {
    if (!this.selectedType) {
      this.template = null;
      return;
    }
    const response = await this.api.get(`messaging-templates/${this.selectedType}`);
    this.template = response.success ? response.data : null;
  }

  async save() {
    if (!this.template?.messagingTemplateType) {
      this.notify.warn('Select the template type', 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.put('messaging-templates', this.template);
    this.saving = false;
    if (response.success) {
      // keep editing the saved template of the same type
      this.template = response.data;
      this.types = this.types.map((t) => (t.messagingTemplateType === response.data.messagingTemplateType ? { ...t, saved: true } : t));
    }
  }
}
