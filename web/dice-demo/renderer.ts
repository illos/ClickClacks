// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import { createD10, disposeGroup, finalOrientation, vertices } from './d10';
import { progress, type Roll, type Style } from './model';
export type Timing = {
  firstFrame: number;
  revealFrame: number;
  frames: number;
  maxFrameGap: number;
};
export function createTray(host: HTMLElement, onFailure: () => void) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#151a1b');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  // Directly overhead perspective preserves a small height cue during hops.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ecf6ff', '#535756', 2.2));
  const key = new THREE.DirectionalLight('#fff0d8', 3.2);
  key.position.set(-3, 6, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#80b5c5', 1.6);
  fill.position.set(4, 3, -4);
  scene.add(fill);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.16, 6.5),
    new THREE.MeshStandardMaterial({ color: '#242d2c', roughness: 0.95 }),
  );
  base.position.y = -0.12;
  scene.add(base);
  const rims = new THREE.Group();
  for (const [x, z, width, depth] of [
    [0, -3.3, 10.25, 0.16],
    [0, 3.3, 10.25, 0.16],
    [-5.08, 0, 0.16, 6.5],
    [5.08, 0, 0.16, 6.5],
  ]) {
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.18, depth),
      new THREE.MeshStandardMaterial({ color: '#645449', roughness: 0.4, metalness: 0.25 }),
    );
    rim.position.set(x!, 0, z!);
    rims.add(rim);
  }
  scene.add(rims);
  const shadows: THREE.Mesh[] = [];
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d')!,
    gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  for (let i = 0; i < 2; i++) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.025;
    scene.add(shadow);
    shadows.push(shadow);
  }
  let dice: THREE.Group[] = [],
    stylesKey = '',
    frame = 0,
    stopped = false;
  const draw = () => renderer.render(scene, camera);
  function style(styles: Style[]) {
    if (JSON.stringify(styles) === stylesKey) return;
    stylesKey = JSON.stringify(styles);
    for (const die of dice) {
      scene.remove(die);
      disposeGroup(die);
    }
    dice = styles.map((s, index) => createD10(s, index));
    dice.forEach(d => scene.add(d));
  }
  const startRotation = new THREE.Quaternion(),
    endRotation = new THREE.Quaternion(),
    offset = new THREE.Quaternion();
  function pose(roll: Roll, t: number, reduced: boolean) {
    const motion = roll.motion;
    for (let i = 0; i < 2; i++) {
      const die = dice[i]!;
      if (motion) {
        const last = motion.samples.length / 14 - 1;
        const cursor = (reduced ? 1 : t) * last;
        const from = Math.floor(cursor),
          to = Math.min(last, from + 1),
          blend = cursor - from;
        const a = from * 14 + i * 7,
          b = to * 14 + i * 7;
        die.position.set(
          THREE.MathUtils.lerp(motion.samples[a]!, motion.samples[b]!, blend),
          THREE.MathUtils.lerp(motion.samples[a + 1]!, motion.samples[b + 1]!, blend),
          THREE.MathUtils.lerp(motion.samples[a + 2]!, motion.samples[b + 2]!, blend),
        );
        startRotation.fromArray(motion.samples, a + 3).normalize();
        endRotation.fromArray(motion.samples, b + 3).normalize();
        offset.fromArray(motion.offsets, i * 4);
        die.quaternion.copy(startRotation).slerp(endRotation, blend).multiply(offset);
      } else {
        die.quaternion.copy(finalOrientation(roll.faces[i]!, i));
        const lowest = Math.min(
          ...vertices.map(v => v.clone().applyQuaternion(die.quaternion).y * 0.5),
        );
        die.position.set(i ? 1.65 : -1.65, -lowest - 0.02, 0);
      }
      const height = Math.max(0, die.position.y - 0.5);
      const shadow = shadows[i]!;
      shadow.position.x = die.position.x + height * 0.45;
      shadow.position.z = die.position.z - height * 0.3;
      shadow.scale.setScalar(1 + height * 0.45);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.65 / (1 + height * 1.5);
    }
  }
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewHeight = Math.max(7.2, 10.8 / aspect);
    camera.aspect = aspect;
    camera.position.y = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    draw();
  });
  resize.observe(host);
  const lost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  let resume: (() => void) | null = null;
  const visibility = () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else resume?.();
  };
  document.addEventListener('visibilitychange', visibility);
  return {
    preview(styles: Style[]) {
      if (resume) return;
      style(styles);
      dice.forEach(d => {
        d.visible = false;
      });
      shadows.forEach(d => {
        d.visible = false;
      });
      draw();
    },
    play(roll: Roll, now: () => number, reduced: boolean, onReveal: (timing: Timing) => void) {
      cancelAnimationFrame(frame);
      style(roll.styles);
      let firstFrame = 0,
        frames = 0,
        maxFrameGap = 0,
        lastFrame = 0,
        reported = false,
        lastDraw = -Infinity;
      const tick = () => {
        if (stopped || document.hidden) return;
        const current = now(),
          t = progress(roll, current);
        // Cap raster work at 60 Hz on ProMotion/high-refresh displays, without accumulating time.
        if (current - lastDraw < 1000 / 60 - 1 && t < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        lastDraw = current;
        dice.forEach(d => {
          d.visible = current >= roll.startsAt && (!reduced || t >= 1);
        });
        shadows.forEach(d => {
          d.visible = current >= roll.startsAt && (!reduced || t >= 1);
        });
        if (current >= roll.startsAt) {
          if (!firstFrame) firstFrame = current;
          if (lastFrame) maxFrameGap = Math.max(maxFrameGap, current - lastFrame);
          lastFrame = current;
          frames++;
          pose(roll, t, reduced);
        }
        draw();
        if (t >= 1) {
          resume = null;
          if (!reported) {
            reported = true;
            onReveal({ firstFrame, revealFrame: current, frames, maxFrameGap });
          }
        } else frame = requestAnimationFrame(tick);
      };
      resume = tick;
      tick();
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeGroup(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
