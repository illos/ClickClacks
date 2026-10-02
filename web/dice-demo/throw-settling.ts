// SPDX-License-Identifier: MIT
export class UnsettledThrowError extends Error {
  constructor() { super('This throw did not settle. Try another throw.'); }
}

/** Three total cosmetic attempts. Permanent failures retain their original cause. */
export function prepareSettledThrow<T>(prepare: () => T): T {
  let failures = 0;
  while (true) {
    try { return prepare(); }
    catch (error) {
      if (!(error instanceof UnsettledThrowError) || ++failures === 3) throw error;
    }
  }
}
