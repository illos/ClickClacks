// SPDX-License-Identifier: MIT
import { canonicalPage } from './canonical';
export default {
  fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    return canonicalPage(request) ?? env.ASSETS.fetch(request);
  },
};
