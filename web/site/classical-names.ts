// SPDX-License-Identifier: MIT
import { defaultNames } from '../../shared/classical-names';
export function randomClassicalName() {
  return defaultNames[Math.floor(Math.random() * defaultNames.length)]!;
}
