// SPDX-License-Identifier: MIT
import { useId, useRef, useState } from 'react';
import type { Style } from '../dice-demo/model';
import { ColorControls } from './color-controls';
import { DesignSwatches } from './design-swatches';
const tabs = [{key:'color', label:'Die color'}, {key:'ink',label:'Text color'}, {key:'design',label:'Design'}] as const;
type Tab = typeof tabs[number]['key'];
export function DiceDesignControls({style,onChange,active,disabled}:{style:Style;onChange:(patch:Partial<Style>)=>void;active:boolean;disabled:boolean}) {
  const [tab,setTab]=useState<Tab>('color');
  const [colorTarget,setColorTarget]=useState<'color'|'ink'>('color');
  const id=useId(), strip=useRef<HTMLDivElement>(null);
  function select(next:Tab) {setTab(next);if(next!=='design')setColorTarget(next);}
  return <div className="full-field">
    <div className="design-tabs" role="tablist" aria-label="Dice design" ref={strip}>
      {tabs.map(({key,label},index)=><button type="button" role="tab" key={key} id={`${id}-${key}`} aria-selected={tab===key}
        aria-controls={`${id}-${key === 'design' ? 'design' : 'color'}-panel`} tabIndex={tab===key?0:-1} disabled={disabled}
        onClick={()=>select(key)} onKeyDown={event=>{
          const next=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;
          if(next>=0){event.preventDefault();select(tabs[next]!.key);strip.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();}
        }}>
        {key!=='design' && <span className="color-swatch" style={{backgroundColor:key==='color'?style.color:style.ink}} aria-hidden="true" />}
        {label}
      </button>)}
    </div>
    {/* Keep the color editor mounted to retain hue/saturation intent for black and white. */}
    <div role="tabpanel" id={`${id}-color-panel`} aria-labelledby={`${id}-${colorTarget}`} hidden={tab==='design'}>
      <ColorControls color={style.color} ink={style.ink} selected={colorTarget} disabled={disabled} onChange={onChange} />
    </div>
    <div role="tabpanel" id={`${id}-design-panel`} aria-labelledby={`${id}-design`} hidden={tab!=='design'}>
      <DesignSwatches style={style} onChange={onChange} active={active && tab==='design'} />
    </div>
  </div>;
}
