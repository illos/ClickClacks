// SPDX-License-Identifier: MIT
import { canonicalPage } from './canonical';
import {metricsRequest, injectMetrics, type MetricsEnv} from './metrics';
export default {
  async fetch(request: Request, env: MetricsEnv & { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    const redirect = canonicalPage(request);
    if (redirect) return redirect;
    try {
      const metrics = await metricsRequest(request, env, 'website');
      if (metrics) return metrics;
    } catch {return new Response(null, {status: 503, headers: {'Cache-Control': 'no-store'}});}
    return injectMetrics(request, await env.ASSETS.fetch(request));
  },
};
