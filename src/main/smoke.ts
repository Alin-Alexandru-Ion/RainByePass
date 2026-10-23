import { app,screen, BrowserWindow } from 'electron';
import { mkdir,writeFile } from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import { ViewerWindow } from './viewer-window';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function smokeApplication(win:BrowserWindow,viewer:ViewerWindow,directory:string) {
  await mkdir(directory,{recursive:true});const errors:string[]=[];
  win.webContents.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('https://example.com/'))errors.push(e.message);});
  const js=(source:string)=>win.webContents.executeJavaScript(source);
  await js(`new Promise((resolve,reject)=>{const start=performance.now(),t=setInterval(()=>{if(window.rainTest){clearInterval(t);resolve(true)}else if(performance.now()-start>8000){clearInterval(t);reject(new Error(document.getElementById('error').textContent||'Startup did not finish'))}},30)})`);
  const screenshot=async(name:string)=>{for(let attempt=0;attempt<3;attempt++){await pause(150);try{await writeFile(path.join(directory,`${name}.png`),(await win.webContents.capturePage()).toPNG());return;}catch(error){if(attempt===2)throw new Error(`Screenshot ${name}: ${error}`);}}};
  const quick=process.argv.includes('--quick-smoke'),sampleMs=quick?2500:20000;
  const profile=async(name:string,duration=sampleMs)=>{
    const a=app.getAppMetrics(),snapshotBefore=await js('window.rainTest.snapshot()'),start=Date.now();await pause(duration);const b=app.getAppMetrics(),elapsed=(Date.now()-start)/1000,snapshotAfter=await js('window.rainTest.snapshot()');
    const deltas=b.map(p=>(p.cpu.cumulativeCPUUsage??0)-(a.find(q=>q.pid===p.pid)?.cpu.cumulativeCPUUsage??p.cpu.cumulativeCPUUsage??0));
    const cpuCounterReset=deltas.some(n=>n<0),cpu=cpuCounterReset?null:deltas.reduce((sum,n)=>sum+n,0);
    return {name,seconds:elapsed,cpuCounterReset,cpuSeconds:cpu,cpuOneCorePercent:cpu===null?null:cpu/elapsed*100,workingSetBeforeKB:a.reduce((n,p)=>n+p.memory.workingSetSize,0),workingSetAfterKB:b.reduce((n,p)=>n+p.memory.workingSetSize,0),frames:snapshotAfter.frames-snapshotBefore.frames,before:snapshotBefore,after:snapshotAfter,render:await js('window.rainTest.performanceEnd()'),processes:b};
  };
  const startup={nativeFullscreen:win.isFullScreen(),bounds:win.getBounds(),snapshot:await js('window.rainTest.snapshot()')};await screenshot('startup-settings');
  const performance:any[]=[await profile('settings before first Mood Boost')];
  const result=await js('window.rainTest.run()');
  const landscapes:any[]=[];
  for(const mood of ['day','night']){
    await js(`window.rainTest.mood(${JSON.stringify(mood)})`);
    for(const style of ['american-mountains','arabian-desert','irish-lake','japanese-ocean','latin-badlands']){
      await js(`window.rainTest.outlook(${JSON.stringify(style)})`);await pause(350);
      const scene=await js('window.rainTest.snapshot()');await screenshot(`landscape-${style}-${mood}`);
      landscapes.push({style,mood,renderedStyle:scene.terrainStyle,frames:scene.frames,errors:scene.errors});
    }
  }
  const landscapePerformance:any[]=[];
  await js("window.rainTest.mood('day')");
  for(const style of ['american-mountains','arabian-desert','irish-lake','japanese-ocean','latin-badlands']){
    await js(`window.rainTest.outlook(${JSON.stringify(style)})`);await pause(300);
    landscapePerformance.push(await profile(`${style} at default 15 fps`,quick?2500:5000));
  }
  await js("window.rainTest.outlook('meadow')");
  const monitorTests:any[]=[];
  for(const d of screen.getAllDisplays()){await viewer.start(d,'borderless');await pause(200);monitorTests.push({requested:d.id,actual:screen.getDisplayMatching(win.getBounds()).id,bounds:win.getBounds()});}
  const click=()=>{const [w,h]=win.getSize(),x=Math.round(w*.3),y=Math.round(h*.65);win.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});};
  click();await pause(600);const singleShows=(await js('window.rainTest.snapshot()')).overlay===true;
  click();await pause(600);const singleHides=(await js('window.rainTest.snapshot()')).overlay===false;
  click();await pause(100);click();await pause(700);const doubleToFullscreen=win.isFullScreen()&&!((await js('window.rainTest.snapshot()')).overlay);
  click();await pause(100);click();await pause(700);const doubleToBorderless=!win.isFullScreen()&&viewer.mode==='borderless';
  const pointerTests={singleShows,singleHides,doubleToFullscreen,doubleToBorderless};
  const sizes=[[1280,720],[2560,1440],[3840,2160],[2560,1080],[720,1280],[520,420]],captures:any[]=[];
  win.setResizable(true);
  for(const [w,h]of sizes){win.setSize(w,h);await pause(200);captures.push(await js('window.rainTest.snapshot()'));await screenshot(`scene-${w}x${h}`);}
  win.setSize(520,420);await js('window.rainTest.showSettings()');await pause(200);
  for(let i=0;i<11;i++){win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});}
  const keyboardBefore=await js('({path:document.activeElement.dataset.setting,checked:document.activeElement.checked})');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});await pause(250);
  const keyboardAfter=await js('({path:document.activeElement.dataset.setting,checked:document.activeElement.checked})');
  const keyboardSettings=keyboardBefore.path==='clouds.movementEnabled'&&keyboardBefore.checked!==keyboardAfter.checked;await screenshot('small-overlay-keyboard');
  await js('window.rainTest.hideSettings()');await viewer.start(screen.getAllDisplays().at(-1)!,'borderless');await pause(200);
  for(const mood of ['morning','day','evening','night']){await js(`window.rainTest.mood('${mood}')`);await pause(quick?1500:3500);await screenshot(mood);}
  const cycle=await js('window.rainTest.cycle()'),trajectory:any[]=[];
  for(const [name,date]of Object.entries(cycle)){await js(`window.rainTest.setTime(${JSON.stringify(date)})`);await pause(250);trajectory.push({name,date,scene:await js('window.rainTest.snapshot()')});await screenshot(name);}
  for(const [fps,rays]of [[15,false],[15,true],[30,false],[60,false]]as const){await js(`window.rainTest.performanceStart(${fps},${rays})`);await pause(800);performance.push(await profile(`native ${fps} fps, rays ${rays?'on':'off'}`));}
  await js('window.rainTest.staticScene()');await pause(500);performance.push(await profile('held manual scene, all movement off'));
  await js('window.rainTest.performanceStart(15,false)');win.minimize();await pause(300);const minimizedBefore=await js('window.rainTest.snapshot()');await pause(1000);const minimizedAfter=await js('window.rainTest.snapshot()');win.restore();await pause(250);
  const primary=screen.getPrimaryDisplay().workArea;
  const focusTarget=new BrowserWindow({x:primary.x+80,y:primary.y+80,width:180,height:120,show:false,backgroundColor:'#17262d'});
  focusTarget.show();focusTarget.focus();await pause(180);
  const wasUnfocused=!win.isFocused(),unfocusedBefore=await js('window.rainTest.snapshot()');await pause(1000);const unfocusedAfter=await js('window.rainTest.snapshot()');focusTarget.close();win.focus();
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'F11'});await pause(400);const f11=win.isFullScreen();
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await pause(600);
  const stopped={nativeFullscreen:win.isFullScreen(),bounds:win.getBounds(),snapshot:await js('window.rainTest.snapshot()')};await screenshot('stopped-settings');performance.push(await profile('settings after Stop'));
  const checks={keyboardSettings,pointerTests,f11,escapeReturnedToSettings:!stopped.snapshot.viewing&&!stopped.nativeFullscreen,minimizedFrames:minimizedAfter.frames-minimizedBefore.frames,wasUnfocused,unfocusedFrames:unfocusedAfter.frames-unfocusedBefore.frames};
  const output={platform:process.platform,arch:process.arch,versions:process.versions,os:{release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},gpu:await app.getGPUInfo('basic'),displays:screen.getAllDisplays(),startup,stopped,result,checks,landscapes,landscapePerformance,monitorTests,captures,trajectory,performance,errors};
  await writeFile(path.join(directory,'smoke-results.json'),JSON.stringify(output,null,2));
  const failed=result.failed.length||errors.length||landscapes.length!==10||landscapes.some(x=>x.errors.length||x.renderedStyle!==x.style)||!Object.values(pointerTests).every(Boolean)||!keyboardSettings||!f11||!checks.escapeReturnedToSettings||checks.minimizedFrames!==0||!wasUnfocused||checks.unfocusedFrames===0;
  console.log('Viewer/resource evidence:',directory,'checks:',result.passed.length,'failures:',result.failed.length,'additional:',JSON.stringify(checks));app.exit(failed?1:0);
}
