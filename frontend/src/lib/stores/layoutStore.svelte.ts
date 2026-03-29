export type ThemeKind = 'dark' | 'light';

const THEME_KEY = 'poke-theme';

function loadTheme(): ThemeKind {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

class LayoutStore {
  theme = $state<ThemeKind>(loadTheme());

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, this.theme);
    } catch {
      // ignore
    }
  }
}

export const layoutStore = new LayoutStore();
