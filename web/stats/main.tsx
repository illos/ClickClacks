// SPDX-License-Identifier: MIT
import {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ConvexReactClient, useConvexAuth} from "convex/react";
import {ConvexAuthProvider, useAuthActions, useAuthToken} from "@convex-dev/auth/react";
import type {StatsPeriod, StatsSnapshot, TrafficStats} from "../../shared/stats";
import wordmark from "../branding/click-clacks.svg";
import "./style.css";

const number = (n: number) => new Intl.NumberFormat().format(n);
function duration(ms: number) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
const periods: {value: StatsPeriod; label: string}[] = [
  {value: "day", label: "Today"}, {value: "month", label: "This month"}, {value: "all", label: "All time"},
];
function SignIn() {
  const {signIn} = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="login"><p className="eyebrow">Project activity</p><h1>Click Clacks stats</h1>
    <p>Website traffic and anonymous multiplayer activity.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const data = new FormData(event.currentTarget); data.set("flow", flow);
      try {await signIn("password", data);}
      catch {setError(flow === "signUp" ? "Could not create this account. Try signing in, or use a different email." : "Could not sign in. Check your email and password.");}
      finally {setBusy(false);}
    }}>
      <h2>{flow === "signIn" ? "Sign in" : "Create an account"}</h2>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required minLength={8} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}</button>
      <button type="button" disabled={busy} onClick={() => {setFlow(flow === "signIn" ? "signUp" : "signIn"); setError("");}}>
        {flow === "signIn" ? "Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  </main>;
}
function Card({label, value, note}: {label: string; value: string; note?: string}) {
  return <div className="card"><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}
function Countries({stats, label}: {stats: TrafficStats; label: string}) {
  const names = new Intl.DisplayNames(["en"], {type: "region"});
  return <section className="panel"><h2>{label} countries</h2><p className="muted">Share of visits by connection country.</p>
    {stats.countries.length ? <table><thead><tr><th>Country</th><th>Visits</th><th>Share</th></tr></thead>
      <tbody>{stats.countries.map(row => <tr key={row.country}><td>{row.country === "XX" ? "Unknown" : names.of(row.country) ?? row.country}</td>
        <td>{number(row.visits)}</td><td>{stats.visits ? Math.round(100 * row.visits / stats.visits) : 0}%</td></tr>)}</tbody>
    </table> : <p className="empty">No visits recorded yet.</p>}
  </section>;
}
function Dashboard() {
  const token = useAuthToken();
  const {signOut} = useAuthActions();
  const [period, setPeriod] = useState<StatsPeriod>("day");
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<StatsSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    setLoading(true); setError("");
    void fetch(`/api/stats?period=${period}`, {headers: {Authorization: `Bearer ${token}`}, signal: abort.signal})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load stats.");
        if (!abort.signal.aborted) setSnapshot(data);
      }).catch(error => {if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "Could not load stats.");})
      .finally(() => {if (!abort.signal.aborted) setLoading(false);});
    return () => abort.abort();
  }, [token, period, refresh]);
  const data = snapshot?.period === period ? snapshot : undefined;
  const game = data?.gameplay;
  const max = Math.max(1, ...data?.daily.flatMap(point => [point.website, point.app]) ?? []);
  return <main><header><div><p className="eyebrow">Project activity</p><h1>Click Clacks stats</h1></div>
    <button onClick={() => void signOut()}>Sign out</button></header>
    <div className="toolbar"><nav aria-label="Stats period">{periods.map(option => <button key={option.value} aria-pressed={period === option.value}
      onClick={() => setPeriod(option.value)}>{option.label}</button>)}</nav><button disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {data && game ? <>
      <section aria-labelledby="traffic-title"><h2 id="traffic-title">Visitors</h2><div className="cards">
        <Card label="Website visitors" value={number(data.traffic.website.visitors)} note={`${number(data.traffic.website.visits)} visits`} />
        <Card label="App visitors" value={number(data.traffic.app.visitors)} note={`${number(data.traffic.app.visits)} visits`} />
        <Card label="Multiplayer tables" value={number(game.multiplayerTables)} note="Tables with 2+ connected players" />
        <Card label="Player arrivals" value={number(game.playerArrivals)} note="Arrivals into multiplayer sessions" />
      </div></section>
      <section aria-labelledby="play-title"><h2 id="play-title">Multiplayer activity</h2><div className="cards">
        <Card label="Sessions started" value={number(game.sessionsStarted)} note={`${number(game.sessionsCompleted)} completed`} />
        <Card label="Average session" value={game.sessionsCompleted ? duration(game.completedMs / game.sessionsCompleted) : "—"} note="Completed sessions" />
        <Card label="Peak table size" value={number(game.peakPlayers)} note="Connected players at one table" />
        <Card label="Total multiplayer time" value={duration(game.multiplayerMs)} note={game.multiplayerMs ? `${(game.playerMs / game.multiplayerMs).toFixed(1)} players on average` : "Time with 2+ connected players"} />
      </div></section>
      <section className="panel"><div className="chart-title"><h2>Visits over the last 30 days</h2><p><span className="dot website" />Website <span className="dot app" />App</p></div>
        <div className="chart" role="img" aria-label="Daily website and app visits over the last 30 days">
          {data.daily.map(point => <div className="bar-pair" key={point.day} title={`${point.day}: Website ${point.website}, App ${point.app}`}>
            <i className="website" style={{height: `${100 * point.website / max}%`}} /><i className="app" style={{height: `${100 * point.app / max}%`}} />
          </div>)}
        </div><div className="chart-axis"><span>{data.daily[0]?.day}</span><span>{data.daily.at(-1)?.day}</span></div>
        <details><summary>View daily counts</summary><table><thead><tr><th>Date</th><th>Website</th><th>App</th></tr></thead><tbody>
          {data.daily.map(point => <tr key={point.day}><td>{point.day}</td><td>{number(point.website)}</td><td>{number(point.app)}</td></tr>)}
        </tbody></table></details>
      </section>
      <div className="country-grid"><Countries label="Website" stats={data.traffic.website} /><Countries label="App" stats={data.traffic.app} /></div>
      <footer><p>Updated {new Date(data.generatedAt).toLocaleString()}. {data.startedAt && `Collecting since ${new Date(data.startedAt).toISOString().slice(0, 10)}.`}</p>
        <p>Dates use UTC. Visitors count browsers, not people; clearing cookies or switching devices counts again. Visits count one browser per half-hour window. Country comes from the connection and can reflect a VPN.</p>
        <p>Multiplayer time counts periods with at least two connected players, including up to 30 seconds after a disconnect. Totals update within about five minutes. Website demo players are excluded.</p></footer>
    </> : !error && <p role="status">Loading activity…</p>}
  </main>;
}
function App() {
  const {isLoading, isAuthenticated} = useConvexAuth();
  return <><div className="brand"><a href="https://clickclacks.app"><img src={wordmark} alt="Click Clacks" /></a></div>
    {isLoading ? <main><p role="status">Checking sign-in…</p></main> : isAuthenticated ? <Dashboard /> : <SignIn />}</>;
}
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) throw new Error("Set VITE_CONVEX_URL to the Click Clacks deployment.");
createRoot(document.getElementById("root")!).render(<ConvexAuthProvider client={new ConvexReactClient(convexUrl)}><App /></ConvexAuthProvider>);
