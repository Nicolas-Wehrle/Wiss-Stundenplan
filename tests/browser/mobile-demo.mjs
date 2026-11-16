// Real generated Android page and iPhone userscript, with synthetic native/GM adapters.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), web = path.join(root, 'android app/app/src/main/assets/web');
const version = JSON.parse(fs.readFileSync(path.join(root, 'chrome addon/manifest.json'), 'utf8')).version;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
try {
 for (const platform of ['android', 'ios']) {
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript((version) => {
   let data = JSON.parse(localStorage.getItem('__nativeTestStore') || 'null') || { privacyOk:true, __appVersion:version };
   const save = () => localStorage.setItem('__nativeTestStore', JSON.stringify(data));
   window.AndroidStore = { get:()=>JSON.stringify(data), set:j=>{Object.assign(data,JSON.parse(j));save();}, clear:()=>{data={};save();} };
   window.AndroidHost = { tabCreate:()=>1,tabInfo:()=>JSON.stringify({id:1,url:'https://wiss.tocco.ch/extranet/',status:'complete'}),tabUpdate(){},tabShow(){},tabRemove(){},exec(){},notify(){},schedule(){},widgetData(){},setLang(){},notifPermission:()=> 'granted',requestNotifPermission(){},installUpdate(){},openExternal(){} };
   window.AndroidTab = {result(){}};
  }, version);
  if(platform==='ios') await context.addInitScript({content:`if(location.hostname==='wiss.tocco.ch' && window.top===window){if(!localStorage.getItem('wiss:store'))localStorage.setItem('wiss:store',JSON.stringify({privacyOk:true,__appVersion:'${version}'}));window.GM={getValue:async()=>null,setValue:async()=>{},deleteValue:async()=>{},xmlHttpRequest:o=>o.onerror?.()};${fs.readFileSync(path.join(root,'iphone/WISS-Stundenplan.user.js'),'utf8')}\n}`});
  let schoolCalls=0;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='wiss.tocco.ch' && u.pathname.startsWith('/__wissapp/')) {
    const file=path.join(web,u.pathname.slice('/__wissapp/'.length));
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/javascript',body:fs.readFileSync(file)});
   }
   if(u.pathname==='/nice2/username'){schoolCalls++;return route.fulfill({json:{username:'anonymous'}});}
   if(u.pathname.startsWith('/nice2/rest/')){schoolCalls++;return route.fulfill({json:{data:[]}});}
   if(u.pathname.startsWith('/extranet/'))return route.fulfill({contentType:'text/html',body:'<html><body>School placeholder</body></html>'});
   return route.fulfill({status:404,body:''});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(platform==='ios'?'https://wiss.tocco.ch/extranet/?stundenplan':'https://wiss.tocco.ch/__wissapp/popup.html', { waitUntil: 'commit' });
  await page.getByRole('button',{name:'Demokonto testen',exact:true}).click();
  await page.getByRole('button',{name:'Demo beenden',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>chrome.runtime.getManifest().version),version);
  schoolCalls=0;
  for(const tab of ['week','exams','grades','absences','rooms'])await page.locator('#tabs button[data-tab='+tab+']').click();
  await page.locator('#btnRefresh').click();
  await page.evaluate(()=>chrome.runtime.sendMessage({type:'deviceSyncWrite',patch:{notes:{demo:'Synthetic mobile note'},prefs:{theme:'dark'}}}));
  assert.equal((await page.evaluate(()=>chrome.storage.local.get('notes'))).notes.demo,'Synthetic mobile note');
  const blocked=await page.evaluate(()=>chrome.runtime.sendMessage({type:'deviceSyncConnect',server:'https://example.onrender.com'}));assert.equal(blocked.error,'demo-mode');
  assert.equal(schoolCalls,0);
  // Check adapter deletion and durability without resetting the synthetic native store on reload.
  await page.evaluate(()=>chrome.runtime.sendMessage({type:'demoExit'}));
  const state=await page.evaluate(()=>chrome.storage.local.get(null));
  assert.equal(state.demoMode,undefined);assert.equal(state.lessons,undefined);assert.equal(state.notes,undefined);assert.equal(state.prefs.theme,'dark');
  if(platform==='android') assert.equal(await page.evaluate(()=>JSON.parse(AndroidStore.get()).demoMode),undefined);
  else assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wiss:store')).demoMode),undefined);
  assert.deepEqual(errors,[]);console.log('PASS: '+platform+' '+version+' demo, all views, local notes, sync isolation and persistent exit cleanup.');
  await context.close();
 }
}finally{await browser.close();}
