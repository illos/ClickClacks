import type {VisualDie} from './models';
// SPDX-License-Identifier: MIT
export type Style = {color: string; ink: string; pattern: 'solid'|'speckle'|'marble'|'frosted'; font?: 'serif'|'modern'|'rune'|'gothic'};
export type Appearance = Partial<Style> & {body?: string};
export type Preferences = {motion:'reduce'|'full'; hidden?:boolean; highContrast?:boolean};
export type PresentationRecord = {id:string; participantId:string; name?:string; style?:Appearance; request?:{ruleset?:string}; result:{dice:ReadonlyArray<{id:string;sides:number;value:number;kept?:boolean}>;total:number};startsAt:number;revealAt:number};
export type TrayOptions = {clock?:()=>number;preferences?:Preferences; maxAnimatedDice?:number; models?:Readonly<Record<number,(style:Style,value:number,index:number)=>VisualDie[]>>; onStatus?:(status:{state:'ready'|'playing'|'settled'|'unavailable';rollId?:string;reason?:string})=>void};
export const defaultStyle:Style = {color:'#42A5AB',ink:'#ECF6FF',pattern:'solid',font:'serif'};
export function normalizeStyle(style:Appearance={}, highContrast=false):Style {
 return highContrast ? {color:'#ffffff',ink:'#111111',pattern:'solid',font:'modern'} : {...defaultStyle,...style,color:style.color??style.body??defaultStyle.color};
}
