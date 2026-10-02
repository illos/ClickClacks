// SPDX-License-Identifier: MIT
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import type { JoinLogEntry } from './membership-log';
import type { RollerPreferences } from '../../shared/preferences';
import type { Style } from '../dice-demo/model';
import type { ParticipantRoll } from './model';
import type { createDicePreview } from './preview';
import { dieFontFamilies, dieFontWeights } from '../dice-demo/font-style';
import { describeRoll, rollDiceNotation, rollNaturalTotal, rollFacesText } from '../../lib/format';
import { criticalResult, criticalLabel } from '../../lib/critical';
export type LogRoll = Pick<
  ParticipantRoll,
  'id' | 'roller' | 'name' | 'faces' | 'power' | 'styles' | 'startsAt' | 'dice' | 'modifier' | 'total' | 'edges' | 'banes' | 'source'
> & { historyExpiresAt?: number };
export type TableLogEntry = { kind: 'roll'; roll: LogRoll } | JoinLogEntry;
export const logEntryTime = (entry: TableLogEntry) => entry.kind === 'roll' ? entry.roll.startsAt : entry.startsAt;
export const logEntryKey = (entry: TableLogEntry) => entry.kind === 'roll' ? `${entry.roll.roller}:${entry.roll.id}` : `join:${entry.id}`;
export function TableEntry({ entry, viewer, avatarStyle }: { entry: TableLogEntry; viewer: string; avatarStyle?: Style }) {
  if (entry.kind === 'roll') return <RollEntry roll={entry.roll} viewer={viewer} avatarStyle={avatarStyle} />;
  return <article className="join-log-entry" data-participant={entry.participant}>
    <Users size={18} aria-hidden="true" />
    <span className="join-log-message"><strong>{entry.name}</strong> joined</span>
    <time dateTime={new Date(entry.startsAt).toISOString()}>
      {new Date(entry.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  </article>;
}
export function DiceAvatar({ style, className = '' }: { style?: Style; className?: string }) {
  return (
    <svg className={`dice-avatar ${className}`} viewBox="0 0 32 36" aria-hidden="true">
      <path d="M16 1 30 9 30 27 16 35 2 27 2 9Z" fill={style?.color ?? '#70dac3'} />
      <path d="M16 1 8 12 24 12Z" fill="#fff" opacity=".25" />
      <path d="M2 9 8 12 2 27Z M24 12 30 27 16 35Z" fill="#000" opacity=".2" />
      <path
        d="M16 1 8 12 2 9M16 1 24 12 30 9M8 12H24L16 27ZM2 27 16 27 30 27M8 12 2 27M24 12 30 27M16 27V35"
        fill="none"
        stroke={style?.ink ?? '#fff4e5'}
        strokeOpacity=".35"
        strokeWidth=".7"
      />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill={style?.ink ?? '#fff4e5'}
        style={
          style?.font
            ? {
                fontFamily: `"${dieFontFamilies[style.font]}"`,
                fontWeight: dieFontWeights[style.font],
              }
            : undefined
        }
      >
        0
      </text>
    </svg>
  );
}

export function RollEntry({ roll, viewer, avatarStyle }: { roll: LogRoll; viewer: string; avatarStyle?: Style }) {
  const critical = criticalResult(roll);
  const showEquation = roll.faces.length > 1 || !!roll.modifier;
  return (
    <article className={`roll-log-entry${critical ? ` critical-${critical}` : ''}`}>
      <header>
        <strong className="roll-author">
          <DiceAvatar style={avatarStyle ?? roll.styles[0]} className="roll-avatar" />
          <span className="roll-author-name">
            {roll.name}
            {roll.roller === viewer ? ' · you' : ''}
          </span>
        </strong>
        <time dateTime={new Date(roll.startsAt).toISOString()}>
          {new Date(roll.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>
      <div className="roll-result-line">
        <span className="roll-dice-notation">{rollDiceNotation(roll)}</span>
        <span aria-hidden="true">|</span>
        {showEquation && <span className="roll-equation">
          {rollFacesText(roll)}
          {roll.power && roll.power.edges - roll.power.banes === 1 && ' + 2'}
          {roll.power && roll.power.edges - roll.power.banes === -1 && ' − 2'}
          {!roll.power &&
            !!roll.modifier &&
            `${roll.modifier > 0 ? ' + ' : ' − '}${Math.abs(roll.modifier)}`}
        </span>}
        <span className="roll-outcome">
          {showEquation && <span>=</span>}
          <strong className="roll-total">
            {roll.total ?? roll.power?.total ??
              rollNaturalTotal(roll) + (roll.modifier ?? 0)}
          </strong>
          {roll.power && (
            <strong className={`tier tier-${roll.power.tier}`}>Tier {roll.power.tier}</strong>
          )}
          {critical && <strong className={`critical-badge critical-${critical}`}>{criticalLabel(critical)}</strong>}
        </span>
        {roll.power && roll.power.edges > 0 && (
          <span className="edge">↑ {roll.power.edges === 2 ? 'Double edge' : 'Edge'}</span>
        )}
        {roll.power && roll.power.banes > 0 && (
          <span className="bane">↓ {roll.power.banes === 2 ? 'Double bane' : 'Bane'}</span>
        )}
      </div>
      <span className="visually-hidden">{describeRoll(roll as ParticipantRoll).detailed}</span>
    </article>
  );
}

export function TrayHistory({ entries, viewer, motion }: { entries: TableLogEntry[]; viewer: string; motion: RollerPreferences['motion'] }) {
  const host = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const reduced = motion === 'reduce' || (motion === 'device' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const row of host.current!.querySelectorAll<HTMLElement>('[data-history-key]')) {
      const key = row.dataset.historyKey!;
      const top = row.offsetTop;
      next.set(key, top);
      if (reduced) row.getAnimations().forEach(animation => animation.cancel());
      else {
        const previous = positions.current.get(key);
        if (previous !== top) {
          row.getAnimations().forEach(animation => animation.cancel());
          row.animate([
            { transform: `translateY(${previous === undefined ? -24 : previous - top}px)` },
            { transform: 'translateY(0)' },
          ], { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      }
    }
    positions.current = next;
  }, [entries, reduced]);
  return <div className="tray-history" ref={host} role="region" aria-label="Recent tray rolls" data-motion={reduced ? 'reduce' : 'full'}>
    {entries.slice(0, 6).map(entry => <div className="tray-history-row"
      key={logEntryKey(entry)} data-history-key={logEntryKey(entry)}>
      <TableEntry entry={entry} viewer={viewer} />
    </div>)}
  </div>;
}

export function DicePreview({ style, preferences }: { style: Style; preferences?: RollerPreferences }) {
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<ReturnType<typeof createDicePreview> | null>(null);
  const latest = useRef({ style, preferences });
  latest.current = { style, preferences };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current || preferences?.hidden) return;
    let active = true;
    void Promise.all([import('./preview'), import('../dice-demo/fonts')])
      .then(async ([graphics, fonts]) => {
        const failedFonts = await fonts.loadDiceFonts();
        if (!active) return;
        if (failedFonts.length) {
          setFailed(true);
          return;
        }
        try {
          preview.current = graphics.createDicePreview(
            host.current!,
            () => {
              if (active) setFailed(true);
            },
            latest.current.preferences,
          );
          preview.current.style(latest.current.style);
        } catch {
          if (active) setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      preview.current?.dispose();
      preview.current = null;
    };
  }, [preferences?.hidden]);
  useEffect(() => {
    preview.current?.setPreferences(preferences ?? {});
    preview.current?.style(style);
  }, [style, preferences]);
  if (preferences?.hidden) return null;
  return (
    <div
      className="dice-preview"
      role="img"
      aria-label={`${style.font ?? 'original'} ${style.pattern} die with ${style.color} body and ${style.ink} numbers`}
    >
      <div className="preview-canvas" ref={host} />
      {failed && (
        <p className="preview-fallback">3D preview unavailable. Your dice settings still work.</p>
      )}
    </div>
  );
}
