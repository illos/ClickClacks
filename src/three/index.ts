// SPDX-License-Identifier: MIT
import * as THREE from "three";
import { disposeGroup } from "./d10";
import { loadDiceFonts } from "./fonts";
import { createVisualDice, type VisualDie } from "./models";
import {
  normalizeStyle,
  type Appearance,
  type PresentationRecord,
  type Preferences,
  type TrayOptions,
} from "./types";
export * from "./types";
export { stockSides, createVisualDice } from "./models";
export { loadDiceFonts } from "./fonts";
type Lane = {
  record: PresentationRecord;
  group: THREE.Group;
  dice: VisualDie[];
  shadows: THREE.Mesh[];
  settled: boolean;
};
function seedFor(id: string) {
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return (seed >>> 0) / 4294967296;
}
/** Optional instance-scoped cosmetic presentation. Accepted values are never generated here. */
export function createTray(host: HTMLElement, options: TrayOptions = {}) {
  const clock = options.clock ?? Date.now;
  const fontAbort = new AbortController();
  let preferences: Preferences = { motion: "full", ...options.preferences };
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.up.set(0, 0, -1);
  scene.add(new THREE.HemisphereLight("#ecf6ff", "#535756", 2.2));
  for (const [color, intensity, x, y, z] of [
    ["#fff0d8", 3.2, -3, 6, 3],
    ["#80b5c5", 1.6, 4, 3, -4],
  ] as const) {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.set(x, y, z);
    scene.add(l);
  }
  const lanes = new Map<string, Lane>();
  let renderer: THREE.WebGLRenderer | undefined,
    frame = 0,
    disposed = false,
    failed = false,
    fontsReady = false;
  const status = (
    state: "ready" | "playing" | "settled" | "unavailable",
    rollId?: string,
    reason?: string,
  ) => options.onStatus?.({ state, rollId, reason });
  const observer = new ResizeObserver(() => {
    resize();
    wake();
  });
  observer.observe(host);
  function resize() {
    if (!renderer) return;
    const width = Math.max(host.clientWidth, 1),
      height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const viewHeight = Math.max(6, 8 / camera.aspect, lanes.size * 1.8 + 2);
    camera.position.set(
      0,
      viewHeight / (2 * Math.tan((19 * Math.PI) / 180)),
      0,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  function init() {
    if (renderer || failed || disposed || preferences.hidden) return;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor("#151a1b");
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.cssText =
        "display:block;width:100%;height:100%";
      renderer.domElement.addEventListener("webglcontextlost", lost);
      host.appendChild(renderer.domElement);
      resize();
      status("ready");
    } catch (error) {
      failed = true;
      status("unavailable", undefined, String(error));
    }
  }
  function lost(event: Event) {
    event.preventDefault();
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    status(
      "unavailable",
      undefined,
      "WebGL context lost; use semantic results.",
    );
  }
  function build(record: PresentationRecord): Lane {
    const group = new THREE.Group(),
      dice: VisualDie[] = [],
      shadows: THREE.Mesh[] = [];
    const style = normalizeStyle(record.style, preferences.highContrast);
    const max = options.maxAnimatedDice ?? 32;
    record.result.dice.forEach((die, index) => {
      if (dice.length >= max) return;
      const visual =
        options.models?.[die.sides]?.(style, die.value, index) ??
        createVisualDice(
          style,
          die.sides,
          die.value,
          record.request?.ruleset === "percentile"
            ? index === 0
              ? 1
              : 0
            : index,
          record.request?.ruleset === "percentile",
        );
      if (dice.length + visual.length > max) return;
      visual.forEach((v) => {
        if (die.kept === false)
          v.mesh.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                m.transparent = true;
                m.opacity = 0.35;
              }
            }
          });
        dice.push(v);
        group.add(v.mesh);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.62, 32),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadows.push(shadow);
        group.add(shadow);
      });
    });
    scene.add(group);
    return { record, group, dice, shadows, settled: false };
  }
  function replace(record: PresentationRecord) {
    const prev = lanes.get(record.participantId);
    if (prev) {
      scene.remove(prev.group);
      disposeGroup(prev.group);
    }
    lanes.set(record.participantId, build(record));
    resize();
    wake();
  }
  function tick() {
    frame = 0;
    if (
      disposed ||
      failed ||
      preferences.hidden ||
      document.hidden ||
      !renderer
    )
      return;
    const now = clock();
    let active = false;
    [...lanes.values()].forEach((lane, laneIndex) => {
      const age = now - lane.record.startsAt,
        duration = Math.max(1, lane.record.revealAt - lane.record.startsAt),
        t = Math.max(0, Math.min(1, age / duration));
      lane.group.position.z = (laneIndex - (lanes.size - 1) / 2) * 1.9;
      lane.group.visible =
        age >= 0 &&
        (preferences.motion === "full" || now >= lane.record.revealAt);
      lane.dice.forEach((visual, index) => {
        const mesh = visual.mesh,
          seed = seedFor(lane.record.id + ":" + index),
          n = lane.dice.length,
          columns = Math.min(n, 8),
          row = Math.floor(index / columns),
          x = ((index % columns) - (columns - 1) / 2) * 1.45,
          z = (row - Math.floor((n - 1) / columns) / 2) * 1.5;
        if (preferences.motion === "reduce" || t >= 1) {
          mesh.quaternion.copy(visual.final);
          mesh.position.set(x, 0.65, z);
        } else {
          const decay = (1 - t) * (1 - t),
            angle = (1 - t) * (7 + seed * 7) * Math.PI;
          const spin = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(angle, angle * 0.71, angle * 0.43),
          );
          mesh.quaternion.copy(visual.final).premultiply(spin);
          mesh.position.set(
            x + (seed - 0.5) * 6 * decay,
            0.65 +
              Math.abs(Math.sin(t * Math.PI * 5)) * 2 * decay +
              (1 - t) * 0.8,
            z + (seed - 0.5) * 2 * decay,
          );
        }
        const shadow = lane.shadows[index]!,
          height = Math.max(0, mesh.position.y - 0.65);
        shadow.position.set(
          mesh.position.x + height * 0.3,
          0.01,
          mesh.position.z - height * 0.2,
        );
        shadow.scale.setScalar(1 + height * 0.3);
        (shadow.material as THREE.MeshBasicMaterial).opacity =
          0.5 / (1 + height * 1.5);
      });
      if (now >= lane.record.revealAt && !lane.settled) {
        lane.settled = true;
        status("settled", lane.record.id);
      }
      if (now < lane.record.revealAt) active = true;
    });
    renderer.render(scene, camera);
    if (active) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (disposed || failed || preferences.hidden) return;
    init();
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else wake();
  }
  document.addEventListener("visibilitychange", visibility);
  async function fonts() {
    if (fontsReady || preferences.hidden) return;
    fontsReady = true;
    await loadDiceFonts(fontAbort.signal);
    if (disposed) return;
    const records = [...lanes.values()].map((l) => l.record);
    records.forEach(replace);
  }
  if (!preferences.hidden) {
    wake();
    void fonts();
  }
  return {
    present(record: PresentationRecord) {
      if (disposed) return;
      replace(record);
      status("playing", record.id);
    },
    clear(ownerId?: string) {
      for (const [id, lane] of lanes) {
        if (ownerId && id !== ownerId) continue;
        scene.remove(lane.group);
        disposeGroup(lane.group);
        lanes.delete(id);
      }
      resize();
      wake();
    },
    setPreferences(next: Partial<Preferences>) {
      if (disposed) return;
      const rebuild =
        next.highContrast !== undefined &&
        next.highContrast !== preferences.highContrast;
      preferences = { ...preferences, ...next };
      if (renderer) renderer.domElement.hidden = !!preferences.hidden;
      if (preferences.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        if (rebuild) [...lanes.values()].map((l) => l.record).forEach(replace);
        void fonts();
        wake();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fontAbort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      disposeGroup(scene);
      lanes.clear();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    },
  };
}
/** Static cosmetic preview respects motion preferences without automatic rotation. */
export function createPreview(
  host: HTMLElement,
  style: Appearance,
  options: { motion?: "reduce" | "full"; highContrast?: boolean } = {},
) {
  const tray = createTray(host, {
    preferences: { motion: "reduce", highContrast: options.highContrast },
  });
  const show = (appearance: Appearance) =>
    tray.present({
      id: "preview",
      participantId: "preview",
      style: appearance,
      result: { dice: [{ id: "preview", sides: 10, value: 7 }], total: 7 },
      startsAt: 0,
      revealAt: 0,
    });
  show(style);
  return {
    update: show,
    style: show,
    setPreferences: tray.setPreferences,
    dispose: tray.dispose,
  };
}
