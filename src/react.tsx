// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { Users, Eraser, Settings, X, Copy } from "lucide-react";
import type { AcceptedRoll, Appearance, Roller, RoomView } from "./client";
import {
  validateRequest,
  formatResult,
  type RollRequest,
  type Ruleset,
} from "./dice";
import type { createTray } from "./three/index";
export type DisplayPreferences = {
  motion: "device" | "reduce" | "full";
  hidden: boolean;
  highContrast: boolean;
  announcements: "all" | "mine" | "off";
};
export type Profile = { name: string; appearance: Appearance };
export type RollerProps = {
  roller: Roller;
  profile: Profile;
  preferences: DisplayPreferences;
  history?: AcceptedRoll[];
  onPreferences: (p: DisplayPreferences) => void;
  onProfile: (p: Profile) => void;
  onAvailable?: (r: AcceptedRoll) => void;
  onJoin?: (roomId: string) => Promise<void>;
  renderCustomization?: (
    p: Profile,
    onChange: (p: Profile) => void,
  ) => React.ReactNode;
};
function Avatar({ style }: { style: Appearance }) {
  return (
    <svg
      className="dice-avatar roll-avatar"
      viewBox="0 0 32 36"
      aria-hidden="true"
    >
      <path d="M16 1 30 9 30 27 16 35 2 27 2 9Z" fill={style.color} />
      <path d="M16 1 8 12 24 12Z" fill="#fff" opacity=".25" />
      <path d="M2 9 8 12 2 27Z M24 12 30 27 16 35Z" fill="#000" opacity=".2" />
      <text x="16" y="22" textAnchor="middle" fill={style.ink}>
        0
      </text>
    </svg>
  );
}
const modes: [Ruleset, string, string][] = [
  ["draw-steel/power", "Power roll", "2d10"],
  ["draw-steel/save", "Saving throw", "1d10"],
  ["draw-steel/initiative", "Combat opening", "1d10"],
  ["draw-steel/opposed", "Opposed total", "2d10"],
  ["draw-steel/project", "Project total", "2d10"],
  ["sum", "Dice pool", "1d6"],
  ["percentile", "Percentile", "2d10"],
];
export function parseDice(input: string) {
  return input
    .replace(/\s/g, "")
    .split("+")
    .map((term, index) => {
      const match = /^(\d*)d(\d+)$/i.exec(term);
      if (!match) throw new Error("Use dice such as 2d10 + 3d6.");
      return {
        id: String(index),
        count: Number(match[1] || 1),
        sides: Number(match[2]),
      };
    });
}
function DicePreview({
  appearance,
  hidden,
  motion,
  highContrast,
}: {
  appearance: Appearance;
  hidden: boolean;
  motion: "reduce" | "full";
  highContrast: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    preview = useRef<ReturnType<typeof import("./three").createPreview> | null>(
      null,
    );
  useEffect(() => {
    let gone = false;
    if (hidden) return;
    void import("./three").then((module) => {
      if (!gone && host.current)
        preview.current = module.createPreview(host.current, appearance, {
          motion,
          highContrast,
        });
    });
    return () => {
      gone = true;
      preview.current?.dispose();
      preview.current = null;
    };
  }, [hidden]);
  useEffect(() => {
    preview.current?.update(appearance);
    preview.current?.setPreferences({ motion, highContrast });
  }, [appearance, motion, highContrast]);
  return hidden ? null : (
    <div className="dice-preview" aria-hidden="true">
      <div className="preview-canvas" ref={host} />
    </div>
  );
}
export function Powerroller(props: RollerProps) {
  const { roller, profile, preferences } = props;
  const [room, setRoom] = useState<RoomView>(),
    [status, setStatus] = useState("Connecting…"),
    [error, setError] = useState(""),
    [log, setLog] = useState<AcceptedRoll[]>(props.history ?? []),
    [busy, setBusy] = useState(false),
    [hasDice, setHasDice] = useState(false);
  const [mode, setMode] = useState<Ruleset>("draw-steel/power"),
    [expression, setExpression] = useState("2d10"),
    [characteristic, setCharacteristic] = useState(0),
    [bonus, setBonus] = useState(0),
    [edges, setEdges] = useState(0),
    [banes, setBanes] = useState(0),
    [keepMode, setKeepMode] = useState("all"),
    [keepCount, setKeepCount] = useState(2),
    [joinInput, setJoinInput] = useState(""),
    [announcement, setAnnouncement] = useState("");
  const host = useRef<HTMLDivElement>(null),
    tray = useRef<ReturnType<typeof createTray> | null>(null),
    social = useRef<HTMLDialogElement>(null),
    settings = useRef<HTMLDialogElement>(null);
  const pending = useRef<RollRequest | undefined>(undefined),
    accepted = useRef(new Map<string, AcceptedRoll>()),
    propsRef = useRef(props);
  propsRef.current = props;
  const queue = useRef<string[]>([]),
    announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
  const [deviceReduce, setDeviceReduce] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const motion =
    preferences.motion === "device"
      ? deviceReduce
        ? "reduce"
        : "full"
      : preferences.motion;
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setDeviceReduce(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setLog(props.history ?? []);
  }, [props.history]);
  function announce(text: string) {
    queue.current.push(text);
    if (announceTimer.current) return;
    const next = () => {
      setAnnouncement("");
      announceTimer.current = setTimeout(() => {
        setAnnouncement(queue.current.shift() ?? "");
        announceTimer.current = setTimeout(() => {
          announceTimer.current = undefined;
          if (queue.current.length) next();
        }, 900);
      }, 100);
    };
    next();
  }
  useEffect(() => {
    let gone = false;
    const unsubs = [
      roller.on("room", setRoom),
      roller.on("status", setStatus),
      roller.on("error", (e) => setError(e.message)),
      roller.on("clear", (owner) => {
        accepted.current.delete(owner);
        tray.current?.clear(owner);
        if (owner === roller.session?.memberId) setHasDice(false);
      }),
      roller.on("result.accepted", (r) => {
        accepted.current.set(r.memberId, r);
        tray.current?.present({
          ...r,
          participantId: r.memberId,
          style: r.appearance,
        });
        if (r.memberId === roller.session?.memberId) setHasDice(true);
      }),
      roller.on("result.available", (r) => {
        if (gone) return;
        setLog((old) =>
          old.some((x) => x.id === r.id) ? old : [...old, r].slice(-1000),
        );
        propsRef.current.onAvailable?.(r);
        const preference = propsRef.current.preferences.announcements;
        if (
          !r.historical &&
          roller.clock() - r.revealAt < 5000 &&
          preference !== "off" &&
          (preference === "all" || r.memberId === roller.session?.memberId)
        )
          announce(formatResult(r.result, r.name));
      }),
    ];
    return () => {
      gone = true;
      unsubs.forEach((fn) => fn());
      if (announceTimer.current) clearTimeout(announceTimer.current);
    };
  }, [roller]);
  useEffect(() => {
    let gone = false;
    if (preferences.hidden) {
      tray.current?.dispose();
      tray.current = null;
      return;
    }
    void import("./three/index")
      .then((module) => {
        if (gone || !host.current) return;
        const t = module.createTray(host.current, {
          clock: roller.clock,
          preferences: { motion, highContrast: preferences.highContrast },
          onStatus: (s) => {
            if (s.state === "unavailable")
              setStatus("3D unavailable · text results remain available");
          },
        });
        tray.current = t;
        for (const r of accepted.current.values())
          t.present({ ...r, participantId: r.memberId, style: r.appearance });
      })
      .catch((e) => setStatus(`3D unavailable · ${e.message}`));
    return () => {
      gone = true;
      tray.current?.dispose();
      tray.current = null;
    };
  }, [roller, preferences.hidden]);
  useEffect(() => {
    tray.current?.setPreferences({
      motion,
      hidden: preferences.hidden,
      highContrast: preferences.highContrast,
    });
  }, [motion, preferences.hidden, preferences.highContrast]);
  useEffect(() => {
    pending.current = undefined;
  }, [
    mode,
    expression,
    characteristic,
    bonus,
    edges,
    banes,
    keepMode,
    keepCount,
    room?.id,
  ]);
  const displayedRoom = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (room?.id && displayedRoom.current !== room.id) {
      if (displayedRoom.current) {
        accepted.current.clear();
        tray.current?.clear();
        setHasDice(false);
        setLog([]);
      }
      displayedRoom.current = room.id;
    }
  }, [room?.id]);
  async function perform() {
    setError("");
    setBusy(true);
    try {
      const applicable = [
        "draw-steel/power",
        "draw-steel/opposed",
        "draw-steel/project",
      ].includes(mode);
      const request = pending.current ?? {
        requestId: crypto.randomUUID(),
        dice: parseDice(expression),
        ruleset: mode,
        modifiers: {
          characteristic: applicable || mode === "sum" ? characteristic : 0,
          edges: applicable ? edges : 0,
          banes: applicable ? banes : 0,
          bonus: mode === "percentile" ? 0 : bonus,
        },
        ...(keepMode !== "all"
          ? {
              keep: {
                mode: keepMode as "highest" | "lowest",
                count: keepCount,
              },
            }
          : {}),
      };
      validateRequest(request);
      pending.current = request;
      await roller.roll(request);
      pending.current = undefined;
    } catch (e) {
      setError((e as Error).message);
      if (
        /INVALID|REQUEST_EXPIRED|REQUEST_CONFLICT|ROOM_EXPIRED|UNAUTHORIZED|RATE_LIMITED|ROOM_FULL/.test(
          String(e),
        )
      )
        pending.current = undefined;
    } finally {
      setBusy(false);
    }
  }
  async function changeProfile(next: Profile) {
    props.onProfile(next);
    try {
      await roller.profile(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const modifiable = [
    "draw-steel/power",
    "draw-steel/opposed",
    "draw-steel/project",
  ].includes(mode);
  const link = new URL(location.href);
  if (roller.session) link.searchParams.set("room", roller.session.roomId);
  return (
    <main
      className={`powerroller lab v2${preferences.highContrast ? " high-contrast" : ""}`}
    >
      <div className="roll-area">
        <header className="lab-header">
          <h1 className="power-title">Power Roller</h1>
          <button
            className="customize-trigger"
            aria-label="Customize dice"
            onClick={() => settings.current?.showModal()}
          >
            <Settings aria-hidden />
          </button>
          <button
            className="customize-trigger"
            aria-label="Open social menu"
            onClick={() => social.current?.showModal()}
          >
            <Users aria-hidden />
          </button>
        </header>
        <div className="dice-card">
          <section className="stage" aria-label="Shared 3D dice tray">
            <div className="canvas-host" ref={host} />
            <div className="stage-label">
              <span className="dot" />
              {room ? `${room.members.length} / 8 participants` : status}
            </div>
            {hasDice && (
              <button
                className="clear-tray"
                aria-label="Clear my dice"
                onClick={() => {
                  void roller
                    .clear()
                    .then(() => {
                      setHasDice(false);
                    })
                    .catch((e) => setError(e.message));
                }}
              >
                <Eraser aria-hidden />
              </button>
            )}
            {preferences.hidden && (
              <p className="fallback">
                Text-only mode · results appear in the log.
              </p>
            )}
          </section>
          <section className="controls">
            <div
              className="power-modifiers"
              role="group"
              aria-label="Modifiers for next roll"
            >
              {modifiable &&
                [
                  { name: "Edge", count: edges, set: setEdges },
                  { name: "Bane", count: banes, set: setBanes },
                ].map((x) => (
                  <div className="modifier-buttons" key={x.name}>
                    <button
                      aria-label={`${x.name}: ${x.count}. Add ${x.name.toLowerCase()}`}
                      onClick={() => x.set((v) => Math.min(2, v + 1))}
                      disabled={busy || x.count === 2}
                    >
                      {x.name === "Edge" ? "↑" : "↓"} {x.name}{" "}
                      <span className="modifier-count">{x.count}</span>
                    </button>
                    <button
                      aria-label={`Remove ${x.name.toLowerCase()}`}
                      disabled={busy || x.count === 0}
                      onClick={() => x.set((v) => Math.max(0, v - 1))}
                    >
                      −
                    </button>
                  </div>
                ))}
            </div>
            <button
              className="primary"
              style={{
                backgroundColor: preferences.highContrast
                  ? "#fff"
                  : profile.appearance.color,
                color: preferences.highContrast
                  ? "#111"
                  : profile.appearance.ink,
              }}
              disabled={busy || !room || room.expiresAt < Date.now()}
              aria-busy={busy}
              onClick={() => void perform()}
            >
              {busy ? "Rolling…" : pending.current ? "Retry roll" : "Roll"}
            </button>
          </section>
        </div>
      </div>
      <section className="track-results" aria-label="Roll log" tabIndex={0}>
        {log.length ? (
          log.map((r) => (
            <article className="roll-log-entry" key={r.id}>
              <header>
                <strong className="roll-author">
                  <Avatar style={r.appearance} />
                  <span className="roll-author-name">
                    {r.name}
                    {r.memberId === roller.session?.memberId ? " · you" : ""}
                  </span>
                </strong>
                <time dateTime={new Date(r.acceptedAt).toISOString()}>
                  {new Date(r.acceptedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <div className="roll-result-line">
                <span className="roll-equation">
                  {r.result.dice.map((d) => (
                    <span key={d.id}>
                      {d.kept ? d.value : <s>{d.value}</s>}
                    </span>
                  ))}
                </span>
                <span className="roll-outcome">
                  =<strong className="roll-total">{r.result.total}</strong>
                  {r.result.tier && (
                    <strong className={`tier tier-${r.result.tier}`}>
                      Tier {r.result.tier}
                    </strong>
                  )}
                  {r.result.success !== undefined && (
                    <span>{r.result.success ? "Success" : "Failure"}</span>
                  )}
                </span>
              </div>
              <details className="roll-details">
                <summary>
                  {r.request.context?.label ??
                    modes.find((x) => x[0] === r.request.ruleset)?.[1] ??
                    "Roll"}{" "}
                  details
                </summary>
                <p>{formatResult(r.result, r.name, true)}</p>
                <p>
                  {r.source === "supplied"
                    ? "Host-supplied result"
                    : "Server-generated result"}{" "}
                  · {r.id}
                </p>
              </details>
            </article>
          ))
        ) : (
          <p className="empty-log">Throw dice to start the log.</p>
        )}
      </section>
      <span
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={social}
        className="dice-customization social-dialog"
        aria-labelledby="social-title"
      >
        <header>
          <h2 id="social-title">Your table</h2>
          <button
            aria-label="Close social menu"
            onClick={() => social.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        <section className="connected-players">
          <h3>Connected players</h3>
          <ul>
            {room?.members.map((m) => (
              <li key={m.id}>
                <span
                  className="participant-dot"
                  style={{ background: m.appearance.color }}
                />
                {m.name}
                {m.id === roller.session?.memberId ? " · you" : ""}
              </li>
            ))}
          </ul>
        </section>
        <label className="social-name">
          Your name
          <input
            value={profile.name}
            maxLength={60}
            onChange={(e) =>
              void changeProfile({ ...profile, name: e.target.value })
            }
          />
        </label>
        <section className="menu-sharing">
          <h3>Share table</h3>
          <div className="share-field">
            <input aria-label="Table link" readOnly value={link.toString()} />
            <button
              aria-label="Copy table link"
              onClick={() =>
                void navigator.clipboard
                  .writeText(link.toString())
                  .then(() => announce("Table link copied"))
                  .catch(() =>
                    setError("Select the link and copy it manually."),
                  )
              }
            >
              <Copy aria-hidden />
            </button>
          </div>
        </section>
        <form
          className="room-join-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const id = joinInput.startsWith("http")
                ? new URL(joinInput).searchParams.get("room")
                : joinInput.trim();
              if (!id) throw new Error("Enter a table link or ID.");
              void props
                .onJoin?.(id)
                .then(() => social.current?.close())
                .catch((e) => setError(e.message));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Join another table
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              required
            />
          </label>
          <button type="submit">Join</button>
        </form>
      </dialog>
      <dialog
        ref={settings}
        className="dice-customization profile-dialog"
        aria-labelledby="settings-title"
      >
        <header>
          <h2 id="settings-title">Dice & preferences</h2>
          <button
            aria-label="Close customization"
            onClick={() => settings.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        <DicePreview
          appearance={profile.appearance}
          hidden={preferences.hidden}
          motion={motion}
          highContrast={preferences.highContrast}
        />
        <fieldset className="profile-fields">
          <legend>Next roll</legend>
          <label>
            Roll type
            <select
              value={mode}
              onChange={(e) => {
                const next = e.target.value as Ruleset;
                setMode(next);
                setExpression(modes.find((x) => x[0] === next)![2]);
                setKeepMode("all");
              }}
            >
              {modes.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dice
            <input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              aria-describedby="dice-help"
            />
          </label>
          <p id="dice-help">Use pools such as 2d10 + 3d6.</p>
          {mode !== "percentile" && (
            <>
              <label>
                Characteristic
                <input
                  type="number"
                  min={-10000}
                  max={10000}
                  value={characteristic}
                  onChange={(e) => setCharacteristic(Number(e.target.value))}
                  disabled={!modifiable && mode !== "sum"}
                />
              </label>
              <label>
                Other modifier
                <input
                  type="number"
                  min={-10000}
                  max={10000}
                  value={bonus}
                  onChange={(e) => setBonus(Number(e.target.value))}
                />
              </label>
            </>
          )}
          {["sum", "draw-steel/power", "draw-steel/opposed"].includes(mode) && (
            <>
              <label>
                Keep dice
                <select
                  value={keepMode}
                  onChange={(e) => setKeepMode(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="highest">Highest</option>
                  <option value="lowest">Lowest</option>
                </select>
              </label>
              {keepMode !== "all" && (
                <label>
                  Keep count
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={keepCount}
                    onChange={(e) => setKeepCount(Number(e.target.value))}
                  />
                </label>
              )}
            </>
          )}
        </fieldset>
        <fieldset className="profile-fields">
          <legend>Appearance</legend>
          {props.renderCustomization?.(
            profile,
            (next) => void changeProfile(next),
          ) ?? (
            <>
              <label>
                Dice color
                <input
                  type="color"
                  value={profile.appearance.color}
                  onChange={(e) =>
                    void changeProfile({
                      ...profile,
                      appearance: {
                        ...profile.appearance,
                        color: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Number color
                <input
                  type="color"
                  value={profile.appearance.ink}
                  onChange={(e) =>
                    void changeProfile({
                      ...profile,
                      appearance: {
                        ...profile.appearance,
                        ink: e.target.value,
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          <label>
            Pattern
            <select
              value={profile.appearance.pattern}
              onChange={(e) =>
                void changeProfile({
                  ...profile,
                  appearance: {
                    ...profile.appearance,
                    pattern: e.target.value as Appearance["pattern"],
                  },
                })
              }
            >
              {["solid", "speckle", "marble", "frosted"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Numbers
            <select
              value={profile.appearance.font}
              onChange={(e) =>
                void changeProfile({
                  ...profile,
                  appearance: {
                    ...profile.appearance,
                    font: e.target.value as Appearance["font"],
                  },
                })
              }
            >
              {["serif", "modern", "rune", "gothic"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <fieldset className="profile-fields">
          <legend>Local accessibility</legend>
          <label>
            Motion
            <select
              value={preferences.motion}
              onChange={(e) =>
                props.onPreferences({
                  ...preferences,
                  motion: e.target.value as DisplayPreferences["motion"],
                })
              }
            >
              <option value="device">Use device setting</option>
              <option value="reduce">Reduce motion</option>
              <option value="full">Full animation</option>
            </select>
          </label>
          <label>
            <span>Hide 3D dice</span>
            <input
              type="checkbox"
              checked={preferences.hidden}
              onChange={(e) =>
                props.onPreferences({
                  ...preferences,
                  hidden: e.target.checked,
                })
              }
            />
          </label>
          <label>
            <span>High contrast</span>
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(e) =>
                props.onPreferences({
                  ...preferences,
                  highContrast: e.target.checked,
                })
              }
            />
          </label>
          <label>
            Announcements
            <select
              value={preferences.announcements}
              onChange={(e) =>
                props.onPreferences({
                  ...preferences,
                  announcements: e.target
                    .value as DisplayPreferences["announcements"],
                })
              }
            >
              <option value="all">All rolls</option>
              <option value="mine">My rolls</option>
              <option value="off">Off</option>
            </select>
          </label>
        </fieldset>
        <footer>
          <button onClick={() => settings.current?.close()}>Done</button>
        </footer>
      </dialog>
    </main>
  );
}
