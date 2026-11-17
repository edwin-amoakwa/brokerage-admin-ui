import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { statusSeverity } from './accounts-common';
import { InvestorDetailComponent } from './investor-detail.component';

/**
 * The investor register table, replacing <brokerage:investorList>: keyword
 * search, "showing x of y", row expansion with the read-only detail card,
 * and optional edit / delete row buttons. Paged on the server (the JSF table
 * loaded every investor into the session and filtered in memory).
 *
 *   <app-investor-table status="PENDING" editLabel="Process" (edit)="open($event)" />
 */
@Component({
  selector: 'app-investor-table',
  imports: [FormsModule, ButtonModule, InputTextModule, TableModule, TagModule, DatePipe, InvestorDetailComponent],
  templateUrl: './investor-table.component.html',
  styleUrl: './investor-table.component.scss',
})
export class InvestorTableComponent implements OnChanges {
  private api = inject(ApiService);

  /** VERIFIED, PENDING, INCOMPLETE or empty for all. */
  @Input() status = '';
  @Input() showSearch = true;
  @Input() showExpansion = true;
  @Input() searchPlaceholder = 'Search name, code, email, phone or ID number';
  @Input() emptyMessage = 'No investors found.';
  @Input() pageSize = 10;
  /** Search text to start with (a deep link); later typing replaces it. */
  @Input() set initialKeyword(value: string | null | undefined) {
    if (value) {
      this.keyword = value;
    }
  }
  @Input() showEdit = false;
  @Input() showDelete = false;
  @Input() editLabel = '';
  @Input() editIcon = 'pi pi-pencil';
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  /** Emits the total after each load. */
  @Output() loaded = new EventEmitter<number>();

  keyword = '';
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  private lastEvent: any = { first: 0, rows: 10 };
  private initialised = false;

  get colspan() {
    return 5 + (this.showExpansion ? 1 : 0) + (this.showEdit || this.showDelete ? 1 : 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['status'] && this.initialised) {
      this.reload();
    }
  }

  severity(style: string) {
    return statusSeverity(style);
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  /** Reload the current page (after an edit or delete). */
  refresh() {
    this.load(this.lastEvent);
  }

  /**
   * Every investor matching the current status and search keyword, fetched
   * page by page (for exports). Resolves null when any page fails.
   */
  async fetchAll(pageSize = 500): Promise<any[] | null> {
    const all: any[] = [];
    for (let pageNo = 1; ; pageNo++) {
      const response = await this.api.get('investors', { keyword: this.keyword, status: this.status, pageNo, pageSize });
      if (!response.success) {
        return null;
      }
      const page: any[] = response.data || [];
      all.push(...page);
      const total = response.pager?.totalRecords ?? all.length;
      if (page.length === 0 || all.length >= total) {
        return all;
      }
    }
  }

  async load(event: any) {
    this.initialised = true;
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('investors', { keyword: this.keyword, status: this.status, ...pageParams(event, this.pageSize) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
      this.loaded.emit(this.total);
    }
  }
}
