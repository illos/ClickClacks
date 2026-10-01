// SPDX-License-Identifier: MIT
import {defineApp} from "convex/server";
import powerroller from "../component/convex.config";
const app=defineApp();
app.use(powerroller);
export default app;
