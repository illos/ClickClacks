// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react';
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ColorTheme = 'light' | 'dark';
export function systemColorTheme(): ColorTheme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
/** Device changes affect only System; explicit choices stay fixed. */
export function useColorTheme(choice: ThemeChoice = 'system'): ColorTheme {
  const [system, setSystem] = useState(systemColorTheme);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(query.matches ? 'dark' : 'light');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return choice === 'system' ? system : choice;
}
export function applyDocumentTheme(theme: ColorTheme, target: Document = document) {
  target.documentElement.dataset.theme = theme;
  target.documentElement.style.colorScheme = theme;
  target.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f1eb' : '#111415');
}
