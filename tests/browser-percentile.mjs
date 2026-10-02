// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { unpackTrack } from '../web/dice-demo/motion-codec.ts';
const url=process.env.URL??'http://127.0.0.1:9594/powerroller/';
const backend=process.env.BACKEND??'https://nautical-partridge-636.convex.cloud';
const browser=await chromium.launch();
try {
 const owner=await browser.newPage({viewport:{width:430,height:932}}),errors=[];
 owner.on('pageerror',e=>errors.push(e.message));
 await owner.goto(url);
 const roll=owner.getByRole('button',{name:'Roll',exact:true});
 await expect(roll).toBeEnabled({timeout:30000});
 await owner.getByRole('button',{name:'Select dice',exact:true}).click();
 await expect(owner.getByRole('menuitemradio')).toHaveCount(8);
 await owner.getByRole('menuitemradio',{name:'d100 (percentile)',exact:true}).click();
 await expect(owner.getByRole('group',{name:'Dice count',exact:true})).toHaveCount(0);
 await expect(owner.getByRole('button',{name:'+1d4',exact:true})).toBeVisible();
 await owner.reload();
 await expect(roll).toBeEnabled({timeout:30000});
 await expect(owner.getByRole('button',{name:'Select dice',exact:true})).toHaveAttribute('title','d100 (percentile)');
 await expect(owner.getByRole('group',{name:'Dice count',exact:true})).toHaveCount(0);
 await owner.locator('[data-roll-modifier="edge"]').click();
 await owner.locator('[data-roll-modifier="edge"]').click();
 await expect(owner.locator('[data-roll-modifier="edge"]')).toContainText('+5');
 await owner.getByRole('button',{name:'+1d4',exact:true}).click();

 // Real browser canvas/font pipeline: every tens/ones label remains inside its face.
 const textures=await owner.evaluate(async()=>{
  const {createDie}=await import('/powerroller/web/dice-demo/dice-models.ts');
  const {loadDiceFonts}=await import('/powerroller/web/dice-demo/fonts.ts');
  const {disposeGroup}=await import('/powerroller/web/dice-demo/d10.ts');
  await loadDiceFonts();
  const paint=CanvasRenderingContext2D.prototype.fillText,calls=[];
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){calls.push({canvas:this.canvas,text,font:this.font});return paint.call(this,text,...args)};
  const output=[];
  try{
   for(const font of ['serif','modern','rune','gothic'])for(const pattern of ['solid','frosted'])for(const index of [0,1]){
    calls.length=0;
    const die=createDie({color:'#000000',ink:'#ffffff',pattern,font},{kind:'percentile',sides:10,count:2},index);
    const materials=new Set(die.children.map(mesh=>mesh.material));
    for(const material of materials){
     const canvas=material.map.image,ctx=canvas.getContext('2d'),uv=die.children.find(mesh=>mesh.material===material).geometry.getAttribute('uv');
     const points=[0,1,2].map(i=>[uv.getX(i)*256,(1-uv.getY(i))*256]);
     const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
     const pixels=ctx.getImageData(0,0,256,256).data;let clipped=0,ink=0;
     for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4]>200){
      ink++;const signs=points.map((a,i)=>cross(a,points[(i+1)%3],[x+.5,y+.5]));
      if(!(signs.every(n=>n>=0)||signs.every(n=>n<=0)))clipped++;
     }
     const call=calls.find(call=>call.canvas===canvas);
     output.push({font,pattern,index,glyph:call.text,fontStyle:call.font,ink,clipped});
    }
    disposeGroup(die);
   }
  }finally{CanvasRenderingContext2D.prototype.fillText=paint}
  return output;
 });
 expect(textures).toHaveLength(160);
 for(const texture of textures){expect(texture.ink).toBeGreaterThan(100);expect(texture.clipped).toBe(0);expect(texture.fontStyle).toContain(texture.index?'78px':'64px');}
 for(const index of [0,1])expect([...new Set(textures.filter(t=>t.index===index).map(t=>t.glyph))].sort()).toEqual(index?['0','1','2','3','4','5','6','7','8','9']:['00','10','20','30','40','50','60','70','80','90']);
 console.log('PASS: saved d100 picker; fixed base pair, bonus d4 and +5 available;160 actual font/pattern face textures unclipped');
 if(!process.env.PREVIEW_ONLY){
  const key=new URL(owner.url()).searchParams.get('room'),http=new ConvexHttpClient(backend);
  const identity=await owner.evaluate(backend=>JSON.parse(sessionStorage.getItem('powerroller.identity.v1:'+backend)),backend);
  const peer=await browser.newPage({viewport:{width:390,height:844}});
  await peer.goto(url+'?room='+key);
  await expect(peer.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await roll.click();
  for(const page of [owner,peer])await expect(page.locator('.roll-log-entry')).toHaveCount(1,{timeout:18000});
  const stored=unpackTrack(await http.query(makeFunctionReference('diceDemoV2:track'),{key,viewer:identity.viewer})).roll;
  expect(stored.dice).toEqual({kind:'percentile',sides:10,count:2,bonusD4:true});
  expect(stored.faces).toHaveLength(3);expect(stored.motion).toBeDefined();expect(stored.motion.offsets).toHaveLength(12);
  const natural=(stored.faces[0]%10)*10+stored.faces[1]%10;
  expect(stored.total).toBe((natural||100)+stored.faces[2]+5);expect(stored.modifier).toBe(5);expect(stored.power).toBeUndefined();
  for(const page of [owner,peer]){
   const row=page.locator('.roll-log-entry');await expect(row).toContainText('1d100 + 1d4');
   await expect(row.locator('.roll-total')).toHaveText(String(stored.total));
   expect(await row.locator('.critical-badge').count()).toBe(0);
   expect(await page.locator('.tray-roll-result strong').allTextContents()).toContain(String(stored.total));
  }
  const text=await owner.locator('.roll-log-entry').first().innerText();
  await owner.screenshot({path:'/tmp/powerroller-percentile.png'});
  await owner.reload();await expect(owner.locator('.roll-log-entry')).toHaveCount(1,{timeout:10000});
  expect(await owner.locator('.roll-log-entry').first().innerText()).toBe(text);
  console.log(`PASS: animated d100+d4+5 persisted raw faces ${stored.faces.join(',')}, total ${stored.total}; owner/peer tray and history agree; reload restores result`);
 }
 expect(errors).toEqual([]);
}finally{await browser.close()}
