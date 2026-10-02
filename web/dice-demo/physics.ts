// SPDX-License-Identifier: MIT
import {
  Body,
  Box,
  ContactMaterial,
  ConvexPolyhedron,
  GSSolver,
  Material,
  Vec3,
  World,
} from 'cannon-es';
import * as THREE from 'three';
import { faceForResult, faces, vertices } from './d10';
import { dieConfigForIndex, dieModel, modelNumberingOrientation } from './dice-models';
import type { DiceConfig, Motion, ThrowScene } from './model';
import { UnsettledThrowError } from './throw-settling';

/** Seeded cosmetic parameters only. Results never come from the physics world. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000;
  };
}
function faceFrame(face: (typeof faces)[number]) {
  const y = face.points[0]!.clone().sub(face.centroid).normalize();
  const x = y.clone().cross(face.normal).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, face.normal),
  );
}
/** An icosahedral symmetry rotates numbering without changing the physical hull or adjacency. */
export function numberingOrientation(
  bodyRotation: THREE.Quaternion,
  result: number,
  index: number,
) {
  const target = [...faces].sort(
    (a, b) =>
      b.normal.clone().applyQuaternion(bodyRotation).y -
      a.normal.clone().applyQuaternion(bodyRotation).y,
  )[0]!;
  return faceFrame(target)
    .multiply(faceFrame(faceForResult(result, index)).invert())
    .normalize();
}
/** Original pair numbering remains unchanged; an optional percentile d4 reads its tip. */
export function throwNumberingOrientation(
  body: THREE.Quaternion,
  result: number,
  index: number,
  config?: DiceConfig,
) {
  const own = dieConfigForIndex(config, index);
  return !own || own.kind === 'power' || own.kind === 'percentile'
    ? numberingOrientation(body, result, index)
    : modelNumberingOrientation(body, result, index, config);
}
export function simulateThrow(seed: number, results: number[], scene: ThrowScene = {}): Motion {
  const random = generator(seed),
    between = (a: number, b: number) => a + random() * (b - a);
  const world = new World({ gravity: new Vec3(0, -18, 0), allowSleep: true });
  if (results.length > 2 && world.solver instanceof GSSolver) world.solver.iterations = 30;
  const dieMaterial = new Material('die'),
    trayMaterial = new Material('tray');
  world.addContactMaterial(
    new ContactMaterial(dieMaterial, trayMaterial, {
      friction: 0.32,
      restitution: 0.52,
    }),
  );
  world.addContactMaterial(
    new ContactMaterial(dieMaterial, dieMaterial, {
      friction: 0.16,
      restitution: 0.48,
    }),
  );
  const staticBox = (half: Vec3, position: Vec3, entryWall = false) => {
    const body = new Body({
      mass: 0,
      material: trayMaterial,
      shape: new Box(half),
      position,
      collisionFilterGroup: entryWall ? 2 : 1,
    });
    world.addBody(body);
  };
  staticBox(new Vec3(5.15, 0.1, 3.4), new Vec3(0, -0.14, 0));
  // Tall collision guards keep cosmetic throws contained; the visible rim stays low.
  staticBox(new Vec3(0.1, 2.5, 3.4), new Vec3(-5.08, 2.4, 0), true);
  staticBox(new Vec3(0.1, 2.5, 3.4), new Vec3(5.08, 2.4, 0), true);
  staticBox(new Vec3(5.15, 2.5, 0.1), new Vec3(0, 2.4, -3.3));
  staticBox(new Vec3(5.15, 2.5, 0.1), new Vec3(0, 2.4, 3.3));
  const scale = scene.scale ?? 0.5;
  const models = results.map((_, index) => dieModel(scene.dice, index));
  const model = models[0]!;
  const vertices = model.vertices,
    faces = model.faces;
  const hullVertices = vertices.map(p => new Vec3(p.x * scale, p.y * scale, p.z * scale));
  const hullFaces = faces.map(face =>
    face.points.map(p => vertices.findIndex(v => v.distanceToSquared(p) < 1e-10)),
  );
  const shape = new ConvexPolyhedron({
    vertices: hullVertices,
    faces: hullFaces,
  });
  for (const obstacle of scene.obstacles ?? []) {
    const obstacleScale = obstacle.scale ?? scale;
    const obstacleModel = dieModel(obstacle.dice);
    const obstacleShape =
      obstacleScale === scale && !obstacle.dice && (!scene.dice || scene.dice.kind === 'power')
        ? shape
        : new ConvexPolyhedron({
            vertices: obstacleModel.vertices.map(
              p => new Vec3(p.x * obstacleScale, p.y * obstacleScale, p.z * obstacleScale),
            ),
            faces: obstacleModel.faces.map(face =>
              face.points.map(p =>
                obstacleModel.vertices.findIndex(v => v.distanceToSquared(p) < 1e-10),
              ),
            ),
          });
    const body = new Body({
      mass: 0,
      material: dieMaterial,
      shape: obstacleShape,
    });
    body.position.set(obstacle.position[0]!, obstacle.position[1]!, obstacle.position[2]!);
    body.quaternion.set(...(obstacle.rotation as [number, number, number, number]));
    world.addBody(body);
  }
  const side = random() < 0.5 ? -1 : 1;
  // The optional21st die uses six columns inside the same seven-unit entry span.
  const columns = Math.min(results.length > 20 ? 6 : 5, results.length);
  const columnSpacing = columns > 5 ? 7 / (columns - 1) : 1.75;
  const rows = Math.ceil(results.length / columns);
  const bodies = Array.from({ length: results.length }, (_, i) => {
    const startSide = side;
    const x =
        results.length <= 2
          ? startSide * between(10.8, 11.6)
          : ((i % columns) - (columns - 1) / 2) * columnSpacing + between(-0.05, 0.05),
      z =
        results.length <= 2
          ? (i ? 1 : -1) * between(0.7, 1.5)
          : (Math.floor(i / columns) - (rows - 1) / 2) * 1.35 + between(-0.05, 0.05);
    const ownModel = models[i]!;
    const ownShape =
      ownModel.faces === model.faces
        ? shape
        : new ConvexPolyhedron({
            vertices: ownModel.vertices.map(p => new Vec3(p.x * scale, p.y * scale, p.z * scale)),
            faces: ownModel.faces.map(face =>
              face.points.map(p =>
                ownModel.vertices.findIndex(v => v.distanceToSquared(p) < 1e-10),
              ),
            ),
          });
    const body = new Body({
      mass: 1,
      material: dieMaterial,
      shape: ownShape,
      position: new Vec3(x, between(3.2, 3.8), z),
      // Enter through the side guard, then enable it once the entire hull is inside.
      collisionFilterMask: results.length <= 2 ? 1 : -1,
      linearDamping: 0.22,
      angularDamping: 0.22,
      allowSleep: true,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 0.3,
    });
    body.quaternion.setFromEuler(between(0, 6.28), between(0, 6.28), between(0, 6.28));
    body.velocity.set(
      results.length <= 2 ? -startSide * between(14, 16) : between(-1.5, 1.5),
      between(0.3, 1.2),
      results.length <= 2 ? -z * between(1, 2.2) + between(-1.8, 1.8) : between(-1.5, 1.5),
    );
    body.angularVelocity.set(between(-18, 18), between(-10, 10), between(-18, 18));
    world.addBody(body);
    return body;
  });
  const samples: number[] = [];
  const capture = () => {
    for (const [index, body] of bodies.entries()) {
      // Store the original 0.5-scale contact convention; V2's renderer restores its visual lift.
      const q = new THREE.Quaternion(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
      const support =
        scale === 0.5
          ? 0
          : Math.min(...models[index]!.vertices.map(v => v.clone().applyQuaternion(q).y));
      samples.push(
        body.position.x,
        body.position.y + support * (scale - 0.5),
        body.position.z,
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
    }
  };
  capture();
  let settled = false;
  let quietSteps = 0;
  // Bounded 120 Hz solve, recorded at 60 Hz. Only the thrower's worker runs it, before scheduling.
  for (let step = 1; step <= 960; step++) {
    for (const body of bodies) {
      if (body.collisionFilterMask === 1 && Math.abs(body.position.x) < 4.3)
        body.collisionFilterMask = -1;
    }
    world.step(1 / 120);
    if (step % 2 === 0) capture();
    // Dense generic pools can repeatedly wake sleeping neighbors through resting contacts.
    // Require the same Cannon sleep speed/time for the whole pool, without changing pair playback.
    if (results.length > 2) {
      const quiet = bodies.every(
        body =>
          body.velocity.lengthSquared() + body.angularVelocity.lengthSquared() <
          body.sleepSpeedLimit ** 2,
      );
      quietSteps = quiet ? quietSteps + 1 : 0;
    }
    if (
      step >= 240 &&
      step % 2 === 0 &&
      (bodies.every(body => body.sleepState === Body.SLEEPING) || quietSteps >= 36)
    ) {
      settled = true;
      break;
    }
  }
  if (!settled) throw new UnsettledThrowError();
  const offsets = bodies.flatMap((body, i) =>
    throwNumberingOrientation(
      new THREE.Quaternion(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      ),
      results[i]!,
      i,
      scene.dice,
    ).toArray(),
  );
  // Remove invisible approach time, preserving one fully offscreen frame before entry.
  // Use the widest demo view; narrower views receive exactly the same recorded trajectory.
  const halfWidth = (7.2 * (1140 / 440)) / 2;
  const cameraHeight = 7.2 / (2 * Math.tan((19 * Math.PI) / 180));
  const stride = results.length * 7;
  let entry = 0;
  for (let frame = 1; frame < samples.length / stride; frame++) {
    const outside = bodies.every((_, index) => {
      const start = frame * stride + index * 7;
      const x = Math.abs(samples[start]!);
      const y = samples[start + 1]!;
      // Bounding sphere is conservative for every hull orientation.
      return x - 1.25 * scale > halfWidth * (1 - (y - 1.25 * scale) / cameraHeight);
    });
    if (!outside) break;
    entry = frame;
  }
  return {
    seed,
    stepMs: 1000 / 60,
    samples: samples.slice(entry * stride).map(n => Math.round(n * 100000) / 100000),
    offsets,
  };
}
