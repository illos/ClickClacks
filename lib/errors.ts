// SPDX-License-Identifier: MIT
/** Transport validator diagnostics can include arguments. Never display a guest credential. */
export function displayError(error: unknown, credential?: string) {
  let message = String(error);
  if (credential) message = message.replaceAll(credential, '[private credential]');
  return message.replace(/("?credential"?\s*:\s*")[^"]*(")/gi, '$1[private credential]$2');
}
