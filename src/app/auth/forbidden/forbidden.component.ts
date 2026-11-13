import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

/** 403: the route needs a page permission the user's role lacks. */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, ButtonModule],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.scss',
})
export class ForbiddenComponent {}
