// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import type { PresentationAssets } from './presentation-assets';
import {
  createD10,
  createDieMaterial,
  dieFontFamilies,
  dieFontWeights,
  faces as powerFaces,
  vertices as powerVertices,
  faceForResult,
} from './d10';
import { dieSides } from '../../shared/dice';
import type { DiceConfig, DiceSides, Style } from './model';
export type DieFace = {
  points: THREE.Vector3[];
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  value: number;
};
export type DieModel = {
  faces: DieFace[];
  vertices: THREE.Vector3[];
  vertexRead?: boolean;
};
const radius = 1.25;
function face(points: THREE.Vector3[]): DieFace {
  const centroid = points
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  let normal = points[1]!
    .clone()
    .sub(points[0]!)
    .cross(points[2]!.clone().sub(points[0]!))
    .normalize();
  if (normal.dot(centroid) < 0) {
    points.reverse();
    normal.negate();
  }
  return { points, normal, centroid, value: 0 };
}
const unique = (points: THREE.Vector3[]) => [
  ...new Map(
    points.map(p => [
      p
        .toArray()
        .map(n => n.toFixed(6))
        .join(','),
      p,
    ]),
  ).values(),
];
function polyhedron(geometry: THREE.BufferGeometry): DieModel {
  if (geometry.index) {
    const expanded = geometry.toNonIndexed();
    geometry.dispose();
    geometry = expanded;
  }
  const pos = geometry.getAttribute('position'),
    triangles: DieFace[] = [];
  for (let i = 0; i < pos.count; i += 3)
    triangles.push(
      face(
        Array.from({ length: 3 }, (_, j) => new THREE.Vector3().fromBufferAttribute(pos, i + j)),
      ),
    );
  geometry.dispose();
  const planes: DieFace[][] = [];
  for (const triangle of triangles) {
    const plane = planes.find(
      p =>
        p[0]!.normal.distanceTo(triangle.normal) < 1e-5 &&
        Math.abs(p[0]!.normal.dot(p[0]!.centroid) - triangle.normal.dot(triangle.centroid)) < 1e-5,
    );
    if (plane) plane.push(triangle);
    else planes.push([triangle]);
  }
  const faces = planes.map(plane => {
    const points = unique(plane.flatMap(f => f.points)),
      centroid = points
        .reduce((s, p) => s.add(p), new THREE.Vector3())
        .multiplyScalar(1 / points.length),
      normal = plane[0]!.normal,
      v = points[0]!.clone().sub(centroid).normalize(),
      u = v.clone().cross(normal).normalize();
    points.sort(
      (a, b) =>
        Math.atan2(a.clone().sub(centroid).dot(u), a.clone().sub(centroid).dot(v)) -
        Math.atan2(b.clone().sub(centroid).dot(u), b.clone().sub(centroid).dot(v)),
    );
    return face(points);
  });
  return { faces, vertices: unique(faces.flatMap(f => f.points)) };
}
/** Dual of an equilateral pentagonal antiprism: ten actual congruent kite faces. */
function trapezohedron(): DieModel {
  const ring = Array.from({ length: 10 }, (_, i) => {
    const upper = i < 5,
      angle = (((i % 5) * 2 + (upper ? 0 : 1)) * Math.PI) / 5;
    return new THREE.Vector3(Math.cos(angle), upper ? 0.5 : -0.5, Math.sin(angle));
  });
  const indices: number[][] = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
  ];
  for (let i = 0; i < 5; i++)
    indices.push([i, 5 + i, (i + 1) % 5], [5 + i, 5 + ((i + 1) % 5), (i + 1) % 5]);
  const dual = indices.map(list => {
    const f = face(list.map(i => ring[i]!.clone()));
    return f.normal.clone().divideScalar(f.normal.dot(f.points[0]!));
  });
  const scale = radius / Math.max(...dual.map(v => v.length()));
  dual.forEach(v => v.multiplyScalar(scale));
  const faces = ring.map((normal, index) => {
    const points = indices.flatMap((list, j) => (list.includes(index) ? [dual[j]!.clone()] : [])),
      centroid = points
        .reduce((s, p) => s.add(p), new THREE.Vector3())
        .multiplyScalar(1 / points.length),
      v = points[0]!.clone().sub(centroid).normalize(),
      u = v.clone().cross(normal.clone().normalize()).normalize();
    points.sort(
      (a, b) =>
        Math.atan2(a.clone().sub(centroid).dot(u), a.clone().sub(centroid).dot(v)) -
        Math.atan2(b.clone().sub(centroid).dot(u), b.clone().sub(centroid).dot(v)),
    );
    return face(points);
  });
  return { faces, vertices: unique(faces.flatMap(f => f.points)) };
}
const genericModels = new Map<DiceSides, DieModel>();
/** A resting obstacle owns one hull; the optional bonus occupies the final pool slot. */
export function dieConfigForIndex(
  config: DiceConfig | undefined,
  index: number,
): DiceConfig | undefined {
  if (!config || config.kind === 'power') return config;
  if (config.kind === 'percentile' && index < 2)
    return { kind: 'percentile', sides: 10, count: 2 };
  return { kind: 'dice', sides: dieSides(config, index) as DiceSides, count: 1 };
}
export function dieModel(config?: DiceConfig, index = 0): DieModel {
  config = dieConfigForIndex(config, index);
  if (!config || config.kind === 'power' || config.kind === 'percentile')
    return { faces: powerFaces, vertices: powerVertices };
  let model = genericModels.get(config.sides);
  if (model) return model;
  const sides = config.sides;
  model =
    sides === 10
      ? trapezohedron()
      : polyhedron(
          sides === 4
            ? new THREE.TetrahedronGeometry(radius, 0)
            : sides === 6
              ? new THREE.BoxGeometry(
                  (2 * radius) / Math.sqrt(3),
                  (2 * radius) / Math.sqrt(3),
                  (2 * radius) / Math.sqrt(3),
                )
              : sides === 8
                ? new THREE.OctahedronGeometry(radius, 0)
                : sides === 12
                  ? new THREE.DodecahedronGeometry(radius, 0)
                  : new THREE.IcosahedronGeometry(radius, 0),
        );
  if (sides === 4) {
    model.vertexRead = true;
    model.faces.forEach((f, i) => (f.value = i + 1));
  } else {
    let next = 1;
    for (const [faceIndex, f] of model.faces.entries()) {
      if (f.value) continue;
      f.value = next++;
      const opposite = model.faces.find(other => other.normal.dot(f.normal) < -0.99999);
      if (opposite) opposite.value = sides + 1 - f.value;
    }
  }
  genericModels.set(sides, model);
  return model;
}
function frame(normal: THREE.Vector3, direction: THREE.Vector3) {
  const z = normal.clone().normalize(),
    y = direction.clone().addScaledVector(z, -direction.dot(z)).normalize(),
    x = y.clone().cross(z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function faceFrame(f: DieFace) {
  return frame(f.normal, f.points[0]!.clone().sub(f.centroid));
}
/** Relabel by actual solid symmetry; it never rotates the physical resting hull. */
export function modelNumberingOrientation(
  body: THREE.Quaternion,
  value: number,
  index: number,
  config?: DiceConfig,
) {
  const model = dieModel(config, index);
  if (model.vertexRead) {
    const target = [...model.vertices].sort(
        (a, b) => b.clone().applyQuaternion(body).y - a.clone().applyQuaternion(body).y,
      )[0]!,
      original = model.vertices[value - 1]!;
    const from = frame(
      original,
      model.vertices[value % model.vertices.length]!.clone().sub(original),
    );
    for (const neighbor of model.vertices) {
      if (neighbor === target) continue;
      const q = frame(target, neighbor.clone().sub(target))
        .multiply(from.clone().invert())
        .normalize();
      if (
        model.vertices.every(v =>
          model.vertices.some(other => other.distanceTo(v.clone().applyQuaternion(q)) < 1e-5),
        )
      )
        return q;
    }
    throw new Error('No valid tetrahedral numbering symmetry.');
  }
  const target = [...model.faces].sort(
      (a, b) => b.normal.clone().applyQuaternion(body).y - a.normal.clone().applyQuaternion(body).y,
    )[0]!,
    original =
      !config || config.kind === 'power' || (config.kind === 'percentile' && index < 2)
        ? faceForResult(value, index)
        : model.faces.find(f => f.value === value)!;
  const from = faceFrame(original);
  for (const point of target.points) {
    const q = frame(target.normal, point.clone().sub(target.centroid))
      .multiply(from.clone().invert())
      .normalize();
    if (
      model.vertices.every(v =>
        model.vertices.some(other => other.distanceTo(v.clone().applyQuaternion(q)) < 1e-5),
      )
    )
      return q;
  }
  throw new Error('No valid polyhedral numbering symmetry.');
}
export function createDie(style: Style, config: DiceConfig | undefined, index = 0, assets?: PresentationAssets): THREE.Group {
  if (!config || config.kind === 'power') return createD10(style, index, 'power', assets);
  if (config.kind === 'percentile' && index < 2) return createD10(style, index, 'percentile', assets);
  const model = dieModel(config, index),
    group = new THREE.Group();
  group.scale.setScalar(0.5);
  for (const [faceIndex, f] of model.faces.entries()) {
    const v = f.points[0]!.clone().sub(f.centroid).normalize(),
      u = v.clone().cross(f.normal).normalize(),
      coords = f.points.map(p => {
        const d = p.clone().sub(f.centroid);
        return [d.dot(u), d.dot(v)];
      }),
      span = Math.max(...coords.flat().map(Math.abs)) * 2.15,
      positions: number[] = [],
      uv: number[] = [];
    for (let j = 1; j < f.points.length - 1; j++)
      for (const k of [0, j, j + 1]) {
        positions.push(...f.points[k]!.toArray());
        uv.push(0.5 + coords[k]![0]! / span, 0.5 + coords[k]![1]! / span);
      }
    const buildGeometry = () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.computeVertexNormals();
      return geometry;
    };
    const shapeKey = `generic:${dieSides(config, index)}:${faceIndex}`;
    const geometry = assets ? assets.geometry(shapeKey, buildGeometry) : buildGeometry();
    const painter = (ctx: CanvasRenderingContext2D, style: Style) => {
      const family = style.font
        ? `"${dieFontFamilies[style.font]}", Georgia, serif`
        : 'Georgia, serif';
      ctx.font = `${style.font ? dieFontWeights[style.font] : 600} ${model.vertexRead ? 64 : f.value >= 10 ? 64 : 78}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (model.vertexRead) {
        // Larger corner numerals sit farther inside the triangular face to avoid clipping.
        f.points.forEach((p, j) => {
          const value = model.vertices.findIndex(vertex => vertex.distanceTo(p) < 1e-5) + 1;
          ctx.save();
          ctx.translate(
            128 + (coords[j]![0]! / span) * 132,
            128 - (coords[j]![1]! / span) * 132,
          );
          // Each numeral's top points outward toward its vertex, as on a tip-read d4.
          ctx.rotate(Math.atan2(coords[j]![0]!, coords[j]![1]!));
          ctx.fillText(String(value), 0, 0);
          ctx.restore();
        });
      } else {
        ctx.fillText(String(f.value), 128, 132);
        if (f.value === 6 || f.value === 9) ctx.fillRect(108, 174, 40, 3);
      }
    };
    group.add(new THREE.Mesh(geometry, createDieMaterial(style, f.value, 0, painter, assets, shapeKey)));
  }
  return group;
}
