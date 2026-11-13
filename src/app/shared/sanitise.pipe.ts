import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Trusts a resource URL (the PDF data URL in the report viewer). From astra-app. */
@Pipe({ name: 'sanitise', pure: true })
export class SanitizerPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: any) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(value);
  }
}
