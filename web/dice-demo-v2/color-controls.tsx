// SPDX-License-Identifier: MIT
import { useState } from 'react';

function channels(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r!, g!, b!),
    min = Math.min(r!, g!, b!),
    delta = max - min;
  const light = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
  const hue = !delta
    ? 0
    : max === r
      ? ((g! - b!) / delta + 6) % 6
      : max === g
        ? (b! - r!) / delta + 2
        : (r! - g!) / delta + 4;
  return [hue * 60, saturation * 100, light * 100] as const;
}
function hexColor(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  return (
    '#' +
    [0, 8, 4]
      .map(n => {
        const k = (n + h / 30) % 12;
        const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export function ColorControls({
  color,
  ink,
  onChange,
}: {
  color: string;
  ink: string;
  onChange: (change: { color?: string; ink?: string }) => void;
}) {
  const [selected, setSelected] = useState<'color' | 'ink'>('color');
  const [colors, setColors] = useState(() => ({
    color: { hex: color, values: channels(color) },
    ink: { hex: ink, values: channels(ink) },
  }));
  // Keep editable HSL intent, even when several HSL values encode the same black/white/gray.
  // Only genuinely different incoming hex colors replace a channel's local intent.
  if (colors.color.hex !== color || colors.ink.hex !== ink) {
    setColors({
      color: colors.color.hex === color ? colors.color : { hex: color, values: channels(color) },
      ink: colors.ink.hex === ink ? colors.ink : { hex: ink, values: channels(ink) },
    });
  }
  const [hue, saturation, lightness] = colors[selected].values;
  function change(index: number, next: number) {
    const values: [number, number, number] = [hue, saturation, lightness];
    values[index] = next;
    const hex = hexColor(...values);
    setColors(old => ({ ...old, [selected]: { hex, values } }));
    onChange({ [selected]: hex });
  }
  const label = selected === 'color' ? 'Dice color' : 'Number color';
  return (
    <div className="inline-colors full-field">
      <div className="color-choices" role="group" aria-label="Color to customize">
        {(['color', 'ink'] as const).map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
          >
            <span
              className="color-swatch"
              style={{ backgroundColor: key === 'color' ? color : ink }}
              aria-hidden="true"
            />
            {key === 'color' ? 'Dice' : 'Numbers'}
          </button>
        ))}
      </div>
      {['Hue', 'Saturation', 'Lightness'].map((name, index) => (
        <label key={name} className="color-slider">
          <span>{name}</span>
          <input
            type="range"
            aria-label={`${label} ${name.toLowerCase()}`}
            min={0}
            max={index === 0 ? 359 : 100}
            step={1}
            value={Math.round([hue, saturation, lightness][index]!)}
            onChange={event => change(index, Number(event.target.value))}
            style={{
              background:
                index === 0
                  ? 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)'
                  : index === 1
                    ? `linear-gradient(to right, ${hexColor(hue, 0, lightness)}, ${hexColor(hue, 100, lightness)})`
                    : `linear-gradient(to right, #000, ${hexColor(hue, saturation, 50)}, #fff)`,
            }}
          />
        </label>
      ))}
    </div>
  );
}
