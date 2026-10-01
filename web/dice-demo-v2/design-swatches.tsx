// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react';
import type { Style } from '../dice-demo/model';
import { paintDiePattern } from '../dice-demo/pattern';
import { dieFonts, dieFontFamilies, dieFontWeights } from '../dice-demo/font-style';

function PatternSample({ style }: { style: Style }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    let background: CanvasGradient | undefined;
    if (style.pattern === 'frosted') {
      // Preview the die shader's quadratic rim glow as a left-to-right ramp.
      // d10.ts mixes linear-light RGB toward 1.8 with frostGlow * 0.85.
      const gradient = context.createLinearGradient(0, 0, 256, 0);
      const rgb = [1, 3, 5].map(start => parseInt(style.color.slice(start, start + 2), 16) / 255);
      const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      for (let step = 0; step <= 8; step++) {
        const t = step / 8, glow = t * t * 0.85;
        const color = linear.map(c => {
          const light = c * (1 - glow) + 1.8 * glow;
          const srgb = light <= 0.0031308 ? light * 12.92 : 1.055 * light ** (1 / 2.4) - 0.055;
          return Math.round(Math.min(1, srgb) * 255);
        });
        gradient.addColorStop(t, `rgb(${color.join(',')})`);
      }
      background = gradient;
    }
    paintDiePattern(context, style, background);
  }, [style.color, style.ink, style.pattern]);
  return <canvas ref={canvas} width={256} height={256} aria-hidden="true" />;
}

export function DesignSwatches({ style, onChange, active }: { active: boolean; style: Style; onChange: (change: Partial<Style>) => void }) {
  // Fonts are needed for these SVG samples even when 3D dice are hidden.
  useEffect(() => { if (active) void import('../dice-demo/fonts').then(fonts => fonts.loadDiceFonts()); }, [active]);
  const fonts = style.font ? dieFonts : [undefined, ...dieFonts];
  return <>
    <div className="design-options full-field" role="group" aria-label="Pattern">
      <span className="design-options-label">Pattern</span>
      <div className="design-swatch-grid">
        {(['solid', 'speckle', 'marble', 'frosted'] as const).map(pattern => <button
          type="button" key={pattern} aria-pressed={style.pattern === pattern}
          onClick={() => onChange({ pattern })}
        >
          <PatternSample style={{ ...style, pattern }} />
          <span>{pattern[0]!.toUpperCase() + pattern.slice(1)}</span>
        </button>)}
      </div>
    </div>
    <div className="design-options full-field" role="group" aria-label="Font style">
      <span className="design-options-label">Font style</span>
      <div className="design-swatch-grid">
        {fonts.map(font => <button
          type="button" key={font ?? 'legacy'} aria-pressed={style.font === font}
          disabled={!font} onClick={() => onChange({ font })}
        >
          <svg viewBox="0 0 80 54" aria-hidden="true" style={{ backgroundColor: style.color }}>
            <text x="40" y="37" textAnchor="middle" fill={style.ink} fontSize="32"
              fontFamily={font ? dieFontFamilies[font] : 'Georgia'} fontWeight={font ? dieFontWeights[font] : 600}>01</text>
          </svg>
          <span>{font ? font[0]!.toUpperCase() + font.slice(1) : 'Original'}</span>
        </button>)}
      </div>
    </div>
  </>;
}
