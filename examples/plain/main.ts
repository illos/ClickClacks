// SPDX-License-Identifier: MIT
// No React, site CSS, URL mutation or browser persistence is required.
import { createRoller, convexTransport } from "powerroller/client";
import { createTray } from "powerroller/three";
import { formatResult } from "powerroller/dice";
export async function mountExample(
  host: HTMLElement,
  log: HTMLElement,
  url: string,
  roomId?: string,
) {
  const roller = createRoller({ transport: convexTransport(url) });
  const tray = createTray(host, {
    clock: roller.clock,
    preferences: {
      motion: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduce"
        : "full",
    },
  });
  const unsub = [
    roller.on("result.accepted", (r) =>
      tray.present({ ...r, participantId: r.memberId, style: r.appearance }),
    ),
    roller.on("result.available", (r) => {
      const item = document.createElement("p");
      item.textContent = formatResult(r.result, r.name, true);
      log.append(item);
    }),
    roller.on("clear", (id) => tray.clear(id)),
  ];
  await roller.join(roomId, {
    name: "Plain browser example",
    appearance: {
      color: "#42a5ab",
      ink: "#ecf6ff",
      pattern: "solid",
      font: "serif",
    },
  });
  return {
    roll: () =>
      roller.roll({
        requestId: crypto.randomUUID(),
        dice: [{ sides: 6, count: 3 }],
        ruleset: "sum",
      }),
    clear: () => roller.clear(),
    dispose: async () => {
      unsub.forEach((fn) => fn());
      tray.dispose();
      await roller.dispose();
    },
  };
}
