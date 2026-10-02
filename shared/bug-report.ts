// SPDX-License-Identifier: MIT
export const reportStatuses = [
  "new",
  "triaged",
  "in-progress",
  "needs-info",
  "resolved",
  "duplicate",
] as const;
export type ReportStatus = (typeof reportStatuses)[number];
export type BugContext = {
  surface?:
    "roller" | "tray" | "table-menu" | "customization" | "settings" | "error" | "startup";
  selectedDice?: string | number;
  diceCount?: number;
  bonusD4?: boolean;
  edges?: number;
  banes?: number;
  joined?: boolean;
  expired?: boolean;
  participants?: number;
  connected?: boolean;
  ready?: boolean;
  pending?: boolean;
  clearing?: boolean;
  historyReady?: boolean;
  clockOffset?: number;
  clockUncertainty?: number;
  webgl?: boolean;
  theme?: string;
  motion?: string;
  sound?: boolean;
  highContrast?: boolean;
  color?: string;
  ink?: string;
  pattern?: string;
  font?: string;
  error?: string;
  recentRolls?: { faces: number[]; total?: number; modifier?: number }[];
};
export type BugDiagnostics = {
  version: 1;
  capturedAt: string;
  build: string;
  path: string;
  userAgent: string;
  language: string;
  timezone: string;
  viewport: { width: number; height: number; pixelRatio: number };
  screen: { width: number; height: number };
  touchPoints: number;
  online: boolean;
  visibility: string;
  context: BugContext;
  events: { at: number; kind: string }[];
  errors: { at: number; kind: string; source: string }[];
};
export type BugSubmission = {
  id: string;
  description: string;
  contact: string;
  diagnostics: BugDiagnostics | null;
  website: string;
};
export const reportBodyLimit = 32 * 1024;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const short = (value: unknown, max = 100) =>
  typeof value === "string" ? value.slice(0, max) : "";
const finite = (value: unknown, max = 1e12) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(-max, Math.min(max, value))
    : 0;
/** Never retain URL queries, structured request arguments or recognizable access identifiers. */
export function scrubDiagnosticText(
  value: unknown,
  secrets: readonly string[] = [],
) {
  let text = short(value, 2000);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, "[redacted]");
  return text
    .replace(/https?:\/\/[^\s)"']+/gi, "[url]")
    .replace(
      /(?:credential|token|authorization|password|secret)\s*["']?\s*[:=]\s*[^\n,}]+/gi,
      "[redacted]",
    )
    .replace(
      /\b[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\b/gi,
      "[id]",
    )
    .replace(/\b[A-HJ-NP-Z2-9]{8}\b/g, "[code]")
    .replace(/\b[a-f\d]{32,}\b/gi, "[token]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .slice(0, 500);
}
export function cleanBugContext(value: unknown): BugContext {
  const input = record(value),
    output: BugContext = {};
  for (const key of [
    "bonusD4",
    "joined",
    "expired",
    "connected",
    "ready",
    "pending",
    "clearing",
    "historyReady",
    "webgl",
    "sound",
    "highContrast",
  ] as const)
    if (typeof input[key] === "boolean") output[key] = input[key];
  for (const key of [
    "diceCount",
    "edges",
    "banes",
    "participants",
    "clockOffset",
    "clockUncertainty",
  ] as const)
    if (typeof input[key] === "number") output[key] = finite(input[key]);
  const enums = {
    surface: [
      "roller",
      "tray",
      "table-menu",
      "customization",
      "settings",
      "error",
      "startup",
    ],
    theme: ["system", "dark", "light"],
    motion: ["device", "reduce", "full"],
    pattern: ["solid", "speckle", "marble", "frosted"],
    font: ["serif", "modern", "rune", "gothic"],
  } as const;
  for (const key of Object.keys(enums) as (keyof typeof enums)[])
    if ((enums[key] as readonly unknown[]).includes(input[key]))
      Object.assign(output, { [key]: input[key] });
  if (
    ["power", "percentile", 4, 6, 8, 10, 12, 20].includes(
      input.selectedDice as never,
    )
  )
    output.selectedDice = input.selectedDice as string | number;
  for (const key of ["color", "ink"] as const)
    if (/^#[a-f\d]{6}$/i.test(short(input[key])))
      output[key] = short(input[key]);
  if (input.error) output.error = scrubDiagnosticText(input.error);
  if (Array.isArray(input.recentRolls))
    output.recentRolls = input.recentRolls.slice(0, 5).map((value) => {
      const roll = record(value);
      return {
        faces: Array.isArray(roll.faces)
          ? roll.faces
              .filter((n) => Number.isInteger(n) && n > 0 && n <= 1000)
              .slice(0, 100)
          : [],
        ...(typeof roll.total === "number"
          ? { total: finite(roll.total) }
          : {}),
        ...(typeof roll.modifier === "number"
          ? { modifier: finite(roll.modifier) }
          : {}),
      };
    });
  return output;
}
export function cleanDiagnostics(value: unknown): BugDiagnostics | null {
  if (value === null || value === undefined) return null;
  const d = record(value),
    viewport = record(d.viewport),
    screen = record(d.screen);
  const eventKinds = [
    "roll",
    "clear",
    "table-menu",
    "customization",
    "visibility",
    "online",
    "offline",
    "webgl-context-lost",
  ];
  return {
    version: 1,
    capturedAt: short(d.capturedAt, 40),
    build: short(d.build, 64).replace(/[^a-z\d._-]/gi, ""),
    path: ["/", "/web/popout/tray.html", "/pip/web/popout/tray.html"].includes(
      short(d.path),
    )
      ? short(d.path)
      : "/",
    userAgent: short(d.userAgent, 512),
    language: short(d.language, 35),
    timezone: short(d.timezone, 80),
    viewport: {
      width: finite(viewport.width, 100000),
      height: finite(viewport.height, 100000),
      pixelRatio: finite(viewport.pixelRatio, 20),
    },
    screen: {
      width: finite(screen.width, 100000),
      height: finite(screen.height, 100000),
    },
    touchPoints: finite(d.touchPoints, 100),
    online: d.online === true,
    visibility: d.visibility === "hidden" ? "hidden" : "visible",
    context: cleanBugContext(d.context),
    events: Array.isArray(d.events)
      ? d.events.slice(-50).flatMap((value) => {
          const e = record(value);
          return eventKinds.includes(short(e.kind))
            ? [{ at: finite(e.at), kind: short(e.kind) }]
            : [];
        })
      : [],
    errors: Array.isArray(d.errors)
      ? d.errors.slice(-10).map((value) => {
          const e = record(value);
          return {
            at: finite(e.at),
            kind: ["error", "unhandled-rejection", "resource-error"].includes(
              short(e.kind),
            )
              ? short(e.kind)
              : "error",
            source: scrubDiagnosticText(e.source),
          };
        })
      : [],
  };
}
export function parseSubmission(value: unknown): BugSubmission {
  const s = record(value);
  if (
    typeof s.id !== "string" ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(s.id)
  )
    throw new Error("Invalid report ID.");
  if (
    typeof s.description !== "string" ||
    !s.description.trim() ||
    s.description.length > 4000
  )
    throw new Error("Describe the issue in 1–4,000 characters.");
  if (
    s.contact !== undefined &&
    (typeof s.contact !== "string" || s.contact.length > 300)
  )
    throw new Error("Contact info must be 300 characters or fewer.");
  return {
    id: s.id,
    description: s.description.trim(),
    contact: typeof s.contact === "string" ? s.contact.trim() : "",
    diagnostics: cleanDiagnostics(s.diagnostics),
    website: short(s.website),
  };
}
