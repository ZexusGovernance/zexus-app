export type Theme = 'light' | 'dark'

// Read the saved theme (defaults to dark). The initial paint is handled by an
// inline bootstrap script in app/layout.tsx; this is for in-app reads/toggles.
export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    return localStorage.getItem('zx_theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem('zx_theme', theme)
  } catch {
    /* ignore */
  }
}
