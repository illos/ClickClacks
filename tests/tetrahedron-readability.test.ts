// SPDX-License-Identifier: MIT
import { it, expect, vi } from 'vitest';
import { Quaternion, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { createDie, modelNumberingOrientation } from '../web/dice-demo/dice-models';
it('a tetrahedron prints the accepted upper vertex on all three adjoining visible facets', () => {
  type Label = { text: string; x: number; y: number };
  vi.stubGlobal('document', {
    createElement() {
      const labels: Label[] = [];
      let origin = { x: 0, y: 0 };
      const stack: typeof origin[] = [];
      return {
        labels,
        getContext() {
          return {
            fillRect() {},
            save() { stack.push({ ...origin }); },
            restore() { origin = stack.pop()!; },
            translate(x: number, y: number) { origin.x += x; origin.y += y; },
            rotate() {},
            fillText(text: string, x: number, y: number) {
              labels.push({ text, x: origin.x + x, y: origin.y + y });
            },
          };
        },
      };
    },
  });
  try {
    const config = { kind: 'dice' as const, sides: 4 as const, count: 1 };
    const die = createDie({ color: '#aa3322', ink: '#ffffff', pattern: 'solid' }, config);
    const body = new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 1.74);
    for (let accepted = 1; accepted <= 4; accepted++) {
      const pose = body.clone().multiply(modelNumberingOrientation(body, accepted, 0, config));
      let highest = -Infinity;
      for (const mesh of die.children as Mesh[]) {
        const position = mesh.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++)
          highest = Math.max(
            highest,
            new Vector3().fromBufferAttribute(position, i).applyQuaternion(pose).y,
          );
      }
      let readable = 0;
      for (const mesh of die.children as Mesh[]) {
        const position = mesh.geometry.getAttribute('position'),
          uv = mesh.geometry.getAttribute('uv');
        for (let i = 0; i < position.count; i++) {
          if (
            Math.abs(
              new Vector3().fromBufferAttribute(position, i).applyQuaternion(pose).y - highest,
            ) > 1e-5
          )
            continue;
          const labels = ((mesh.material as MeshStandardMaterial).map!.image as { labels: Label[] })
            .labels;
          const x = uv.getX(i) * 256,
            y = (1 - uv.getY(i)) * 256;
          const nearest = [...labels].sort(
            (a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2),
          )[0]!;
          expect(nearest.text).toBe(String(accepted));
          readable++;
          break;
        }
      }
      expect(readable).toBe(3);
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
