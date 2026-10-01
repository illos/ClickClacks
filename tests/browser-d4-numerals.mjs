// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(process.env.POWERROLLER_TEST_URL ?? 'http://127.0.0.1:9594/powerroller/');
  const results = await page.evaluate(async () => {
    const { createDie, dieModel } = await import('/powerroller/web/dice-demo/dice-models.ts');
    const { loadDiceFonts } = await import('/powerroller/web/dice-demo/fonts.ts');
    await loadDiceFonts();
    const config = { kind: 'dice', sides: 4, count: 1 }, vertices = dieModel(config).vertices;
    const results = [];
    const sheet = document.createElement('div');
    sheet.style.cssText = 'display:flex;gap:12px;background:#222;padding:16px;position:fixed;inset:0;z-index:100';
    document.body.append(sheet);
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    const calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      const transform = this.getTransform();
      calls.push({ canvas: this.canvas, text, x, y, transform });
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      for (const font of [undefined, 'serif', 'modern', 'rune', 'gothic']) {
        const column = document.createElement('div');
        column.textContent = font ?? 'Original';
        sheet.append(column);
        for (const pattern of ['solid', 'frosted']) {
          calls.length = 0;
          const model = createDie({ color: '#000000', ink: '#ffffff', pattern, ...(font ? { font } : {}) }, config);
          for (const mesh of model.children) {
            const canvas = mesh.material.map.image, pixels = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
            const uv = mesh.geometry.getAttribute('uv'), position = mesh.geometry.getAttribute('position');
            const points = [0, 1, 2].map(i => [uv.getX(i) * 256, (1 - uv.getY(i)) * 256]);
            const faceCalls = calls.filter(call => call.canvas === canvas);
            const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
            const center = points.reduce((sum, p) => [sum[0] + p[0] / 3, sum[1] + p[1] / 3], [0, 0]);
            let clipped = 0, ink = 0;
            const labels = faceCalls.map((call, i) => {
              const { a, b, c, d, e, f } = call.transform;
              const glyphCenter = [a * call.x + c * call.y + e, b * call.x + d * call.y + f];
              const outward = [points[i][0] - center[0], points[i][1] - center[1]];
              const top = [-c, -d]; // Canvas glyphs rise along their local negative Y axis.
              const topAlignment = (top[0] * outward[0] + top[1] * outward[1]) / (Math.hypot(...top) * Math.hypot(...outward));
              const vertexIndex = vertices.findIndex(v => Math.hypot(v.x - position.getX(i), v.y - position.getY(i), v.z - position.getZ(i)) < 1e-5);
              return { value: call.text, expectedValue: String(vertexIndex + 1), topAlignment, centerDistance: Math.hypot(glyphCenter[0] - center[0], glyphCenter[1] - center[1]) };
            });
            for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (pixels[(y * 256 + x) * 4] > 128) {
              ink++;
              const signs = points.map((a, i) => cross(a, points[(i + 1) % 3], [x + .5, y + .5]));
              if (!(signs.every(n => n >= 0) || signs.every(n => n <= 0))) clipped++;
            }
            // Frosted coverage is painted on a second canvas immediately after the visible face.
            const mainStart = calls.findIndex(call => call.canvas === canvas);
            const maskMatches = pattern !== 'frosted' || faceCalls.every((call, i) => {
              const mask = calls[mainStart + 3 + i];
              return mask.text === call.text && mask.x === call.x && mask.y === call.y && ['a', 'b', 'c', 'd', 'e', 'f'].every(key => mask.transform[key] === call.transform[key]);
            });
            results.push({ font: font ?? 'Original', pattern, ink, clipped, labels, maskMatches });
            if (pattern === 'solid') {
              const sample = document.createElement('canvas');
              sample.width = sample.height = 256;
              sample.style.cssText = 'display:block;width:200px;height:200px';
              const ctx = sample.getContext('2d');
              ctx.beginPath();
              points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
              ctx.closePath(); ctx.clip(); ctx.drawImage(canvas, 0, 0); column.append(sample);
            }
          }
          for (const mesh of model.children) { mesh.geometry.dispose(); mesh.material.map.dispose(); mesh.material.dispose(); }
        }
      }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
    return results;
  });
  for (const result of results) {
    const label = `${result.font} ${result.pattern}`;
    expect(result.ink).toBeGreaterThan(400);
    expect(result.clipped, `${label} numerals stay on their triangular face`).toBe(0);
    expect(result.labels).toHaveLength(3);
    expect(result.maskMatches, `${label} opacity coverage matches the rotated numerals`).toBe(true);
    for (const glyph of result.labels) {
      expect(glyph.value, `${label} vertex numbering`).toBe(glyph.expectedValue);
      expect(glyph.topAlignment, `${label} numeral ${glyph.value} points outward toward its vertex`).toBeGreaterThan(.99999);
      expect(glyph.centerDistance, `${label} corner inset`).toBeCloseTo(132 / 2.15, 4);
    }
  }
  await page.screenshot({ path: '/tmp/powerroller-d4-fonts.png' });
  console.log('PASS: 40 d4 face textures / 120 labels point outward with original vertex numbering and inset; all fonts stay unclipped; frosted coverage matches');
} finally { await browser.close(); }
