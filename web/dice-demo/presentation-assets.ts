// SPDX-License-Identifier: MIT
import * as THREE from 'three';

// Immutable assets belong to a mounted renderer. Materials remain per die/lane.
// Only idle entries are evicted: overlapping/fading lanes cannot lose an asset.
const managed = new WeakMap<object, () => void>();
class AssetCache<T extends { dispose(): void }> {
  private entries = new Map<string, { resource: T; users: number }>();
  constructor(private readonly limit: number) {}
  acquire(key: string, create: () => T): T {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { resource: create(), users: 0 };
      this.entries.set(key, entry);
      const owned = entry;
      managed.set(entry.resource, () => {
        owned.users = Math.max(0, owned.users - 1);
        this.trim();
      });
    }
    entry.users++;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.trim();
    return entry.resource;
  }
  private trim() {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.limit) break;
      if (entry.users) continue;
      entry.resource.dispose();
      managed.delete(entry.resource);
      this.entries.delete(key);
    }
  }
  dispose() {
    for (const entry of this.entries.values()) {
      entry.resource.dispose();
      managed.delete(entry.resource);
    }
    this.entries.clear();
  }
}
export function releasePresentationAssets(resources: Iterable<{ dispose(): void }>) {
  const unpooled = new Set<{ dispose(): void }>();
  for (const resource of resources) {
    const release = managed.get(resource);
    if (release) release();
    else unpooled.add(resource);
  }
  for (const resource of unpooled) resource.dispose();
}
export class PresentationAssets {
  // 128 256-square face canvases: 32 MiB of base RGBA pixels, excluding GPU mipmaps.
  private textures = new AssetCache<THREE.Texture>(128);
  private geometries = new AssetCache<THREE.BufferGeometry>(128);
  texture(key: string, create: () => THREE.Texture) {
    return this.textures.acquire(key, create);
  }
  geometry(key: string, create: () => THREE.BufferGeometry) {
    return this.geometries.acquire(key, create);
  }
  dispose() {
    this.textures.dispose();
    this.geometries.dispose();
  }
}
