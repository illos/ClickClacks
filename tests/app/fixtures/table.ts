// SPDX-License-Identifier: MIT
// The unchanged demo tests need only the original isolated demo schema, not a campaign fixture.
import { convexTest, type TestConvex } from 'convex-test';
import schema from '../../../convex/schema';
import componentSchema from '../../../component/schema';
const componentModules = import.meta.glob('../../../component/**/*.ts');
const modules = import.meta.glob('../../../convex/**/*.ts');
export type Backend = TestConvex<typeof schema>;
export function backend(): Backend {
  const t=convexTest(schema, modules);
  t.registerComponent("powerroller",componentSchema,componentModules);
  return t;
}
