// SPDX-License-Identifier: MIT
import { useRef, useState, type PointerEvent } from 'react';

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
  selected,
  disabled = false,
}: {
  color: string;
  ink: string;
  disabled?: boolean;
  selected: 'color' | 'ink';
  onChange: (change: { color?: string; ink?: string }) => void;
}) {
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
  const lightnessPointer = useRef<number | null>(null);
  const [hue, saturation, lightness] = colors[selected].values;
  function change(values: [number, number, number]) {
    const hex = hexColor(...values);
    setColors(old => ({ ...old, [selected]: { hex, values } }));
    onChange({ [selected]: hex });
  }
  function pick(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const nextHue = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
    change([nextHue, Math.min(100, Math.hypot(x, y) * 100), lightness]);
  }
  function pickLightness(event: PointerEvent<HTMLInputElement>) {
    if (disabled) return;
    const input = event.currentTarget;
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    const leftBorder = parseFloat(style.borderLeftWidth) || 0;
    const rightBorder = parseFloat(style.borderRightWidth) || 0;
    // Both existing thumbs have a 32px outer width. Native range endpoints place
    // the thumb inside the track, so map its center rather than the input edges.
    const thumbWidth = 32;
    const width = rect.width - leftBorder - rightBorder - thumbWidth;
    if (width <= 0) return;
    const position = (event.clientX - rect.left - leftBorder - thumbWidth / 2) / width;
    change([hue, saturation, Math.round(Math.max(0, Math.min(1, position)) * 100)]);
  }
  function releaseLightness(event: PointerEvent<HTMLInputElement>) {
    if (lightnessPointer.current !== event.pointerId) return;
    lightnessPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  const label = selected === 'color' ? 'Die color' : 'Text color';
  return (
    <div className="inline-colors full-field">
      <div
        className="color-wheel"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${label} wheel`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hue) % 360}
        aria-valuetext={`Hue ${Math.round(hue)} degrees, saturation ${Math.round(saturation)} percent`}
        aria-description="Left and right change hue. Up and down change saturation."
        onPointerDown={event => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
        }}
        onPointerUp={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={event => {
          if (disabled) return;
          const step = event.shiftKey ? 10 : 1;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            change([(hue + (event.key === 'ArrowRight' ? step : -step) + 360) % 360, saturation, lightness]);
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            change([hue, Math.max(0, Math.min(100, saturation + (event.key === 'ArrowUp' ? step : -step))), lightness]);
          }
        }}
      >
        <span className="color-wheel-cursor" aria-hidden="true" style={{
          left: `${50 + Math.sin(hue * Math.PI / 180) * saturation / 2}%`,
          top: `${50 - Math.cos(hue * Math.PI / 180) * saturation / 2}%`,
          backgroundColor: hexColor(hue, saturation, 50),
        }} />
      </div>
      <label className="color-slider">
        <span>Lightness</span>
        <input
          type="range"
          aria-label={`${label} lightness`}
          min={0}
          max={100}
          step={1}
          value={Math.round(lightness)}
          disabled={disabled}
          onPointerDown={event => {
            if (disabled || !event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            lightnessPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            pickLightness(event);
          }}
          onPointerMove={event => {
            if (lightnessPointer.current !== event.pointerId) return;
            event.preventDefault();
            pickLightness(event);
          }}
          onPointerUp={event => {
            if (lightnessPointer.current !== event.pointerId) return;
            pickLightness(event);
            releaseLightness(event);
          }}
          onPointerCancel={releaseLightness}
          onLostPointerCapture={() => { lightnessPointer.current = null; }}
          onChange={event => change([hue, saturation, Number(event.target.value)])}
          style={{ background: `linear-gradient(to right, #000, ${hexColor(hue, saturation, 50)}, #fff)` }}
        />
      </label>
    </div>
  );
}
