// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import type { Style } from './model';
import { dieFontFamilies, dieFontWeights, type DieFont } from './font-style';
export { dieFonts, dieFontFamilies, dieFontWeights, type DieFont } from './font-style';

// Logical d10: an icosahedron with twenty triangular faces, each digit 0–9 twice.
// This shape/labeling is the user's cosmetic direction; supplied results remain 1–10.
const source = new THREE.IcosahedronGeometry(1.25, 0);
const positions = source.getAttribute('position');
export const faces = Array.from({ length: 20 }, (_, i) => {
  const points = Array.from({ length: 3 }, (_, j) =>
    new THREE.Vector3().fromBufferAttribute(positions, i * 3 + j),
  );
  let normal = points[1]!
    .clone()
    .sub(points[0]!)
    .cross(points[2]!.clone().sub(points[0]!))
    .normalize();
  const centroid = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / 3);
  if (normal.dot(centroid) < 0) {
    points.reverse();
    normal = normal.negate();
  }
  return { points, normal, centroid, value: (i % 10) + 1 };
});
export const vertices = [
  ...new Map(
    faces
      .flatMap(face => face.points)
      .map(p => [
        p
          .toArray()
          .map(n => n.toFixed(6))
          .join(','),
        p,
      ]),
  ).values(),
];
source.dispose();
export function faceForResult(value: number, index: number) {
  return faces[value - 1 + (index % 2) * 10]!;
}
export function faceGlyph(value: number, index = 0) {
  return String(value % 10).padStart(index === 1 ? 2 : 1, '0');
}
export function finalOrientation(value: number, index: number) {
  const face = faceForResult(value, index);
  const q = new THREE.Quaternion().setFromUnitVectors(face.normal, new THREE.Vector3(0, 1, 0));
  const direction = face.points[0]!.clone().sub(face.centroid).applyQuaternion(q);
  const yaw = Math.atan2(direction.x, direction.z) + Math.PI + (index ? 0.18 : -0.16);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw).multiply(q);
}
export type DieStyle = Style;
function paintNumbers(ctx: CanvasRenderingContext2D, value: number, index: number, font?: DieFont) {
  const family = font ? `"${dieFontFamilies[font]}", Georgia, serif` : 'Georgia, serif';
  ctx.font = `${font ? dieFontWeights[font] : 600} ${index === 1 ? 64 : 78}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(faceGlyph(value, index), 128, 132);
  if (value === 6 || value === 9)
    ctx.fillRect(index === 1 ? 96 : 108, 174, index === 1 ? 64 : 40, 3);
}
function texture(style: DieStyle, value: number, index: number, painter?: NumeralPainter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = style.color;
  ctx.fillRect(0, 0, 256, 256);
  // Stable procedural decoration, no downloaded artwork or per-frame texture generation.
  if (style.pattern.startsWith('frosted')) {
    // Fine grain stays baked; rim brightness is camera-dependent in the shader below.
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
      ctx.globalAlpha = 0.035 + (i % 5) * 0.01;
      ctx.fillRect((i * 73 + 19) % 256, (i * i * 37 + 29) % 256, 1, 1);
    }
  } else if (style.pattern === 'speckle') {
    ctx.fillStyle = style.ink;
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 150; i++) {
      ctx.beginPath();
      ctx.arc((i * 73 + 19) % 256, (i * i * 37 + 29) % 256, 0.8 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style.pattern === 'marble') {
    ctx.strokeStyle = style.ink;
    ctx.globalAlpha = 0.16;
    for (let i = -5; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 45, 0);
      ctx.bezierCurveTo(i * 45 + 90, 75, i * 45 - 55, 160, i * 45 + 45, 256);
      ctx.lineWidth = 3 + ((i + 5) % 4);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = style.ink;
  if (painter) painter(ctx, style);
  else paintNumbers(ctx, value, index, style.font);
  if (style.pattern.startsWith('frosted')) {
    // Pack body-vs-ink coverage into texture alpha; the shader sets body/ink opacity separately.
    const mask = document.createElement('canvas');
    mask.width = mask.height = 256;
    const maskCtx = mask.getContext('2d')!;
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, 256, 256);
    maskCtx.fillStyle = '#000000';
    if (painter) painter(maskCtx, style);
    else paintNumbers(maskCtx, value, index, style.font);
    const pixels = ctx.getImageData(0, 0, 256, 256);
    const coverage = maskCtx.getImageData(0, 0, 256, 256).data;
    // Keep alpha >= 0.5: Canvas premultiplication would erase RGB at zero alpha.
    for (let i = 3; i < pixels.data.length; i += 4)
      pixels.data[i] = 128 + Math.round((coverage[i - 3]! * 127) / 255);
    ctx.putImageData(pixels, 0, 0);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
/** New models reuse the exact existing decoration, alpha coverage and Fresnel finish. */
export type NumeralPainter = (ctx: CanvasRenderingContext2D, style: DieStyle) => void;
export function createDieMaterial(
  style: DieStyle,
  value: number,
  index = 0,
  painter?: NumeralPainter,
) {
  const material = new THREE.MeshStandardMaterial({
    map: texture(style, value, index, painter),
    roughness: style.pattern.startsWith('frosted') ? 0.88 : 0.34,
    metalness: style.pattern.startsWith('frosted') ? 0 : 0.12,
    transparent: style.pattern.startsWith('frosted'),
    depthWrite: !style.pattern.startsWith('frosted'),
  });
  if (style.pattern.startsWith('frosted')) {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
              float frostFacing = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
              // Read coverage separately from the final 85% body opacity.
              float frostBody = clamp((diffuseColor.a / max(opacity, 0.0001) * 255.0 - 128.0) / 127.0, 0.0, 1.0);
              float frostGlow = (1.0 - frostFacing) * (1.0 - frostFacing);
              outgoingLight = mix(outgoingLight, vec3(1.8), frostGlow * 0.85 * frostBody);
              diffuseColor.a = mix(1.0, 0.85, frostBody) * opacity;
              #include <opaque_fragment>
            `,
      );
    };
    material.customProgramCacheKey = () => 'dice-frosted-fresnel-85-v1';
  }
  return material;
}
export function createD10(style: DieStyle, index = 0) {
  const group = new THREE.Group();
  group.scale.setScalar(0.5);
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  for (const face of faces) {
    const vAxis = face.points[0]!.clone().sub(face.centroid).normalize();
    const uAxis = vAxis.clone().cross(face.normal).normalize();
    const coords = face.points.map(p => {
      const d = p.clone().sub(face.centroid);
      return [d.dot(uAxis), d.dot(vAxis)];
    });
    const span = Math.max(...coords.flat().map(Math.abs)) * 2.15;
    const positions: number[] = [],
      uv: number[] = [];
    for (const i of [0, 1, 2]) {
      positions.push(...face.points[i]!.toArray());
      uv.push(0.5 + coords[i]![0]! / span, 0.5 + coords[i]![1]! / span);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    let material = materials.get(face.value);
    if (!material) {
      material = createDieMaterial(style, face.value, index);
      materials.set(face.value, material);
    }
    group.add(new THREE.Mesh(geometry, material));
  }
  return group;
}
export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
    }
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());
}
