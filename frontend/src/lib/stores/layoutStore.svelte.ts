export type ThemeKind = 'dark' | 'light';
export type TabId = 'play' | 'party' | 'items' | 'saves' | 'pokedex' | 'logs';

class LayoutStore {
  activeTab = $state<TabId>('play');
  theme = $state<ThemeKind>('dark');

  setTab(tab: TabId): void {
    this.activeTab = tab;
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
  }
}

export const layoutStore = new LayoutStore();
