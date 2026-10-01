// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import {createD10,finalOrientation,texture,createDieMaterial,dieFontFamilies,dieFontWeights} from './d10';
import type {Style} from './types';
export const stockSides = [3,4,6,10,100] as const;
export type VisualDie = {mesh:THREE.Group; final:THREE.Quaternion; value:number; sides:number; part?:'tens'|'ones'};
function cube(style:Style,sides:number,value:number):VisualDie {
 const geometry=new THREE.BoxGeometry(1.15,1.15,1.15);
 // Three BoxGeometry material order: +x,-x,+y,-y,+z,-z.
 // Source: Steel Compendium en/books/heroes/md/chapter/the-basics.md / Dice / D3s.
 // D3 representation follows The Basics / D3s: 1–2 =>1,3–4=>2,5–6=>3.
 // Faces show the interpreted 1–3 values to agree directly with semantic results.
 const labels=sides===3?[1,3,2,2,3,1]:[1,6,2,5,3,4];
 const normals=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
 const mesh=new THREE.Group();
 mesh.add(new THREE.Mesh(geometry,labels.map(label=>createDieMaterial(style,texture(style,label,0,String(label))))));
 const normal=normals[labels.indexOf(value)]!;
 return {mesh,final:new THREE.Quaternion().setFromUnitVectors(normal,new THREE.Vector3(0,1,0)),value,sides};
}
function tetrahedron(style:Style,value:number):VisualDie {
 const source=new THREE.TetrahedronGeometry(1.15,0),positions=source.getAttribute('position');
 const mesh=new THREE.Group();
 let target=new THREE.Quaternion();
 // Number all three corners of each face. D4 reads the upward vertex;
 // face opposite the selected value rests on the floor, three incident faces agree.
 const vertices=[...new Map(Array.from({length:positions.count},(_,i)=>{const p=new THREE.Vector3().fromBufferAttribute(positions,i);return [p.toArray().join(','),p] as const})).values()];
 const vertexValue=(point:THREE.Vector3)=>vertices.findIndex(p=>p.distanceTo(point)<0.001)+1;
 vertices.forEach((v,i)=>{if(i+1===value)target=new THREE.Quaternion().setFromUnitVectors(v.clone().normalize(),new THREE.Vector3(0,1,0));});
 for(let face=0;face<4;face++){
  const points=Array.from({length:3},(_,j)=>new THREE.Vector3().fromBufferAttribute(positions,face*3+j));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  const base=texture(style,1,0,'');ctx.drawImage(base.image as HTMLCanvasElement,0,0);base.dispose();
  ctx.fillStyle=style.ink;ctx.font=`${style.font?dieFontWeights[style.font]:600} 48px ${style.font?JSON.stringify(dieFontFamilies[style.font]):'Georgia'}, serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  // UV corners match the corresponding vertex values; top numeral is unambiguous.
  [[128,50],[55,187],[201,187]].forEach(([x,y],j)=>ctx.fillText(String(vertexValue(points[j]!)),x!,y!));
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.5,1,0,0,1,0],2));g.computeVertexNormals();
  mesh.add(new THREE.Mesh(g,createDieMaterial(style,map)));
 }
 source.dispose();return {mesh,final:target,value,sides:4};
}
/** Pure visual mapping, never randomizes an accepted result. */
export function createVisualDice(style:Style,sides:number,value:number,index=0,percentile=false):VisualDie[] {
 // Source: Steel Compendium en/books/heroes/md/chapter/the-basics.md / Dice / D100s.
 if(sides===100){const normalized=value===100?0:value;return [createVisualDice(style,10,Math.floor(normalized/10)||10,1,true)[0]!,createVisualDice(style,10,normalized%10||10,0,true)[0]!];}
 if(sides===10)return [{mesh:createD10(style,percentile?index:0),final:finalOrientation(value,index),value,sides, ...(percentile?{part:index===1?'tens' as const:'ones' as const}:{})}];
 if(sides===3||sides===6)return [cube(style,sides,value)];
 if(sides===4)return [tetrahedron(style,value)];
 return [];
}
