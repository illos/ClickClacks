// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  await page.goto('http://127.0.0.1:9594/powerroller/');
  const results=await page.evaluate(async()=>{
    const {createDie}=await import('/powerroller/web/dice-demo/dice-models.ts');
    const {loadDiceFonts}=await import('/powerroller/web/dice-demo/fonts.ts');
    await loadDiceFonts();
    const results=[];
    const sheet=document.createElement('div');sheet.style.cssText='display:flex;gap:12px;background:#222;padding:16px;position:fixed;inset:0;z-index:100';document.body.append(sheet);
    for(const font of [undefined,'serif','modern','rune','gothic']) {
      const model=createDie({color:'#000000',ink:'#ffffff',pattern:'solid',...(font?{font}:{})},{kind:'dice',sides:4,count:1});
      const column=document.createElement('div');column.textContent=font??'Original';sheet.append(column);
      for(const mesh of model.children){
        const canvas=mesh.material.map.image, pixels=canvas.getContext('2d').getImageData(0,0,256,256).data;
        const uv=mesh.geometry.getAttribute('uv');
        const points=[0,1,2].map(i=>[uv.getX(i)*256,(1-uv.getY(i))*256]);
        const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
        let clipped=0,ink=0;
        for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4]>128){
          ink++;
          const signs=points.map((a,i)=>cross(a,points[(i+1)%3],[x+.5,y+.5]));
          if(!(signs.every(n=>n>=0)||signs.every(n=>n<=0)))clipped++;
        }
        results.push({font:font??'Original',ink,clipped});
        const sample=document.createElement('canvas');sample.width=sample.height=256;sample.style.cssText='display:block;width:200px;height:200px';
        const ctx=sample.getContext('2d');ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(canvas,0,0);column.append(sample);
      }
      for(const mesh of model.children){mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();}
    }
    return results;
  });
  for(const result of results){expect(result.ink).toBeGreaterThan(400);expect(result.clipped,`${result.font} numerals stay on their triangular face`).toBe(0);}
  await page.screenshot({path:'/tmp/powerroller-d4-fonts.png'});
  console.log('PASS: all four d4 faces in original and four selectable fonts retain visible, unclipped numerals');
}finally{await browser.close();}
