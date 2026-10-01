// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { Quaternion, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { createDie, dieModel, modelNumberingOrientation } from '../web/dice-demo/dice-models';
import { simulateThrow } from '../web/dice-demo/physics';
import { packMotion, unpackMotion } from '../web/dice-demo/motion-codec';
import type { DiceConfig, DiceSides } from '../web/dice-demo/model';
const sides: DiceSides[] = [4, 6, 8, 10, 12, 20];
describe('actual numbered polyhedral dice', () => {
  for (const n of sides)
    it(`d${n} has a closed convex hull and result-preserving numbering symmetries`, () => {
      const config: DiceConfig = { kind: 'dice', sides: n, count: 1 },
        model = dieModel(config);
      expect(model.faces).toHaveLength(n);
      const edges = new Map<string, number>();
      for (const face of model.faces) {
        expect(face.points).toHaveLength(n === 6 || n === 10 ? 4 : n === 12 ? 5 : 3);
        expect(face.normal.dot(face.centroid)).toBeGreaterThan(0);
        for (const v of model.vertices)
          expect(face.normal.dot(v.clone().sub(face.centroid))).toBeLessThan(1e-5);
        face.points.forEach((p, i) => {
          const ids = [
            model.vertices.findIndex(v => v.distanceTo(p) < 1e-5),
            model.vertices.findIndex(
              v => v.distanceTo(face.points[(i + 1) % face.points.length]!) < 1e-5,
            ),
          ].sort();
          const k = ids.join(',');
          edges.set(k, (edges.get(k) ?? 0) + 1);
        });
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      for (let value = 1; value <= n; value++)
        for (const body of [
          new Quaternion(),
          new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 1.74),
        ]) {
          const q = modelNumberingOrientation(body, value, 0, config);
          expect(
            model.vertices.every(v =>
              model.vertices.some(w => w.distanceTo(v.clone().applyQuaternion(q)) < 1e-5),
            ),
          ).toBe(true);
          const final = body.clone().multiply(q);
          if (model.vertexRead) {
            const top = Math.max(...model.vertices.map(v => v.clone().applyQuaternion(final).y));
            expect(model.vertices[value - 1]!.clone().applyQuaternion(final).y).toBeCloseTo(top, 5);
          } else {
            const top = Math.max(
              ...model.faces.map(f => f.normal.clone().applyQuaternion(final).y),
            );
            expect(
              model.faces
                .find(f => f.value === value)!
                .normal.clone()
                .applyQuaternion(final).y,
            ).toBeCloseTo(top, 5);
          }
        }
    });
  for (const n of sides)
    it(`d${n} records settled 60 Hz physical motion`, () => {
      const config: DiceConfig = { kind: 'dice', sides: n, count: 1 };
      let motion;
      for (let seed = 1; seed <= 5 && !motion; seed++)
        try {
          motion = simulateThrow(seed, [n], { dice: config, scale: 0.65 });
        } catch {}
      expect(motion).toBeDefined();
      expect(motion!.stepMs).toBe(1000 / 60);
      expect(motion!.samples.length % 7).toBe(0);
      expect(motion!.offsets).toHaveLength(4);
    });
  for (const n of sides)
    it(`twenty d${n} bodies can settle inside the shared tray`, () => {
      let motion;
      for (let seed = 1; seed <= 5 && !motion; seed++)
        try {
          motion = simulateThrow(seed, Array(20).fill(n), {
            dice: { kind: 'dice', sides: n, count: 20 },
            scale: 0.65,
          });
        } catch {}
      expect(motion).toBeDefined();
      const last = motion!.samples.slice(-140);
      for (let i = 0; i < 20; i++) {
        expect(Math.abs(last[i * 7]!)).toBeLessThan(5.1);
        expect(Math.abs(last[i * 7 + 2]!)).toBeLessThan(3.4);
      }
    });
  it('new shapes retain every finish and font through the original material pipeline', () => {
    const ctx = {
      fillRect() {},
      fillText() {},
      beginPath() {},
      arc() {},
      fill() {},
      moveTo() {},
      bezierCurveTo() {},
      stroke() {},
      putImageData() {},
      getImageData() {
        return { data: new Uint8ClampedArray(256 * 256 * 4).fill(255) };
      },
    };
    vi.stubGlobal('document', {
      createElement() {
        return {
          getContext() {
            return { ...ctx };
          },
        };
      },
    });
    try {
      for (const n of sides)
        for (const pattern of ['solid', 'speckle', 'marble', 'frosted'] as const)
          for (const font of ['serif', 'modern', 'rune', 'gothic'] as const) {
            const group = createDie(
              { color: '#aa3322', ink: '#ffffff', pattern, font },
              { kind: 'dice', sides: n, count: 1 },
            );
            expect(group.children).toHaveLength(n);
            for (const child of group.children) {
              const material = (child as Mesh).material as MeshStandardMaterial;
              expect(material.map?.colorSpace).toBe('srgb');
              expect(material.roughness).toBe(pattern === 'frosted' ? 0.88 : 0.34);
              if (pattern === 'frosted') {
                expect(material.customProgramCacheKey()).toBe('dice-frosted-fresnel-85-v1');
                expect(material.transparent).toBe(true);
              }
            }
          }
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('twenty physical dice preserve all frames through binary transport', () => {
    const config: DiceConfig = { kind: 'dice', sides: 6, count: 20 };
    let motion;
    for (let seed = 1; seed <= 8 && !motion; seed++)
      try {
        motion = simulateThrow(seed, Array(20).fill(6), {
          dice: config,
          scale: 0.65,
        });
      } catch {}
    expect(motion).toBeDefined();
    expect(motion!.samples.length % 140).toBe(0);
    expect(motion!.offsets).toHaveLength(80);
    const packed = packMotion(motion!);
    expect(packed.samples).toHaveLength(0);
    expect(packed.packed).toBeInstanceOf(ArrayBuffer);
    expect(unpackMotion(packed).samples).toEqual(motion!.samples);
  });
});
