// SPDX-License-Identifier: MIT
import { ConvexError } from 'convex/values';
export type AuthorityErrorCode = 'REQUEST_EXPIRED' | 'CONFLICT' | 'UNAUTHORIZED' | 'ROOM_EXPIRED' | 'INVALID_REQUEST';
/** Permanent request failures carry a stable code while retaining the original friendly message. */
export function authorityError(code: AuthorityErrorCode, message: string) {
  return new ConvexError({code,message});
}
