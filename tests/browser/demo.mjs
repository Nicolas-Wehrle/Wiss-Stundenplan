import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../', import.meta.url)).replace(/[/\\]$/, ''), out=root+'/tests/browser/artifacts/demo';
fs.mkdirSync(out,{recursive:true});
const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(out + '/profile-'),{executablePath:process.env.BROWSER_EXECUTABLE,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1280,height:800}});
try {
 const cdp=await ctx.browser().newBrowserCDPSession(); const {id}=await cdp.send('Extensions.loadUnpacked',{path:root+'/chrome addon'});
 let worker=ctx.serviceWorkers().find(w=>w.url().includes(id)); if(!worker) worker=await ctx.waitForEvent('serviceworker', { timeout: 15000 });
 await worker.evaluate(async()=>{globalThis.calls=[];globalThis.fetch=async url=>{calls.push(String(url)); return new Response(JSON.stringify(String(url).includes('/nice2/username')?{username:'anonymous'}:{}),{status:String(url).includes('api.github.com')?404:200});};await chrome.storage.local.set({privacyOk:true});});
 const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('chrome-extension://'+id+'/popup.html?full');await p.getByRole('button',{name:'Demokonto testen',exact:true}).click();
 await p.getByRole('button',{name:'Demo beenden',exact:true}).waitFor();
 let state=await worker.evaluate(()=>chrome.storage.local.get(null)); assert.equal(state.demoMode,true);assert.equal(state.user.username,'demo@example.invalid');assert.equal(state.lessons.length,170);
 await worker.evaluate(()=>{calls=[];});
 await p.locator('#btnRefresh').click(); await p.waitForTimeout(350);
 for(const tab of ['week','exams','grades','absences','rooms']) {
  await p.locator('#tabs button[data-tab='+tab+']').click();await p.waitForTimeout(400);
  await p.screenshot({path:out+'/screenshot-'+tab+'-1280x800.png'});
 }
 await p.locator('#btnSettings').click(); await p.locator('[data-act=setnav][data-sec=sync]').click();
 await p.getByText('Im Demokonto ist die Gerätesynchronisation deaktiviert.').waitFor();
 const blocked=await p.evaluate(()=>chrome.runtime.sendMessage({type:'deviceSyncConnect',server:'https://example.onrender.com'}));assert.equal(blocked.error,'demo-mode');
 const writes=await p.evaluate(()=>chrome.runtime.sendMessage({type:'deviceSyncWrite',patch:{notes:{'demo-note':'Fiktive Testnotiz'}}}));assert.equal(writes.ok,true);
 assert.equal(await worker.evaluate(()=>calls.filter(u=>u.includes('wiss.tocco.ch')||u.includes('.onrender.com')).length),0);
 await p.getByRole('button',{name:'Fertig',exact:true}).click();
 await p.getByRole('button',{name:'Demo beenden',exact:true}).click();await p.getByRole('button',{name:'Demokonto testen',exact:true}).waitFor();
 state=await worker.evaluate(()=>chrome.storage.local.get(null));assert.equal(state.user,undefined);assert.equal(state.lessons,undefined);assert.equal(state.notes,undefined);assert.equal(state.demoMode,undefined);assert.equal(state.privacyOk,true);
 await worker.evaluate(()=>chrome.storage.local.set({user:{username:'existing'},lessons:[]}));
 const refused=await p.evaluate(()=>chrome.runtime.sendMessage({type:'demoStart'}));assert.ok(refused.error);assert.equal((await worker.evaluate(()=>chrome.storage.local.get('user'))).user.username,'existing');
 assert.deepEqual(errors,[]);console.log('PASS: real extension demo entry, all views, refresh, room data, no school/sync traffic, local notes, exit cleanup, existing-account protection.');
} finally {await ctx.close();}
