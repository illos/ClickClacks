// SPDX-License-Identifier: MIT
// Source artwork for both link cards. Raster files are emitted only at build time.
import {readFile, writeFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {IcosahedronGeometry, Vector3, Quaternion, OrthographicCamera, Color} from 'three';

const root = new URL('../../', import.meta.url);
const geometry = new IcosahedronGeometry(1.25, 0);
const positions = geometry.getAttribute('position');
const faces = Array.from({length: 20}, (_, i) => {
  const points = Array.from({length: 3}, (_, j) => new Vector3().fromBufferAttribute(positions, i * 3 + j));
  const center = points.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / 3);
  const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  if (normal.dot(center) < 0) normal.negate();
  return {points, center, normal, value: i % 10 + 1};
});
geometry.dispose();
const light = new Vector3(-3, 7, 5).normalize();
const camera = new OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 20);
camera.position.set(0, 6, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const towardsCamera = camera.position.clone().normalize();
const n = value => Number(value.toFixed(3));

// Project the app's 20 triangular faces and numbering into shaded vector artwork.
// A fixed orientation keeps the intended top face, exactly like the real die mesh.
function die(x, y, size, color, ink, result, index = 0, yaw = 0) {
  const target = faces[result - 1 + index * 10];
  const rotation = new Quaternion().setFromUnitVectors(target.normal, new Vector3(0, 1, 0));
  rotation.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  const project = p => {
    const q = p.clone().applyQuaternion(rotation).project(camera);
    return [n(x + q.x * size / 2), n(y - q.y * size / 2)];
  };
  const distance = p => p.clone().applyQuaternion(rotation).applyMatrix4(camera.matrixWorldInverse).z;
  return `<g>${faces.filter(f => f.normal.clone().applyQuaternion(rotation).dot(towardsCamera) > 0.025)
    .sort((a, b) => distance(a.center) - distance(b.center)).map(f => {
      const normal = f.normal.clone().applyQuaternion(rotation);
      const shade = 0.55 + 0.55 * Math.max(0, normal.dot(light));
      const body = new Color(color).multiplyScalar(shade).getHexString();
      const [cx, cy] = project(f.center);
      const up = f.points[0].clone().sub(f.center).normalize();
      const right = up.clone().cross(f.normal).normalize();
      const px = project(f.center.clone().addScaledVector(right, 0.032));
      const py = project(f.center.clone().addScaledVector(up, -0.032));
      const matrix = [px[0] - cx, px[1] - cy, py[0] - cx, py[1] - cy, cx, cy].map(n).join(' ');
      const label = String(f.value % 10).padStart(index === 1 ? 2 : 1, '0');
      return `<polygon points="${f.points.map(project).map(p => p.join(',')).join(' ')}" fill="#${body}" stroke="#ffffff" stroke-opacity=".12" stroke-width="1.1" stroke-linejoin="round"/>` +
        (normal.dot(towardsCamera) > 0.22 ? `<text transform="matrix(${matrix})" x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${label.length === 2 ? 13 : 16}" font-weight="700" fill="${ink}">${label}</text>` : '');
    }).join('')}</g>`;
}

export async function writeSocialPreview(path) {
  const wordmark = await readFile(new URL('web/branding/click-clacks.svg', root), 'utf8');
  const logo = wordmark.replace('<svg ', '<svg x="48" y="12" width="348" height="152" ');
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="back"><stop stop-color="#283d38"/><stop offset="1" stop-color="#111415"/></radialGradient>
    <radialGradient id="tray"><stop stop-color="#283331"/><stop offset="1" stop-color="#151b1c"/></radialGradient>
    <linearGradient id="rim"><stop stop-color="#6edbc0"/><stop offset=".5" stop-color="#3c5050"/><stop offset="1" stop-color="#eaa0b3"/></linearGradient>
    <filter id="shadow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="13"/></filter>
    <clipPath id="clip"><rect x="47" y="171" width="1106" height="414" rx="24"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#back)"/>
  <path d="M-50 600L700-70M650 680L1260 70" stroke="#6edbc0" stroke-opacity=".07" stroke-width="70"/>
  ${logo}
  <g font-family="DejaVu Sans, sans-serif" fill="#e8e5df">
    <text x="475" y="82" font-size="43" font-weight="700">Multiplayer 3D dice</text>
    <text x="478" y="123" font-size="23" fill="#b6c7c3">Free - Open source</text>
    <rect x="46" y="170" width="1108" height="416" rx="25" fill="url(#tray)" stroke="url(#rim)" stroke-width="2"/>
    <g clip-path="url(#clip)">
      <circle cx="76" cy="204" r="5" fill="#6edbc0"/>
      <text x="92" y="210" font-size="16" fill="#b6c7c3">3 / 8 participants</text>
      <rect x="956" y="188" width="166" height="34" rx="17" fill="#25312f"/>
      <text x="1039" y="210" text-anchor="middle" font-size="14" fill="#6edbc0">Shared table</text>
      <path d="M246 384Q332 253 468 299M555 399Q629 293 752 304" fill="none" stroke="#6edbc0" stroke-width="3" stroke-opacity=".18" stroke-linecap="round"/>
      <path d="M590 429Q643 346 732 326M820 337Q885 275 922 280" fill="none" stroke="#eaa0b3" stroke-width="3" stroke-opacity=".15" stroke-linecap="round"/>
      <ellipse cx="442" cy="401" rx="72" ry="15" fill="#000000" opacity=".6" filter="url(#shadow)"/>
      <ellipse cx="731" cy="410" rx="82" ry="14" fill="#000000" opacity=".6" filter="url(#shadow)"/>
      <ellipse cx="941" cy="351" rx="44" ry="10" fill="#000000" opacity=".5" filter="url(#shadow)"/>
      ${die(934, 297, 135, '#b5a4df', '#34284a', 10, 0, -0.65)}
      ${die(435, 322, 226, '#6edbc0', '#142d26', 8, 0, 0.12)}
      ${die(715, 344, 240, '#eaa0b3', '#492233', 7, 1, 0.25)}
      <rect x="67" y="441" width="1066" height="46" rx="9" fill="#1d2627" stroke="#394644"/>
      <circle cx="91" cy="464" r="7" fill="#6edbc0"/>
      <text x="110" y="470" font-size="16">Ariadne</text>
      <text x="292" y="470" font-size="15" fill="#b6c7c3">8 + 7</text>
      <text x="1087" y="472" text-anchor="end" font-size="22" font-weight="700" fill="#6edbc0">15</text>
      <line x1="47" y1="504" x2="1153" y2="504" stroke="#3b4849"/>
      <rect x="69" y="523" width="45" height="43" rx="9" fill="#283432" stroke="#3f514e"/>
      <path d="M82 535H101M82 544H101M82 553H101" stroke="#6edbc0" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="133" y="523" width="151" height="43" rx="22" fill="#263e3a" stroke="#435552"/>
      <text x="154" y="551" font-size="20" font-weight="700" fill="#6edbc0">↑ Edge 0</text>
      <rect x="297" y="523" width="154" height="43" rx="22" fill="#423236" stroke="#58474d"/>
      <text x="318" y="551" font-size="20" font-weight="700" fill="#ff8797">↓ Bane 0</text>
      <text x="624" y="551" text-anchor="middle" font-size="16" fill="#99abaa">dice.clickclacks.app</text>
      <rect x="956" y="520" width="177" height="49" rx="25" fill="#b5a4df"/>
      <path d="M982 535L994 529L1006 536V551L994 558L982 551Z" fill="none" stroke="#34284a" stroke-width="2"/>
      <text x="1058" y="553" font-size="21" font-weight="700" fill="#34284a">Roll</text>
    </g>
  </g>
  </svg>`;
  await writeFile(path, new Resvg(card, {font: {loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans'}}).render().asPng());
}
