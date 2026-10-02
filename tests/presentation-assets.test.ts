// SPDX-License-Identifier: MIT
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PresentationAssets, releasePresentationAssets } from '../web/dice-demo/presentation-assets';
import { disposeGroup } from '../web/dice-demo/d10';
it('shares immutable resources while lane materials and disposal stay independent', () => {
  const assets = new PresentationAssets();
  const create = () => {
    const geometry = assets.geometry('face', () => new THREE.PlaneGeometry());
    const map = assets.texture('numeral', () => new THREE.Texture());
    const material = new THREE.MeshStandardMaterial({ map });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));
    return { group, geometry, material, map };
  };
  const first = create(), second = create();
  const deleted = vi.fn();
  second.map.addEventListener('dispose', deleted);
  expect(first.geometry).toBe(second.geometry);
  expect(first.map).toBe(second.map);
  first.material.opacity = .2;
  expect(second.material.opacity).toBe(1);
  disposeGroup(first.group);
  expect(deleted).not.toHaveBeenCalled();
  disposeGroup(second.group);
  assets.dispose();
  expect(deleted).toHaveBeenCalledTimes(1);
});
it('evicts only idle textures and drops the entire renderer cache on disposal', () => {
  const assets = new PresentationAssets();
  const active = assets.texture('active', () => new THREE.Texture());
  const held = vi.fn();
  active.addEventListener('dispose', held);
  let evicted = 0;
  for (let i = 0; i < 140; i++) {
    const texture = assets.texture(String(i), () => new THREE.Texture());
    texture.addEventListener('dispose', () => evicted++);
    releasePresentationAssets([texture]);
  }
  expect(held).not.toHaveBeenCalled();
  expect(evicted).toBe(13);
  assets.dispose();
  expect(held).toHaveBeenCalledTimes(1);
  expect(evicted).toBe(140);
});
it('keeps preview textures bounded without disposing maps still displayed', () => {
  const assets = new PresentationAssets({ textures: 40, geometries: 8 });
  const displayed = assets.texture('displayed', () => new THREE.Texture());
  const held = vi.fn();
  displayed.addEventListener('dispose', held);
  let evicted = 0;
  for (let i = 0; i < 60; i++) {
    const texture = assets.texture(String(i), () => new THREE.Texture());
    texture.addEventListener('dispose', () => evicted++);
    releasePresentationAssets([texture]);
  }
  expect(evicted).toBe(21);
  expect(held).not.toHaveBeenCalled();
  assets.dispose();
  expect(held).toHaveBeenCalledTimes(1);
  expect(evicted).toBe(60);
});
it('reuses twenty authored face maps for a twenty-die pool without changing glyphs', async () => {
  const { createDie } = await import('../web/dice-demo/dice-models');
  let canvases = 0;
  vi.stubGlobal('document', { createElement: () => {
    canvases++;
    const glyphs: string[] = [];
    return { glyphs, getContext: () => ({ fillRect() {}, fillText: (text: string) => glyphs.push(text) }) };
  } });
  const assets = new PresentationAssets();
  const pool = new THREE.Group();
  try {
    for (let i = 0; i < 20; i++)
      pool.add(createDie({ color: '#aa3322', ink: '#ffffff', pattern: 'solid' },
        { kind: 'dice', sides: 20, count: 20 }, i, assets));
    expect(canvases).toBe(20);
    const maps = new Set<THREE.Texture>();
    pool.traverse(object => {
      if (object instanceof THREE.Mesh)
        maps.add((object.material as THREE.MeshStandardMaterial).map!);
    });
    expect(maps.size).toBe(20);
    expect([...maps].flatMap(map => (map.image as { glyphs: string[] }).glyphs).sort()).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 1)).sort());
    disposeGroup(pool);
    // Repeated group disposal must not release resources owned by other lanes.
    disposeGroup(pool);
  } finally { assets.dispose(); vi.unstubAllGlobals(); }
});
