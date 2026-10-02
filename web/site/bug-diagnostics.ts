// SPDX-License-Identifier: MIT
import {
  cleanDiagnostics,
  type BugContext,
  type BugDiagnostics,
} from "../../shared/bug-report";
const events: BugDiagnostics["events"] = [];
const errors: BugDiagnostics["errors"] = [];
const names: Record<string, string> = {
  Roll: "roll",
  "Roll dice": "roll",
  "Throw dice": "roll",
  "Clear dice": "clear",
  "Clear tray": "clear",
  "Open social menu": "table-menu",
  "Open tray settings": "table-menu",
  "Customize dice": "customization",
};
const sourceLocation = (value: string, line = 0, column = 0) => {
  try {
    const url = new URL(value, location.origin);
    return `${
      url.pathname
        .split("/")
        .pop()
        ?.replace(/[^a-z\d._-]/gi, "")
        .slice(0, 100) ?? "app"
    }:${line}:${column}`;
  } catch {
    return "app";
  }
};
/** Bounded semantic metadata only: no input values, network arguments, messages or storage dumps. */
export function installBugDiagnostics() {
  const event = (kind: string) => {
    events.push({ at: Date.now(), kind });
    if (events.length > 50) events.shift();
  };
  const click = (e: Event) => {
    const label = (e.target as Element | null)
      ?.closest?.("button")
      ?.getAttribute("aria-label");
    if (label && names[label]) event(names[label]);
  };
  const visibility = () => event("visibility"),
    online = () => event("online"),
    offline = () => event("offline"),
    lost = () => event("webgl-context-lost");
  const error = (e: Event) => {
    const value = e as ErrorEvent;
    errors.push({
      at: Date.now(),
      kind: e instanceof ErrorEvent ? "error" : "resource-error",
      source: sourceLocation(value.filename || "", value.lineno, value.colno),
    });
    if (errors.length > 10) errors.shift();
  };
  const rejection = () => {
    errors.push({ at: Date.now(), kind: "unhandled-rejection", source: "app" });
    if (errors.length > 10) errors.shift();
  };
  document.addEventListener("click", click, true);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("webglcontextlost", lost, true);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  window.addEventListener("error", error, true);
  window.addEventListener("unhandledrejection", rejection);
  return () => {
    document.removeEventListener("click", click, true);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("webglcontextlost", lost, true);
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    window.removeEventListener("error", error, true);
    window.removeEventListener("unhandledrejection", rejection);
  };
}
export function captureBugDiagnostics(context: BugContext): BugDiagnostics {
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* Unsupported Intl. */
  }
  const cutoff = Date.now() - 300000;
  return cleanDiagnostics({
    version: 1,
    capturedAt: new Date().toISOString(),
    build: import.meta.env.VITE_BUILD_COMMIT ?? "development",
    path: location.pathname,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      pixelRatio: devicePixelRatio,
    },
    screen: { width: screen.width, height: screen.height },
    touchPoints: navigator.maxTouchPoints,
    online: navigator.onLine,
    visibility: document.visibilityState,
    context,
    events: events.filter((e) => e.at >= cutoff),
    errors: errors.filter((e) => e.at >= cutoff),
  })!;
}
