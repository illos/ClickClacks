// SPDX-License-Identifier: MIT
/** Embeddable presentation settings, independent of site persistence and identity. */
export type RollerPreferences = {
  theme?: 'system' | 'light' | 'dark';
  sound?: boolean;
  selectedDice?: 'power' | 'percentile' | 4 | 6 | 8 | 10 | 12 | 20;
  motion: 'device' | 'reduce' | 'full';
  hidden: boolean;
  highContrast: boolean;
  announcements: 'all' | 'mine' | 'off';
};
