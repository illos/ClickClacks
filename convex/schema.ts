// SPDX-License-Identifier: MIT
import { defineSchema } from 'convex/server';
import { diceDemoTables } from './diceDemoTables';
import { diceDemoV2Tables } from './diceDemoV2Tables';
export default defineSchema({ ...diceDemoTables, ...diceDemoV2Tables });
