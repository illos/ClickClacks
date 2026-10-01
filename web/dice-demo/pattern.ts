// SPDX-License-Identifier: MIT
import type { Style } from './model';

/** Original procedural surface decoration shared by dice textures and design swatches. */
export function paintDiePattern(ctx: CanvasRenderingContext2D, style: Style, background?: CanvasGradient) {
  ctx.fillStyle = background ?? style.color;
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
}
