// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import { createD10, disposeGroup } from '../dice-demo/d10';
import { PresentationAssets } from '../dice-demo/presentation-assets';
import type { TrayPreferences } from './renderer';
import type { Style } from '../dice-demo/model';

/** Cosmetic preview only: reuse the actual die mesh; no physics or dice-result generation. */
export function createDicePreview(
  host: HTMLElement,
  onFailure: () => void,
  options: TrayPreferences = {},
) {
  let preferences = {
    motion: options.motion ?? 'device',
    highContrast: options.highContrast ?? false,
  };
  let appearance: Style | null = null;
  const assets = new PresentationAssets();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 1.6, 4.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ecf6ff', '#535756', 2.2));
  const key = new THREE.DirectionalLight('#fff0d8', 3.2);
  key.position.set(-3, 6, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#80b5c5', 1.6);
  fill.position.set(4, 3, -4);
  scene.add(fill);
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () =>
    preferences.motion === 'reduce' || (preferences.motion === 'device' && preference.matches);
  let die: THREE.Group | null = null;
  let pending: Style | null = null,
    styleKey = '';
  let frame = 0,
    stopped = false,
    lastDraw = -Infinity;
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
  const yawAxis = new THREE.Vector3(0, 1, 0),
    pitchAxis = new THREE.Vector3(1, 0, 0);
  const rotation = new THREE.Quaternion();
  let lastTick = performance.now(),
    velocityX = 0,
    velocityY = 0;
  let dragging: { id: number; x: number; y: number; time: number } | null = null;
  function rotate(x: number, y: number) {
    orientation.premultiply(rotation.setFromAxisAngle(yawAxis, x));
    orientation.premultiply(rotation.setFromAxisAngle(pitchAxis, y));
    orientation.normalize();
  }
  function tick(now: number) {
    frame = 0;
    if (stopped || document.hidden) return;
    const elapsed = Math.min(50, Math.max(0, now - lastTick));
    lastTick = now;
    if (!dragging && !reduced()) {
      rotate((0.00018 + velocityX) * elapsed, velocityY * elapsed);
      const decay = Math.exp(-elapsed / 450);
      velocityX *= decay;
      velocityY *= decay;
    }
    let changed = false;
    if (pending) {
      const nextKey = JSON.stringify(pending);
      if (nextKey !== styleKey) {
        if (die) {
          scene.remove(die);
          disposeGroup(die);
        }
        try {
          die = createD10(pending, 0, 'power', assets);
          // Bigger than an in-tray die, framing one model above the style controls.
          die.scale.setScalar(0.9);
          scene.add(die);
          styleKey = nextKey;
          changed = true;
        } catch {
          stopped = true;
          onFailure();
          return;
        }
      }
      pending = null;
    }
    if (changed || now - lastDraw >= 1000 / 30 - 1) {
      if (die) die.quaternion.copy(orientation);
      renderer.render(scene, camera);
      lastDraw = now;
    }
    if (!reduced()) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!frame && !stopped && !document.hidden) frame = requestAnimationFrame(tick);
  }
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    lastDraw = -Infinity;
    wake();
  });
  resize.observe(host);
  const visibility = () => {
    if (document.hidden) {
      velocityX = velocityY = 0;
      const pointer = dragging?.id;
      dragging = null;
      if (pointer !== undefined && host.hasPointerCapture(pointer))
        host.releasePointerCapture(pointer);
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      lastDraw = -Infinity;
      lastTick = performance.now();
      wake();
    }
  };
  const motion = () => {
    velocityX = velocityY = 0;
    lastDraw = -Infinity;
    wake();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(frame);
    onFailure();
  };
  const down = (event: PointerEvent) => {
    if (dragging || stopped || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    velocityX = velocityY = 0;
    host.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const now = performance.now(),
      elapsed = Math.max(8, now - dragging.time);
    const x = (event.clientX - dragging.x) * 0.012,
      y = (event.clientY - dragging.y) * 0.012;
    rotate(x, y);
    velocityX = Math.max(-0.025, Math.min(0.025, x / elapsed));
    velocityY = Math.max(-0.025, Math.min(0.025, y / elapsed));
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now };
    lastDraw = -Infinity;
    wake();
  };
  const up = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    if (event.type !== 'pointerup' || performance.now() - dragging.time > 100 || reduced())
      velocityX = velocityY = 0;
    dragging = null;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    wake();
  };
  const wheel = (event: WheelEvent) => {
    if (stopped) return;
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
    const x = Math.max(-100, Math.min(100, event.deltaX * scale)) * 0.006;
    const y = Math.max(-100, Math.min(100, event.deltaY * scale)) * 0.006;
    rotate(x, y);
    if (!reduced()) {
      velocityX = x / 30;
      velocityY = y / 30;
    }
    lastDraw = -Infinity;
    wake();
  };
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('lostpointercapture', up);
  host.addEventListener('wheel', wheel, { passive: false });
  document.addEventListener('visibilitychange', visibility);
  preference.addEventListener('change', motion);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  let disposed = false;
  return {
    setPreferences(value: TrayPreferences) {
      preferences = { ...preferences, ...value };
      if (appearance)
        pending = preferences.highContrast
          ? { ...appearance, color: '#ffffff', ink: '#000000', pattern: 'solid' }
          : appearance;
      motion();
    },
    style(value: Style) {
      appearance = value;
      pending = preferences.highContrast
        ? { ...value, color: '#ffffff', ink: '#000000', pattern: 'solid' }
        : value;
      wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      if (dragging && host.hasPointerCapture(dragging.id)) host.releasePointerCapture(dragging.id);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('lostpointercapture', up);
      host.removeEventListener('wheel', wheel);
      document.removeEventListener('visibilitychange', visibility);
      preference.removeEventListener('change', motion);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeGroup(scene);
      assets.dispose();
      die = null;
      pending = appearance = null;
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
