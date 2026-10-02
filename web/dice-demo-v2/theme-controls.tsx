// SPDX-License-Identifier: MIT
import { useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeChoice } from './theme';
const choices: {value: ThemeChoice; label: string; Icon: typeof Sun}[] = [
  {value:'system', label:'System', Icon:Monitor},
  {value:'light', label:'Light', Icon:Sun},
  {value:'dark', label:'Dark', Icon:Moon},
];
export function ThemeSwitcher({value = 'system', onChange}: {value?: ThemeChoice; onChange:(value:ThemeChoice)=>void}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left:8, top:8});
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !menu.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const {width, height} = menu.current.getBoundingClientRect();
      setPosition({left:Math.max(8, Math.min(rect.right-width, innerWidth-width-8)),
        top:Math.max(8, Math.min(rect.bottom+8, innerHeight-height-8))});
    };
    place();
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  }, [open]);
  const current = choices.find(choice => choice.value === value)!;
  useEffect(() => {
    if (!open) return;
    const away = (event: globalThis.PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    host.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return <div className="theme-control" ref={host} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="customize-trigger" aria-label={`Color theme: ${current.label}`}
      title={`Color theme: ${current.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(old => !old)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
      }}><current.Icon aria-hidden /></button>
    {open && <div ref={menu} className="theme-menu" style={{position:'fixed',left:position.left,top:position.top,right:'auto'}} role="menu" aria-label="Color theme" id={id}>
      {choices.map(({value:choice,label,Icon}, index) => <button key={choice} type="button" role="menuitemradio"
        aria-checked={value === choice} tabIndex={value === choice ? 0 : -1}
        onClick={() => { onChange(choice); setOpen(false); trigger.current?.focus(); }} onKeyDown={event => {
          const next = event.key === 'ArrowDown' ? (index+1)%3 : event.key === 'ArrowUp' ? (index+2)%3
            : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
          if (next < 0) return;
          event.preventDefault();
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        }}><Icon aria-hidden /><span>{label}</span>{choice===value && <Check aria-hidden />}</button>)}
    </div>}
  </div>;
}
/** Appearance controls shared by the full Settings dialog and the tray Settings tab. */
export function ThemeOptions({value = 'system', onChange}: {value?: ThemeChoice; onChange:(value:ThemeChoice)=>void}) {
  const group = useId();
  return <fieldset className="theme-settings"><legend>Appearance</legend><div className="theme-options">
    {choices.map(({value:choice,label,Icon}) => <label key={choice}>
      <input type="radio" name={group} value={choice} checked={value===choice} onChange={() => onChange(choice)} />
      <Icon aria-hidden /><span>{label}</span>
    </label>)}
  </div></fieldset>;
}
