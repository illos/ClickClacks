// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRoller,
  convexTransport,
  type AcceptedRoll,
  type Session,
} from "../../src/client";
import { Powerroller } from "../../src/react";
import { ColorControls } from "./color-controls";
import {
  loadPreferences,
  savePreferences,
  loadSession,
  saveSession,
  historyFor,
  cacheRoll,
  type Preferences,
} from "./storage";
import "../../src/styles.css";
import "./page.css";
const backend = import.meta.env.VITE_CONVEX_URL as string | undefined;
function Site() {
  const [prefs, setPrefs] = useState(loadPreferences),
    [roller, setRoller] = useState<ReturnType<typeof createRoller>>(),
    [history, setHistory] = useState<AcceptedRoll[]>([]),
    [error, setError] = useState("");
  const prefRef = useRef(prefs);
  prefRef.current = prefs;
  const update = (next: Preferences) => {
    setPrefs(next);
    savePreferences(next);
  };
  useEffect(() => {
    if (!backend) return;
    let disposed = false;
    const requested =
      new URLSearchParams(location.search).get("room") ??
      prefRef.current.roomId;
    const saved = loadSession(backend, requested);
    const onSession = (s: Session) => {
      if (disposed) return;
      saveSession(backend, s);
      update({ ...prefRef.current, roomId: s.roomId });
      const url = new URL(location.href);
      url.searchParams.set("room", s.roomId);
      historyFor(backend, s.roomId).then(setHistory);
      window.history.replaceState(null, "", url);
    };
    const instance = createRoller({
      transport: convexTransport(backend),
      session: saved,
      onSession,
    });
    setRoller(instance);
    const boot = async () => {
      try {
        if (saved) {
          await instance.resume();
          onSession(saved);
        } else
          await instance.join(requested, {
            name: prefRef.current.name,
            appearance: prefRef.current.appearance,
          });
      } catch (e) {
        setError(
          `${(e as Error).message} Start a new table if the saved one has expired.`,
        );
      }
    };
    void boot();
    return () => {
      disposed = true;
      void instance.dispose();
    };
  }, []);
  if (!backend)
    return (
      <main className="setup">
        <h1>Powerroller</h1>
        <p>
          The realtime backend is being connected. This site will be ready once
          deployment setup is complete.
        </p>
        <a href="https://github.com/illos/powerroller">
          Source and setup instructions
        </a>
      </main>
    );
  return (
    <>
      {roller && (
        <Powerroller
          roller={roller}
          profile={{ name: prefs.name, appearance: prefs.appearance }}
          preferences={prefs}
          history={history}
          onPreferences={(p) => update({ ...prefs, ...p })}
          onProfile={(p) => update({ ...prefs, ...p })}
          onAvailable={(r) => {
            if (roller.session)
              void cacheRoll(backend, roller.session.roomId, r);
          }}
          onJoin={async (roomId) => {
            await roller.join(roomId, {
              name: prefs.name,
              appearance: prefs.appearance,
            });
            setError("");
          }}
          renderCustomization={(p, change) => (
            <ColorControls
              color={p.appearance.color}
              ink={p.appearance.ink}
              onChange={(c) =>
                change({ ...p, appearance: { ...p.appearance, ...c } })
              }
            />
          )}
        />
      )}{" "}
      {error && (
        <aside className="setup-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              if (roller)
                void roller
                  .join(undefined, {
                    name: prefs.name,
                    appearance: prefs.appearance,
                  })
                  .then(() => setError(""))
                  .catch((e) => setError(e.message));
            }}
          >
            Start a new table
          </button>
        </aside>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Site />);
