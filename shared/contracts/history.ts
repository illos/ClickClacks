// SPDX-License-Identifier: MIT
/** One die in a request: an id that survives into the result, and its side count. */
export interface DieSpec {
  id: string;
  sides: number;
}

export interface DieResult extends DieSpec {
  /** 1..sides; d10 values are already normalized to 1-10. */
  value: number;
}
