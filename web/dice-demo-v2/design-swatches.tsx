// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react';
import type { Style } from '../dice-demo/model';
import { paintDiePattern } from '../dice-demo/pattern';
import { dieFonts, dieFontFamilies, dieFontWeights } from '../dice-demo/font-style';

function PatternSample({ style }: { style: Style }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) paintDiePattern(context, style);
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
