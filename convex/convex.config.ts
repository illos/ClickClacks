import { defineApp } from "convex/server";
import powerroller from "../src/component/convex.config.js";
const app = defineApp();
app.use(powerroller);
export default app;
