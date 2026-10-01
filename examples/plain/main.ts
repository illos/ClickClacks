// SPDX-License-Identifier: MIT
import { createController, convexTransport, type Identity, type Profile } from 'powerroller/client';
import { createRoomTray, createThrowPlanner, loadDiceFonts } from 'powerroller/three';
import { expandDice, resolvePool } from 'powerroller/dice';

/** Host supplies its endpoint, private identity, room, DOM and controls. No React or app stylesheet. */
export async function mountPlainRoller(options:{backend:string;key:string;identity:Identity;profile:Profile;host:HTMLElement;log:HTMLElement;rollButton:HTMLButtonElement}){
 const client=createController({...options,transport:convexTransport(options.backend),clock:()=>performance.now()});
 const planner=createThrowPlanner();
 let tray:ReturnType<typeof createRoomTray>|undefined;
 try{if(!(await loadDiceFonts()).length)tray=createRoomTray(options.host,()=>{tray?.dispose();tray=undefined;},()=>{});}catch{/* Text results remain usable. */}
 const unsubscribers=[
  client.on('room',room=>tray?.participants(room.participants)),
  client.on('track',({owner,roll})=>{if(roll)tray?.play(roll,client.clockEstimate());else tray?.clear(owner);}),
  client.on('clear',owner=>tray?.clear(owner)),
  client.on('available',roll=>{
   const generic=resolvePool(expandDice([{sides:roll.dice?.sides??10,count:roll.faces.length}]),roll.faces,{modifier:roll.modifier??0});
   const row=document.createElement('p');row.textContent=`${roll.name}: ${roll.faces.join(' + ')} = ${roll.total??roll.power?.total??generic.total}${roll.power?`, tier ${roll.power.tier}`:''}`;options.log.append(row);
  }),
  client.on('error',error=>{const row=document.createElement('p');row.textContent=error.message;options.log.append(row);}),
 ];
 const perform=async()=>{
  options.rollButton.disabled=true;
  try{await client.roll({},tray?async(faces,dice)=>(await planner.prepareThrow(faces,{scale:.65,obstacles:[],dice})).motion:undefined);}finally{options.rollButton.disabled=false;}
 };
 const clicked=()=>{void perform().catch(error=>{const row=document.createElement('p');row.textContent=String(error);options.log.append(row);});};
 options.rollButton.addEventListener('click',clicked);
 await client.join();
 return{client,async dispose(){options.rollButton.removeEventListener('click',clicked);unsubscribers.forEach(stop=>stop());planner.dispose();tray?.dispose();await client.dispose();}};
}
