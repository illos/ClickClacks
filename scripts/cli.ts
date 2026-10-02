// SPDX-License-Identifier: MIT
import { readFile, writeFile, chmod, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { createController, redactError, type Identity, type Profile, type Transport } from '../lib/client.ts';
import { validateDiceConfiguration, type DiceConfiguration } from '../shared/dice.ts';

type Saved={version:1;backend:string;key:string;identity:Identity;profile:Profile};
const usage='powerroller create|join|roll|view|events|profile|clear|leave --backend URL --session FILE [--key CODE] [--name NAME] [--dice power|percentile|100|4|6|8|10|12|20] [--count N] [--bonus-d4 true|false] [--edges N] [--banes N] [--id ID]\nGeneric dice: --edges and --banes are stages 0|1|2 selecting 0|2|5; modifier = bonus minus penalty. Power rolls retain Draw Steel Edges/Banes.';
function argumentsFor(argv:string[]){const[command,...tokens]=argv;const flags:Record<string,string>={};for(let i=0;i<tokens.length;i+=2){if(!tokens[i]?.startsWith('--')||tokens[i+1]===undefined)throw Error(usage);flags[tokens[i]!.slice(2)]=tokens[i+1]!;}return{command,flags};}
/** Percentiles always use a tens/units pair; modifiers and bonus d4 remain available. */
export function diceFromFlags(flags: Record<string, string>): DiceConfiguration {
 const selected = flags.dice ?? 'power';
 const fixed = selected === 'percentile' || selected === '100';
 if (fixed && flags.count !== undefined && Number(flags.count) !== 2)
  throw Error('Percentile rolls require exactly two base dice.');
 const dice: DiceConfiguration = selected === 'power'
  ? {kind:'power',sides:10,count:2}
  : selected === 'percentile' || selected === '100'
   ? {kind:'percentile',sides:10,count:2}
   : {kind:'dice',sides:Number(selected) as DiceConfiguration['sides'],count:Number(flags.count ?? 1)};
 if (flags['bonus-d4'] !== undefined && !['true','false'].includes(flags['bonus-d4']!))
  throw Error('--bonus-d4 must be true or false.');
 if (flags['bonus-d4'] === 'true') dice.bonusD4 = true;
 return validateDiceConfiguration(dice);
}
function httpTransport(url:string):Transport{
 const client=new ConvexHttpClient(url);
 return{call:(method,args)=>['diceDemo:clock','diceDemo:sampleFaces'].includes(method)?client.action(makeFunctionReference<'action'>(method),args):['diceDemoV2:view','diceDemoV2:track','diceDemoV2:events'].includes(method)?client.query(makeFunctionReference<'query'>(method),args):client.mutation(makeFunctionReference<'mutation'>(method),args),watch:()=>()=>{}};
}
async function readSaved(path:string):Promise<Saved|undefined>{
 try{const value=JSON.parse(await readFile(path,'utf8'));if(value.version!==1||typeof value.backend!=='string'||typeof value.key!=='string'||typeof value.identity?.viewer!=='string'||typeof value.identity?.credential!=='string'||value.identity.credential.length<64||typeof value.profile?.name!=='string')throw Error('Invalid session file.');await chmod(path,0o600);return value;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
}
async function save(path:string,value:Saved){await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});await chmod(path,0o600);}
/** Readable JSON output excludes private credentials. Every operation targets the original shared routes. */
export async function runCli(argv:string[]){
 const{command,flags}=argumentsFor(argv);
 if(!command||command==='help'){console.log(usage);return;}
 if(!['create','join','roll','view','events','profile','clear','leave'].includes(command))throw Error(usage);
 const rollDice=command==='roll'?diceFromFlags(flags):undefined;
 if(!flags.backend||!flags.session)throw Error('Supply an explicit --backend URL and --session FILE. '+usage);
 const path=resolve(flags.session),saved=await readSaved(path);
 if(saved&&saved.backend!==flags.backend)throw Error('This session file belongs to another backend. Use a separate session file.');
 if(!saved&&!['create','join'].includes(command))throw Error('Create or join a room first.');
 const state:Saved=saved??{version:1,backend:flags.backend,key:flags.key??crypto.randomUUID(),identity:{viewer:crypto.randomUUID(),credential:crypto.randomUUID()+crypto.randomUUID()},profile:{name:flags.name??'Player',style:{color:'#70dac3',ink:'#fff4e5',pattern:'solid',font:'serif'}}};
 if(command==='create')state.key=crypto.randomUUID();
 if(command==='join'){if(!flags.key)throw Error('Join requires --key CODE or room UUID.');state.key=flags.key;}
 if(flags.name)state.profile={...state.profile,name:flags.name};
 const transport=httpTransport(state.backend),controller=createController({transport,key:state.key,identity:state.identity,profile:state.profile});
 try{
  await controller.join();
  if(command==='create'||command==='join'){await save(path,state);console.log(JSON.stringify({key:state.key,room:await transport.call('diceDemoV2:view',{key:state.key})},null,2));}
  else if(command==='roll'){
   const dice=rollDice!;
   const accepted=await controller.roll({id:flags.id,dice,edges:Number(flags.edges??0),banes:Number(flags.banes??0)});
   const track=await transport.call('diceDemoV2:track',{key:state.key,viewer:state.identity.viewer});console.log(JSON.stringify({accepted,persistedTrack:track},null,2));
  }else if(command==='view')console.log(JSON.stringify(await transport.call('diceDemoV2:view',{key:state.key}),null,2));
  else if(command==='events')console.log(JSON.stringify(await transport.call('diceDemoV2:events',{key:state.key,...state.identity,after:Number(flags.after??0),limit:Number(flags.limit??20)}),null,2));
  else if(command==='profile'){await controller.profile(state.profile);await save(path,state);console.log(JSON.stringify(await transport.call('diceDemoV2:view',{key:state.key}),null,2));}
  else if(command==='clear'){await controller.clear();console.log(JSON.stringify({room:await transport.call('diceDemoV2:view',{key:state.key}),ownTrack:await transport.call('diceDemoV2:track',{key:state.key,viewer:state.identity.viewer})},null,2));}
  else if(command==='leave'){await controller.leave();await unlink(path);console.log(JSON.stringify({left:true,key:state.key}));}
 }catch(error){throw redactError(error,[state.identity.credential]);}
 finally{await controller.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){void runCli(process.argv.slice(2)).catch(error=>{console.error((error as Error).message);process.exitCode=1;});}
