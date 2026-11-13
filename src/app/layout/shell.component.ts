import { Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AuthService } from '../core/auth.service';
import { SessionService } from '../core/session.service';
import { MENU, MenuGroup } from './menu';

/** Admin shell: sidebar menu filtered by permission, top bar with the user menu. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  session = inject(SessionService);
  private auth = inject(AuthService);
  private router = inject(Router);

  collapsed = signal(false);
  mobileOpen = signal(false);
  openGroup = signal<string | null>(null);
  /** Menu search text; while set, the sidebar lists matching pages from every group. */
  query = signal('');

  @ViewChild('searchBox') searchBox?: ElementRef<HTMLInputElement>;

  menu = computed<MenuGroup[]>(() =>
    MENU.map((g) => ({ ...g, items: g.items.filter((i) => this.session.can(i.permission)) })).filter((g) => g.items.length > 0),
  );

  /** Pages whose label or group matches every word typed, grouped as in the menu. */
  filteredMenu = computed<MenuGroup[]>(() => {
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return [];
    }
    return this.menu()
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const text = `${i.label} ${g.label}`.toLowerCase();
          return words.every((w) => text.includes(w));
        }),
      }))
      .filter((g) => g.items.length > 0);
  });

  initials = computed(() => {
    const name: string = this.session.user()?.accountName || '';
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  });

  userItems = [
    { label: 'Change password', icon: 'pi pi-key', command: () => this.router.navigate(['/profile/change-password']) },
    { separator: true },
    { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  constructor() {
    this.syncOpenGroup(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.syncOpenGroup(e.urlAfterRedirects);
      this.mobileOpen.set(false);
    });
    this.auth.reloadProfile();
  }

  /** "/" focuses the menu search from anywhere except a text field. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      if (window.innerWidth < 992) {
        this.mobileOpen.set(true);
      } else if (this.collapsed()) {
        this.collapsed.set(false);
      }
      setTimeout(() => this.searchBox?.nativeElement.focus());
    }
  }

  openFirstMatch() {
    const first = this.filteredMenu()[0]?.items[0];
    if (first) {
      this.router.navigateByUrl(first.route);
      this.clearSearch(this.searchBox?.nativeElement);
    }
  }

  clearSearch(input?: HTMLInputElement) {
    this.query.set('');
    if (input) {
      input.value = '';
      input.blur();
    }
  }

  toggle(label: string) {
    this.openGroup.set(this.openGroup() === label ? null : label);
  }

  toggleSidebar() {
    if (window.innerWidth < 992) {
      this.mobileOpen.set(!this.mobileOpen());
    } else {
      this.collapsed.set(!this.collapsed());
    }
  }

  private syncOpenGroup(url: string) {
    const group = MENU.find((g) => g.items.some((i) => url.startsWith(i.route)));
    if (group) {
      this.openGroup.set(group.label);
    }
  }
}
