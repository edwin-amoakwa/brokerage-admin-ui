import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/**
 * Security issuers / counterparties. Rebuilds the broken JSF pages
 * sysadmin/security-issuer.xhtml and sysadmin/issuers.xhtml (neither had a
 * backing bean) from the SecurityIssuer entity. Fixed-income securities pick
 * their issuer from this list (lookup 'security-issuers').
 */
@Component({
  selector: 'app-security-issuers',
  imports: [CrudPageComponent],
  templateUrl: './security-issuers.component.html',
  styleUrl: './security-issuers.component.scss',
})
export class SecurityIssuersComponent {
  config: CrudConfig = {
    title: 'Security Issuers',
    subtitle: 'Issuers and counterparties of fixed income securities',
    resource: 'security-issuers',
    noun: 'security issuer',
    invalidates: ['security-issuers'],
    defaults: () => ({ active: true, assetClass: 'FIXED_INCOME' }),
    columns: [
      { field: 'issuerCode', header: 'Issuer Code' },
      { field: 'issuerName', header: 'Issuer Name' },
      { field: 'initials', header: 'Initials' },
      { field: 'assetClassName', header: 'Asset Class' },
      { field: 'countryName', header: 'Country' },
      { field: 'contactPerson', header: 'Contact Person' },
      { field: 'active', header: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'issuerName', label: 'Issuer name', type: 'text', required: true, col: 8 },
      { key: 'issuerCode', label: 'Issuer code', type: 'text', col: 4, lockOnEdit: true, hint: 'Cannot be changed once saved' },
      { key: 'initials', label: 'Initials', type: 'text', col: 4 },
      { key: 'securityIssuerCode', label: 'Security issuer code', type: 'text', col: 4 },
      { key: 'assetClass', label: 'Asset class', type: 'select', enum: 'AssetClass', required: true, col: 4 },
      { key: 'countryId', label: 'Country', type: 'select', list: 'countries' },
      { key: 'contactPerson', label: 'Contact person', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea', col: 12 },
      { key: 'active', label: 'Active', type: 'checkbox' },
    ],
  };
}
