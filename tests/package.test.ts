import { describe, expect, it, vi } from "vitest";
// A consumer can import the public core/controller/tray without React or a DOM.
vi.mock("react", () => {
  throw Error("Optional React dependency was loaded.");
});
vi.mock("react-dom", () => {
  throw Error("Optional ReactDOM dependency was loaded.");
});
import { resolveRoll } from "powerroller/dice";
import { netEdges } from "powerroller/draw-steel";
import { createRoller } from "powerroller/client";
import { createTray } from "powerroller/three";
describe("public source package entry points", () => {
  it("supports headless public imports without initializing UI or graphics", async () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
    expect(netEdges(3, 1)).toBe(1);
    expect(
      resolveRoll(
        {
          requestId: "external",
          dice: [{ sides: 6, count: 1 }],
          ruleset: "sum",
        },
        [4],
      ).total,
    ).toBe(4);
    expect(typeof createTray).toBe("function");
    const close = vi.fn();
    const roller = createRoller({
      transport: { call: vi.fn(), watch: vi.fn(), close },
    });
    expect(roller.session).toBeUndefined();
    await roller.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
});
