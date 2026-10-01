// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import { disposeGroup } from '../dice-demo/d10';
import { createDie, dieModel } from '../dice-demo/dice-models';
import { unpackRoll } from '../dice-demo/motion-codec';
import type { Style } from '../dice-demo/model';
import { progress } from '../dice-demo/model';
import { revealDelay, trayOpacity, type Participant, type ParticipantRoll } from './model';
import { criticalResult, criticalLabel } from '../../lib/critical';
import type { Timing } from '../dice-demo/renderer';
type Lane = {
  group: THREE.Group;
  dice: THREE.Group[];
  shadows: THREE.Mesh[];
  styleKey: string;
  appearance: Style;
  materials: THREE.Material[];
  result: HTMLDivElement;
  resultWidth: number;
  roll?: ParticipantRoll;
  offset: number;
  uncertainty: number;
  reported: boolean;
  revealAfter: number;
  firstFrame: number;
  lastFrame: number;
  frames: number;
  maxFrameGap: number;
};
export type TrayPreferences = { motion?: 'device' | 'reduce' | 'full'; highContrast?: boolean; transparent?: boolean };
/** One WebGL context with independent playback tracks; no per-viewer physics simulation. */
export function createRoomTray(
  host: HTMLElement,
  onFailure: () => void,
  onReveal: (roll: ParticipantRoll, timing: Timing, uncertainty: number) => void,
  options: TrayPreferences = {},
) {
  let preferences = {
    motion: options.motion ?? 'device',
    highContrast: options.highContrast ?? false,
  };
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: options.transparent === true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#151a1b', options.transparent ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ecf6ff', '#535756', 2.2));
  for (const [color, intensity, x, y, z] of [
    ['#fff0d8', 3.2, -3, 6, 3],
    ['#80b5c5', 1.6, 4, 3, -4],
  ] as const) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const lanes = new Map<string, Lane>();
  const members = new Map<string, Participant>();
  const rollKey = (roll: ParticipantRoll) => JSON.stringify([roll.roller, roll.id]);
  function removeLane(key: string, lane: Lane) {
    scene.remove(lane.group);
    disposeGroup(lane.group);
    lane.result.remove();
    lanes.delete(key);
  }
  let participantAppearance = '';
  const queued = new Map<
    string,
    { roll: ParticipantRoll; clock: { offset: number; uncertainty: number } }
  >();
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0,
    stopped = false,
    reduced =
      preferences.motion === 'reduce' ||
      (preferences.motion === 'device' && matchMedia('(prefers-reduced-motion: reduce)').matches),
    lastDraw = -Infinity;
  let width = host.clientWidth,
    height = host.clientHeight;
  const startQ = new THREE.Quaternion(),
    endQ = new THREE.Quaternion(),
    numbering = new THREE.Quaternion();
  const draw = () => renderer.render(scene, camera);
  function layout() {
    const aspect = Math.max(1, width) / Math.max(1, height);
    const viewHeight = Math.max(5.2, 6.8 / aspect);
    camera.aspect = aspect;
    camera.position.set(0, viewHeight / (2 * Math.tan((19 * Math.PI) / 180)), 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function shadow(group: THREE.Group) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!,
      g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }
  function style(lane: Lane, member: Participant) {
    lane.appearance = member.style;
    const appearance: Style = preferences.highContrast
      ? { ...member.style, color: '#ffffff', ink: '#000000', pattern: 'solid' }
      : member.style;
    const key = JSON.stringify([appearance, lane.roll?.dice]);
    if (lane.styleKey !== key) {
      for (const die of lane.dice) {
        lane.group.remove(die);
        disposeGroup(die);
      }
      lane.dice = Array.from({ length: lane.roll?.faces.length ?? 2 }, (_, index) =>
        createDie(appearance, lane.roll?.dice, index),
      );
      while (lane.shadows.length < lane.dice.length) lane.shadows.push(shadow(lane.group));
      while (lane.shadows.length > lane.dice.length) {
        const old = lane.shadows.pop()!;
        lane.group.remove(old);
        disposeGroup(old);
      }
      lane.dice.forEach(d => {
        d.scale.multiplyScalar(1.3);
        d.visible = false;
        lane.group.add(d);
      });
      const materials = new Set<THREE.Material>();
      for (const die of lane.dice)
        die.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            material.transparent = true;
            material.depthWrite = false;
            materials.add(material);
          }
        });
      lane.materials = [...materials];
      lane.styleKey = key;
    }
  }
  function pose(lane: Lane, t: number) {
    const roll = lane.roll!;
    const motion = roll.motion!;
    const stride = roll.faces.length * 7;
    for (let i = 0; i < roll.faces.length; i++) {
      const die = lane.dice[i]!;
      const vertices = dieModel(roll.dice, i).vertices;
      const last = motion.samples.length / stride - 1;
      const cursor = (reduced ? 1 : t) * last;
      const from = Math.floor(cursor),
        to = Math.min(last, from + 1),
        blend = cursor - from;
      const a = from * stride + i * 7,
        b = to * stride + i * 7;
      die.position.set(
        THREE.MathUtils.lerp(motion.samples[a]!, motion.samples[b]!, blend),
        THREE.MathUtils.lerp(motion.samples[a + 1]!, motion.samples[b + 1]!, blend),
        THREE.MathUtils.lerp(motion.samples[a + 2]!, motion.samples[b + 2]!, blend),
      );
      startQ.fromArray(motion.samples, a + 3).normalize();
      endQ.fromArray(motion.samples, b + 3).normalize();
      numbering.fromArray(motion.offsets, i * 4);
      die.quaternion.copy(startQ).slerp(endQ, blend).multiply(numbering);
      // Keep the enlarged visual hull above the recorded physical floor contact.
      const support = Math.min(...vertices.map(v => v.clone().applyQuaternion(die.quaternion).y));
      die.position.y -= support * (die.scale.x - 0.5);
      const h = Math.max(0, die.position.y - 0.5);
      const shadow = lane.shadows[i]!;
      shadow.position.set(die.position.x + h * 0.45, -0.025, die.position.z - h * 0.3);
      shadow.scale.setScalar(1.3 * (1 + h * 0.45));
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.65 / (1 + h * 1.5);
    }
  }
  const projected = new THREE.Vector3();
  function resultLabel(lane: Lane, age: number) {
    lane.result.hidden = age < 0 || age >= 1000;
    if (lane.result.hidden) return;
    lane.group.updateWorldMatrix(true, true);
    let left = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const [index, die] of lane.dice.entries())
      for (const vertex of dieModel(lane.roll?.dice, index).vertices) {
        projected.copy(vertex).applyMatrix4(die.matrixWorld).project(camera);
        const x = ((projected.x + 1) * width) / 2,
          y = ((1 - projected.y) * height) / 2;
        left = Math.min(left, x);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    if (!lane.resultWidth) lane.resultWidth = lane.result.offsetWidth;
    const half = lane.resultWidth / 2 + 8;
    lane.result.style.left = `${Math.max(half, Math.min(width - half, (left + right) / 2))}px`;
    lane.result.style.top = `${Math.max(0, Math.min(height - 40, bottom + 8))}px`;
    lane.result.style.opacity = String(Math.min(1, (1000 - age) / 200));
    const scale = reduced ? 1 : 0.8 + 0.2 * Math.min(1, age / 140);
    lane.result.style.transform = `translateX(-50%) scale(${scale})`;
  }
  function tick() {
    if (stopped || document.hidden) {
      frame = 0;
      return;
    }
    const mono = performance.now();
    if (mono - lastDraw < 1000 / 60 - 1) {
      frame = requestAnimationFrame(tick);
      return;
    }
    lastDraw = mono;
    let active = false,
      nextFade = Infinity;
    for (const [key, lane] of lanes) {
      if (!lane.roll) continue;
      const now = mono + lane.offset,
        roll = lane.roll,
        t = progress(roll, now);
      const resultAge = now - roll.startsAt - lane.revealAfter;
      const alpha = trayOpacity(roll, now);
      const fadeAt = roll.startsAt + roll.duration + 5000;
      const visible =
        alpha > 0 &&
        now >= roll.startsAt &&
        (!reduced || now >= roll.startsAt + lane.revealAfter) &&
        (!reduced || now < fadeAt);
      for (const material of lane.materials) material.opacity = alpha;
      [...lane.dice, ...lane.shadows].forEach(d => {
        d.visible = visible;
      });
      if (visible) {
        pose(lane, t);
        for (const shadow of lane.shadows)
          (shadow.material as THREE.MeshBasicMaterial).opacity *= alpha;
        if (!lane.reported) {
          if (!lane.firstFrame) lane.firstFrame = now;
          if (lane.lastFrame) lane.maxFrameGap = Math.max(lane.maxFrameGap, now - lane.lastFrame);
          lane.lastFrame = now;
          lane.frames++;
        }
      }
      resultLabel(lane, resultAge);
      if (now >= roll.startsAt + lane.revealAfter && !lane.reported) {
        lane.reported = true;
        onReveal(
          roll,
          {
            firstFrame: lane.firstFrame,
            revealFrame: now,
            frames: lane.frames,
            maxFrameGap: lane.maxFrameGap,
          },
          lane.uncertainty,
        );
      }
      if (now >= fadeAt && (reduced || alpha <= 0)) {
        removeLane(key, lane);
        continue;
      }
      if (t < 1 || (resultAge >= 0 && resultAge < 1000) || (!reduced && now >= fadeAt && alpha > 0))
        active = true;
      if (now < fadeAt) nextFade = Math.min(nextFade, fadeAt - now);
    }
    draw();
    frame = active ? requestAnimationFrame(tick) : 0;
    clearTimeout(fadeTimer);
    fadeTimer =
      !active && Number.isFinite(nextFade) ? setTimeout(wake, Math.max(1, nextFade)) : undefined;
  }
  const wake = () => {
    clearTimeout(fadeTimer);
    if (!frame && !stopped && !document.hidden) frame = requestAnimationFrame(tick);
  };
  const resize = new ResizeObserver(() => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    for (const lane of lanes.values()) lane.resultWidth = 0;
    layout();
    wake();
  });
  resize.observe(host);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      clearTimeout(fadeTimer);
      frame = 0;
    } else wake();
  };
  document.addEventListener('visibilitychange', visibility);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const motionChanged = () => {
    reduced =
      preferences.motion === 'reduce' ||
      (preferences.motion === 'device' && motionPreference.matches);
    wake();
  };
  motionPreference.addEventListener('change', motionChanged);
  const lost = (event: Event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(fadeTimer);
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  return {
    setPreferences(value: TrayPreferences) {
      preferences = { ...preferences, ...value };
      motionChanged();
      for (const lane of lanes.values()) style(lane, { style: lane.appearance } as Participant);
      wake();
    },
    participants(participants: Participant[]) {
      // Presence/clock refreshes do not change the scene or wake settled playback.
      const appearance = JSON.stringify(
        participants.map(({ id, name, style, slot }) => ({ id, name, style, slot })),
      );
      if (appearance === participantAppearance) return;
      participantAppearance = appearance;
      for (const id of members.keys())
        if (!participants.some(p => p.id === id)) {
          members.delete(id);
          this.clear(id);
        }
      for (const member of participants) members.set(member.id, member);
      for (const [key, lane] of lanes) {
        const member = members.get(lane.roll!.roller);
        if (!member) {
          removeLane(key, lane);
          continue;
        }
        lane.group.userData.slot = member.slot;
        style(lane, member);
      }
      layout();
      for (const [key, pending] of queued) {
        if (members.has(pending.roll.roller)) {
          queued.delete(key);
          this.play(pending.roll, pending.clock);
        }
      }
      wake();
    },
    clear(roller: string) {
      for (const [key, pending] of queued)
        if (pending.roll.roller === roller) queued.delete(key);
      for (const [key, lane] of lanes)
        if (lane.roll?.roller === roller) removeLane(key, lane);
      wake();
    },
    play(roll: ParticipantRoll, clock: { offset: number; uncertainty: number }) {
      roll = unpackRoll(roll);
      // A logical-only result has no visual lane and leaves other throws intact.
      if (!roll.motion) return;
      const key = rollKey(roll);
      const existing = lanes.get(key);
      if (existing) {
        if (existing.offset !== clock.offset || existing.uncertainty !== clock.uncertainty) {
          existing.offset = clock.offset;
          existing.uncertainty = clock.uncertainty;
          wake();
        }
        return;
      }
      // Settled history must not resurrect a disposed lane on a later refresh.
      if (performance.now() + clock.offset >= roll.startsAt + roll.duration + 5600) return;
      const member = members.get(roll.roller);
      if (!member) {
        queued.set(key, { roll, clock });
        return;
      }
      const group = new THREE.Group();
      group.scale.setScalar(0.62);
      scene.add(group);
      const result = document.createElement('div');
      result.className = 'tray-roll-result';
      result.setAttribute('aria-hidden', 'true');
      result.dataset.rollId = roll.id;
      result.dataset.roller = roll.roller;
      result.hidden = true;
      host.appendChild(result);
      const lane: Lane = {
        group,
        result,
        resultWidth: 0,
        dice: [],
        shadows: [],
        styleKey: '',
        appearance: member.style,
        materials: [],
        roll,
        offset: clock.offset,
        uncertainty: clock.uncertainty,
        reported: false,
        revealAfter: 0,
        firstFrame: 0,
        lastFrame: 0,
        frames: 0,
        maxFrameGap: 0,
      };
      group.userData.slot = member.slot;
      lanes.set(key, lane);
      style(lane, member);
      const total = document.createElement('strong');
      total.textContent = String(
        roll.total ?? roll.power?.total ?? roll.faces.reduce((sum, face) => sum + face, 0),
      );
      lane.result.replaceChildren(total);
      const critical = criticalResult(roll);
      lane.result.className = `tray-roll-result${critical ? ` critical-${critical}` : ''}`;
      if (critical) {
        const badge = document.createElement('span');
        badge.className = `critical-badge critical-${critical}`;
        badge.textContent = criticalLabel(critical);
        lane.result.appendChild(badge);
      }
      if (roll.power) {
        const net = roll.power.edges - roll.power.banes;
        if (net) {
          const modifier = document.createElement('span');
          modifier.className = `tray-result-modifier ${net > 0 ? 'edge' : 'bane'}`;
          modifier.textContent =
            Math.abs(net) === 1 ? (net > 0 ? '+2' : '−2') : net > 0 ? 'Double Edge' : 'Double Bane';
          lane.result.appendChild(modifier);
        }
        const tier = document.createElement('span');
        tier.className = `tray-result-tier tier-${roll.power.tier}`;
        tier.textContent = `Tier ${roll.power.tier}`;
        lane.result.appendChild(tier);
      }
      if (!roll.power && roll.modifier) {
        const modifier = document.createElement('span');
        modifier.className = 'tray-result-modifier';
        modifier.textContent =
          roll.modifier > 0 ? `+${roll.modifier}` : `−${Math.abs(roll.modifier)}`;
        lane.result.appendChild(modifier);
      }
      lane.resultWidth = 0;
      lane.result.hidden = true;
      lane.revealAfter = revealDelay(roll);
      lane.offset = clock.offset;
      lane.uncertainty = clock.uncertainty;
      lane.reported = false;
      lane.firstFrame = lane.lastFrame = lane.frames = lane.maxFrameGap = 0;
      wake();
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(fadeTimer);
      resize.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motionPreference.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const lane of lanes.values()) lane.result.remove();
      disposeGroup(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
