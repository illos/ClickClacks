// SPDX-License-Identifier: MIT
import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {faceForResult,faceGlyph,finalOrientation,disposeGroup} from './d10';
import {createVisualDice} from './models';
import {defaultStyle} from './types';
// Verify mesh/result correspondence without WebGL; canvas records face labels.
// D3/percentile expectations derive from Steel Compendium:
// en/books/heroes/md/chapter/the-basics.md / Dice / D3s and D100s.
function canvasStub(){
 const labels:string[]=[];const ctx={fillRect:vi.fn(),drawImage:vi.fn(),fillText:(text:string)=>labels.push(text)};
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx,labels})});
 return labels;
}
afterEach(()=>vi.unstubAllGlobals());
describe('accepted result model mapping',()=>{
 it('faces every accepted d10 value upward without renumbering authority',()=>{
  for(let value=1;value<=10;value++)for(let index=0;index<2;index++)expect(faceForResult(value,index).normal.clone().applyQuaternion(finalOrientation(value,index)).distanceTo(new THREE.Vector3(0,1,0))).toBeLessThan(1e-6);
 });
 it('labels percentile tens as multiples of ten, including double zero',()=>{
  expect(faceGlyph(5,1)).toBe('50');expect(faceGlyph(10,1)).toBe('00');expect(faceGlyph(10,0)).toBe('0');
 });
 it('maps d3 to paired d6 faces with direct resolved labels',()=>{
  for(let value=1;value<=3;value++){canvasStub();const [die]=createVisualDice(defaultStyle,3,value);expect(die!.sides).toBe(3);expect(die!.value).toBe(value);const faceValues=[1,3,2,2,3,1],normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];const top=normals.map(n=>new THREE.Vector3(...n as [number,number,number]).applyQuaternion(die!.final).y).findIndex(y=>Math.abs(y-1)<1e-6);expect(faceValues[top]).toBe(value);disposeGroup(die!.mesh);}
 });
 it('a d4 settles selected vertex upward and prints matching labels on its incident faces',()=>{
  for(let value=1;value<=4;value++){const labels=canvasStub();const [die]=createVisualDice(defaultStyle,4,value);const points=new THREE.TetrahedronGeometry(1.15,0).getAttribute('position');const distinct=[...new Map(Array.from({length:points.count},(_,i)=>{const p=new THREE.Vector3().fromBufferAttribute(points,i);return [p.toArray().join(','),p] as const})).values()];expect(distinct[value-1]!.clone().applyQuaternion(die!.final).y).toBeCloseTo(1.15);expect(labels.filter(v=>v===String(value))).toHaveLength(3);disposeGroup(die!.mesh);}
 });
 it('expands d100 into distinct tens/ones instead of summing two d10s',()=>{
  canvasStub();const dice=createVisualDice(defaultStyle,100,53);expect(dice.map(d=>[d.part,d.value])).toEqual([['tens',5],['ones',3]]);dice.forEach(d=>disposeGroup(d.mesh));
  const hundred=createVisualDice(defaultStyle,100,100);expect(hundred.map(d=>d.value)).toEqual([10,10]);hundred.forEach(d=>disposeGroup(d.mesh));
 });
 it('does not claim geometry for arbitrary valid logical dice',()=>expect(createVisualDice(defaultStyle,17,5)).toEqual([]));
});
