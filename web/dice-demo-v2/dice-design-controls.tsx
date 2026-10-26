// SPDX-License-Identifier: MIT
import { useId, useRef, useState, type ReactNode } from 'react';
import type { Style } from '../dice-demo/model';
import { ColorControls } from './color-controls';
import { DesignSwatches } from './design-swatches';
/** A host's own segment between Text color and Design: a swatch and the panel it opens. */
export type DesignChannel = { key: string; label: string; swatch?: string; panel: ReactNode };
// With a host segment the noun is its own span, so a narrow panel can drop it (customizer.css);
// three segments keep one text node.
const colorTabs = [{key:'color', label:'Die', noun:' color'}, {key:'ink', label:'Text', noun:' color'}] as const;
export function DiceDesignControls({style,onChange,active,disabled,channels=[]}:{style:Style;onChange:(patch:Partial<Style>)=>void;active:boolean;disabled:boolean;channels?:readonly DesignChannel[]}) {
  const [tab,setTab]=useState<string>('color');
  const [colorTarget,setColorTarget]=useState<'color'|'ink'>('color');
  const id=useId(), strip=useRef<HTMLDivElement>(null);
  const tabs=[
    ...colorTabs.map(tab=>({...tab, swatch:style[tab.key] as string|undefined})),
    ...channels.map(({key,label,swatch})=>({key, label, noun:'', swatch})),
    {key:'design', label:'Design', noun:'', swatch:undefined},
  ];
  const panel=(key:string)=>`${id}-${key==='ink'?'color':key}-panel`;
  function select(next:string) {setTab(next);if(next==='color'||next==='ink')setColorTarget(next);}
  return <div className="full-field">
    <div className="design-tabs" role="tablist" aria-label="Dice design" ref={strip}>
      {tabs.map(({key,label,noun,swatch},index)=><button type="button" role="tab" key={key} id={`${id}-${key}`} aria-selected={tab===key}
        aria-controls={panel(key)} tabIndex={tab===key?0:-1} disabled={disabled}
        onClick={()=>select(key)} onKeyDown={event=>{
          const count=tabs.length;
          const next=event.key==='ArrowRight'?(index+1)%count:event.key==='ArrowLeft'?(index+count-1)%count:event.key==='Home'?0:event.key==='End'?count-1:-1;
          if(next>=0){event.preventDefault();select(tabs[next]!.key);strip.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();}
        }}>
        {swatch!==undefined && <span className="color-swatch" style={{backgroundColor:swatch}} aria-hidden="true" />}
        {channels.length ? <span>{label}{noun && <span className="design-tab-noun">{noun}</span>}</span> : label+noun}
      </button>)}
    </div>
    {/* Keep the color editor mounted to retain hue/saturation intent for black and white. */}
    <div role="tabpanel" id={panel('color')} aria-labelledby={`${id}-${colorTarget}`} hidden={tab!=='color'&&tab!=='ink'}>
      <ColorControls color={style.color} ink={style.ink} selected={colorTarget} disabled={disabled} onChange={onChange} />
    </div>
    {channels.map(channel=><div role="tabpanel" key={channel.key} id={panel(channel.key)} aria-labelledby={`${id}-${channel.key}`} hidden={tab!==channel.key}>
      {channel.panel}
    </div>)}
    <div role="tabpanel" id={panel('design')} aria-labelledby={`${id}-design`} hidden={tab!=='design'}>
      <DesignSwatches style={style} onChange={onChange} active={active && tab==='design'} disabled={disabled} />
    </div>
  </div>;
}
