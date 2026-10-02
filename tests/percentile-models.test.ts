// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { Mesh, MeshStandardMaterial, Quaternion } from 'three';
import { createD10, disposeGroup, faceForResult, faceGlyph, faces, vertices } from '../web/dice-demo/d10';
import { createDie, dieConfigForIndex, dieModel } from '../web/dice-demo/dice-models';
import { numberingOrientation, simulateThrow } from '../web/dice-demo/physics';
import { trayDieScale } from '../web/dice-demo-v2/dice-size';
import type { DiceConfig, Style } from '../web/dice-demo/model';

const percentile: DiceConfig = { kind: 'percentile', sides: 10, count: 2 };
describe('original power pair as percentile dice', () => {
  it('labels tens as 00–90 and units as 0–9 without changing power glyphs', () => {
    expect(Array.from({ length: 10 }, (_, i) => faceGlyph(i + 1, 0, 'percentile')))
      .toEqual(['10', '20', '30', '40', '50', '60', '70', '80', '90', '00']);
    expect(Array.from({ length: 10 }, (_, i) => faceGlyph(i + 1, 1, 'percentile')))
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    expect([faceGlyph(1, 0), faceGlyph(1, 1), faceGlyph(10, 0), faceGlyph(10, 1)])
      .toEqual(['1', '01', '0', '00']);
  });

  it('uses the original power hull for both decimal places and the original d4 for the bonus', () => {
    const mixed = { ...percentile, bonusD4: true };
    for (const index of [0, 1]) {
      expect(dieModel(mixed, index).faces).toBe(faces);
      expect(dieModel(mixed, index).vertices).toBe(vertices);
      expect(dieConfigForIndex(mixed, index)).toEqual(percentile);
    }
    expect(dieConfigForIndex(mixed, 2)).toEqual({ kind: 'dice', sides: 4, count: 1 });
    expect(dieModel(mixed, 2)).toBe(dieModel({ kind: 'dice', sides: 4, count: 1 }));
    expect(dieModel(mixed, 2).vertexRead).toBe(true);
    expect(dieModel({ kind: 'dice', sides: 10, count: 1 }).faces).toHaveLength(10);
  });

  it('keeps the exact existing pair motion and reveals supplied decimal-place faces', () => {
    for (const values of [[4, 7], [10, 6], [9, 9], [10, 1], [10, 10]]) {
      const motion = simulateThrow(1, values, { dice: percentile, scale: trayDieScale(2) });
      const power = simulateThrow(1, values, { dice: { kind: 'power', sides: 10, count: 2 }, scale: trayDieScale(2) });
      expect(motion.samples).toEqual(power.samples);
      expect(motion.offsets).toEqual(power.offsets);
      const last = motion.samples.slice(-14);
      for (const index of [0, 1]) {
        const body = new Quaternion().fromArray(last, index * 7 + 3).normalize();
        const offset = new Quaternion().fromArray(motion.offsets, index * 4);
        const pose = body.clone().multiply(offset);
        expect(offset.toArray()).toEqual(numberingOrientation(body, values[index]!, index).toArray());
        expect(faceForResult(values[index]!, index).normal.clone().applyQuaternion(pose).y)
          .toBeCloseTo(Math.max(...faces.map(face => face.normal.clone().applyQuaternion(pose).y)), 5);
      }
    }
  });

  it('records all three physical tracks and reveals the supplied d4 tip', () => {
    const config = { ...percentile, bonusD4: true };
    const motion = simulateThrow(1, [4, 7, 4], { dice: config, scale: trayDieScale(3) });
    expect(motion.samples.length % 21).toBe(0);
    expect(motion.offsets).toHaveLength(12);
    const last = motion.samples.slice(-21);
    for (const index of [0, 1, 2]) {
      const model = dieModel(config, index);
      const body = new Quaternion().fromArray(last, index * 7 + 3).normalize();
      const offset = new Quaternion().fromArray(motion.offsets, index * 4);
      const pose = body.clone().multiply(offset);
      expect(model.vertices.every(vertex => model.vertices.some(other =>
        other.distanceTo(vertex.clone().applyQuaternion(offset)) < 1e-5))).toBe(true);
      if (index === 2)
        expect(model.vertices[3]!.clone().applyQuaternion(pose).y)
          .toBeCloseTo(Math.max(...model.vertices.map(vertex => vertex.clone().applyQuaternion(pose).y)), 5);
      else
        expect(faceForResult([4, 7][index]!, index).normal.clone().applyQuaternion(pose).y)
          .toBeCloseTo(Math.max(...faces.map(face => face.normal.clone().applyQuaternion(pose).y)), 5);
    }
  });

  it('the actual planning worker prepares the bonus hull and relabels all three supplied results', async () => {
    const scope = {
      postMessage: vi.fn(),
      onmessage: undefined as unknown as (event: MessageEvent) => void,
    };
    vi.useFakeTimers();
    vi.stubGlobal('self', scope);
    vi.stubGlobal('crypto', { getRandomValues: (values: Uint32Array) => values.fill(1) });
    try {
      await import('../web/dice-demo/physics-worker');
      scope.onmessage(new MessageEvent('message', { data: {
        id: 42,
        faces: [4, 7, 4],
        scene: { dice: { ...percentile, bonusD4: true }, scale: trayDieScale(3) },
      } }));
      expect(scope.postMessage).toHaveBeenCalledOnce();
      const response = scope.postMessage.mock.calls[0]![0];
      expect(response.error).toBeUndefined();
      expect(response.id).toBe(42);
      expect(response.motion.samples.length % 21).toBe(0);
      expect(response.motion.offsets).toHaveLength(12);
      const final = response.motion.samples.slice(-21);
      const pose = new Quaternion().fromArray(final, 17).normalize()
        .multiply(new Quaternion().fromArray(response.motion.offsets, 8));
      const model = dieModel({ kind: 'dice', sides: 4, count: 1 });
      expect(model.vertices[3]!.clone().applyQuaternion(pose).y)
        .toBeCloseTo(Math.max(...model.vertices.map(vertex => vertex.clone().applyQuaternion(pose).y)), 5);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('reuses pair geometry, UVs, finishes and font painting for the new labels', () => {
    const texts: { glyph: string; font: string }[] = [];
    vi.stubGlobal('document', {
      createElement() {
        const ctx = {
          font: '', fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {},
          bezierCurveTo() {}, stroke() {}, putImageData() {},
          fillText(glyph: string) { texts.push({ glyph, font: this.font }); },
          getImageData() { return { data: new Uint8ClampedArray(256 * 256 * 4).fill(255) }; },
        };
        return { getContext() { return ctx; } };
      },
    });
    try {
      for (const pattern of ['solid', 'speckle', 'marble', 'frosted'] as const)
        for (const font of ['serif', 'modern', 'rune', 'gothic'] as const)
          for (const index of [0, 1]) {
            const style: Style = { color: '#aa3322', ink: '#ffffff', pattern, font };
            const original = createD10(style, index);
            texts.length = 0;
            const actual = createDie(style, percentile, index);
            expect(actual.scale.toArray()).toEqual(original.scale.toArray());
            expect(actual.children).toHaveLength(20);
            expect(texts.some(text => text.glyph === (index ? '0' : '00'))).toBe(true);
            expect(texts.every(text => text.font.includes(index ? '78px' : '64px'))).toBe(true);
            // Frosted masks must use the same glyphs as the visible paint.
            expect(texts).toHaveLength(pattern === 'frosted' ? 20 : 10);
            actual.children.forEach((child, i) => {
              const mesh = child as Mesh, reference = original.children[i] as Mesh;
              expect(mesh.geometry.getAttribute('position').array)
                .toEqual(reference.geometry.getAttribute('position').array);
              expect(mesh.geometry.getAttribute('uv').array)
                .toEqual(reference.geometry.getAttribute('uv').array);
              const material = mesh.material as MeshStandardMaterial;
              const referenceMaterial = reference.material as MeshStandardMaterial;
              expect(material.map?.colorSpace).toBe(referenceMaterial.map?.colorSpace);
              expect(material.roughness).toBe(referenceMaterial.roughness);
              expect(material.metalness).toBe(referenceMaterial.metalness);
              expect(material.transparent).toBe(referenceMaterial.transparent);
              expect(material.depthWrite).toBe(referenceMaterial.depthWrite);
              if (pattern === 'frosted')
                expect(material.customProgramCacheKey()).toBe('dice-frosted-fresnel-85-v1');
            });
            disposeGroup(actual);
            disposeGroup(original);
          }
    } finally { vi.unstubAllGlobals(); }
  });
});
