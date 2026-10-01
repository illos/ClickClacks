import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheRoll,
  historyFor,
  loadPreferences,
  loadSession,
  resetHistory,
  savePreferences,
  saveSession,
} from "../apps/site/storage";
import type { AcceptedRoll, Appearance } from "../src/client";
import { resolveRoll, type RollRequest } from "../src/dice";
const appearance: Appearance = {
  color: "#ff0000",
  ink: "#ffffff",
  pattern: "solid",
  font: "serif",
};
const request: RollRequest = {
  requestId: "a",
  dice: [{ sides: 10, count: 2 }],
  ruleset: "draw-steel/power",
};
function roll(id: string, sequence = 1): AcceptedRoll {
  return {
    id,
    sequence,
    memberId: "m",
    name: "River",
    appearance,
    request,
    result: resolveRoll(request, [7, 8]),
    acceptedAt: Date.now(),
    startsAt: Date.now() + 200,
    revealAt: Date.now() + 2200,
    source: "generated",
  };
}
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: () => null,
    length: 0,
  };
}
beforeEach(async () => {
  vi.stubGlobal("indexedDB", undefined);
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  await resetHistory();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("site storage boundaries and blocked-storage recovery", () => {
  it("strips palette metadata from clean and restored backend appearance", () => {
    expect(Object.keys(loadPreferences().appearance).sort()).toEqual([
      "color",
      "font",
      "ink",
      "pattern",
    ]);
    savePreferences({
      name: "River",
      appearance: { ...appearance, id: "old-palette-id" } as any,
      motion: "device",
      hidden: false,
      highContrast: false,
      announcements: "all",
    });
    expect(Object.keys(loadPreferences().appearance).sort()).toEqual([
      "color",
      "font",
      "ink",
      "pattern",
    ]);
  });
  it("persists preferences separately from session-scoped credentials", () => {
    const p = {
      name: "River",
      appearance,
      motion: "reduce" as const,
      hidden: true,
      highContrast: true,
      announcements: "mine" as const,
      roomId: "room-a",
    };
    savePreferences(p);
    expect(loadPreferences()).toEqual(p);
    const s = { roomId: "room-a", memberId: "m", credential: "p".repeat(36) };
    saveSession("https://one.convex.cloud", s);
    expect(loadSession("https://one.convex.cloud", "room-a")).toMatchObject(s);
    expect(loadSession("https://two.convex.cloud")).toBeUndefined();
    expect(loadSession("https://one.convex.cloud", "room-b")).toBeUndefined();
    expect(JSON.stringify(localStorage)).not.toContain("private");
  });
  it("keeps memory fallback partitioned by backend and room even when roll IDs collide", async () => {
    await cacheRoll("backend-a", "room", roll("shared"));
    await cacheRoll("backend-b", "room", roll("shared", 2));
    expect(
      (await historyFor("backend-a", "room")).map((r) => r.sequence),
    ).toEqual([1]);
    expect(
      (await historyFor("backend-b", "room")).map((r) => r.sequence),
    ).toEqual([2]);
    await cacheRoll("backend-a", "other-room", roll("shared", 3));
    expect(
      (await historyFor("backend-a", "room")).map((r) => r.sequence),
    ).toEqual([1]);
    expect(
      (await historyFor("backend-a", "other-room")).map((r) => r.sequence),
    ).toEqual([3]);
  });
  it("deduplicates same partition and sorts by sequence in memory fallback", async () => {
    await cacheRoll("a", "room", roll("later", 2));
    await cacheRoll("a", "room", roll("earlier", 1));
    await cacheRoll("a", "room", roll("earlier", 1));
    expect((await historyFor("a", "room")).map((r) => r.id)).toEqual([
      "earlier",
      "later",
    ]);
  });
  it("expires memory history after the same 30-day retention as IndexedDB", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    await cacheRoll("a", "room", roll("old"));
    vi.advanceTimersByTime(31 * 86400000);
    expect(await historyFor("a", "room")).toEqual([]);
  });
  it("rejects malformed saved sessions rather than attempting undefined-room access", () => {
    sessionStorage.setItem(
      "powerroller.session.v1",
      JSON.stringify({ backend: "a", memberId: "m", credential: "private" }),
    );
    expect(loadSession("a")).toBeUndefined();
    sessionStorage.setItem(
      "powerroller.session.v1",
      JSON.stringify({
        backend: "a",
        roomId: "room",
        memberId: "",
        credential: "",
      }),
    );
    expect(loadSession("a")).toBeUndefined();
  });
  it("validates all appearance enums and saved room identifier", () => {
    localStorage.setItem(
      "powerroller.preferences.v1",
      JSON.stringify({
        version: 1,
        preferences: {
          name: "R".repeat(100),
          appearance: {
            ...appearance,
            pattern: "not-a-pattern",
            font: "not-a-font",
          },
          roomId: { bad: true },
          motion: "invalid",
          announcements: "invalid",
        },
      }),
    );
    const p = loadPreferences();
    expect(p.name).toHaveLength(60);
    expect(["solid", "speckle", "marble", "frosted"]).toContain(
      p.appearance.pattern,
    );
    expect(["serif", "modern", "rune", "gothic"]).toContain(p.appearance.font);
    expect(p.roomId).toBeUndefined();
    expect(p.motion).toBe("device");
    expect(p.announcements).toBe("all");
  });
  it("remains usable when both browser preference stores throw", () => {
    const blocked = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    vi.stubGlobal("localStorage", blocked);
    vi.stubGlobal("sessionStorage", blocked);
    const p = loadPreferences();
    expect(p.name).toBeTruthy();
    expect(() => savePreferences(p)).not.toThrow();
    expect(() =>
      saveSession("a", {
        roomId: "room",
        memberId: "m",
        credential: "private",
      }),
    ).not.toThrow();
    expect(loadSession("a")).toBeUndefined();
  });
});
