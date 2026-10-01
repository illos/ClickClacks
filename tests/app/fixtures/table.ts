// SPDX-License-Identifier: MIT
// The unchanged demo tests need only the original isolated demo schema, not a campaign fixture.
import { convexTest, type TestConvex } from 'convex-test';
import schema from '../../../convex/schema';
const modules = import.meta.glob('../../../convex/**/*.ts');
export type Backend = TestConvex<typeof schema>;
export function backend(): Backend {
  return convexTest(schema, modules);
}
