import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';
import { MENU } from '../layout/menu';

/**
 * Requires a signed-in user, and the route's `data.permission` (a key from
 * layout/menu.ts) when it has one.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.loggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  const permission = route.data?.['permission'];
  if (permission && !session.can(permission)) {
    return router.createUrlTree(['/forbidden']);
  }
  return true;
};

/** Sends the user to the dashboard, or to the first page their role allows. */
export const landingRedirect: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const first = MENU.flatMap((g) => g.items).find((i) => session.can(i.permission));
  return router.createUrlTree([first ? first.route : '/forbidden']);
};
