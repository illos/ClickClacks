// SPDX-License-Identifier: MIT
import {defineApp} from "convex/server";
import clickclacks from "../component/convex.config";
const app=defineApp();
// Keep the installed namespace so existing tables and generated host bindings remain stable.
app.use(clickclacks, {name:"powerroller"});
export default app;
