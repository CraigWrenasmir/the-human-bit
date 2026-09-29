#!/usr/bin/env node
/** Deterministic, resumable full-episode renderer. Requires Playwright, Chromium, ffmpeg and ffprobe. */
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
if(args.includes('--help')||args.includes('-h')){
 console.log(`The Human Bit — resumable 1080p full-episode export

Usage: npm run render -- [options]
Start the local server before rendering. Playwright Chromium, ffmpeg and ffprobe
must be installed. Completed segments are reused only when their content,
source files and render settings match. Ctrl-C is safe; repeat the same command.

  --url URL                 Scene URL (portable default http://127.0.0.1:4200/)
  --dir PATH                Scene directory (portable default package directory)
  --out PATH                MP4 output (default ../The-Human-Bit-full-episode.mp4)
  --scratch PATH            Resumable segments/report directory
  --motion 1.6              Playful (1.6), Lively (1), Gentle (0.35)
  --workers 3               Parallel browser workers (1–4)
  --segment-seconds 90      Checkpoint length (1–600 seconds)
  --start 0 --duration N    Render a shorter review clip
  --samples --times 3,754   Save selected native PNG frames only
  --capture png            Lossless PNG capture; jpeg is also supported
  --audio PATH              Source MP3 (default assets/episode.mp3)
  --timing PATH             Timing JSON (default assets/timing.json)
  --chromium PATH           Override Playwright's Chromium executable
  --ffmpeg PATH             Override ffmpeg executable
  --ffprobe PATH            Override ffprobe executable
  --help                    Show this help
`);process.exit(0);
}
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const portable=path.basename(import.meta.dirname)==='tools',root=path.resolve(import.meta.dirname,'..');
const base=path.resolve(arg('--dir',portable?root:path.join(root,'outputs/the-human-bit')));
const url=arg('--url',portable?'http://127.0.0.1:4200/':'http://127.0.0.1:4200/the-human-bit/');
const output=path.resolve(arg('--out',path.join(base,'../The-Human-Bit-full-episode.mp4')));
if(/(?:pilot|character-v|sandpit-v|voxel-v).*\.mp4$/i.test(path.basename(output)))throw Error('Pilot exports are protected; select a full-episode or benchmark filename.');
const scratch=path.resolve(arg('--scratch',path.join(root,'work/render-full')));
const timingPath=path.resolve(arg('--timing',path.join(base,'assets/timing.json')));
const audioPath=path.resolve(arg('--audio',path.join(base,'assets/episode.mp3')));
const fps=Number(arg('--fps','30')),motion=Number(arg('--motion','1.6'));
const width=1920,height=1080,workers=Math.max(1,Math.min(4,Number(arg('--workers','3'))));
const segmentSeconds=Number(arg('--segment-seconds','90')),captureType=arg('--capture','png');
const ffmpeg=arg('--ffmpeg','ffmpeg'),ffprobe=arg('--ffprobe','ffprobe');
const timing=JSON.parse(await fs.readFile(timingPath,'utf8'));
const start=Number(arg('--start','0')),duration=Number(arg('--duration',String(timing.duration-start)));
if(!(start>=0&&duration>0&&start+duration<=timing.duration+.001))throw Error('Start and duration must stay inside timing.json.');
if(!(fps>0&&fps<=60&&segmentSeconds>=1&&segmentSeconds<=600))throw Error('Invalid frame rate or segment duration.');
if(!['png','jpeg'].includes(captureType))throw Error('Capture must be png or jpeg.');
if(![.35,1,1.6].includes(motion))throw Error('Motion must be .35, 1 or 1.6.');
const frameCount=Math.ceil(duration*fps),segmentFrames=Math.round(segmentSeconds*fps);
const launchArgs=['--enable-webgl','--ignore-gpu-blocklist',...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu']:[]),'--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required'];
const children=new Set(),errors=[],warnings=[];let stopping=false,browser;
async function sha(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex')}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function writeJSON(file,value){const temporary=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file)}
async function walk(dir){let files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name==='tools'||e.name==='work'||e.name.startsWith('.'))continue;const p=path.join(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else if(/\.(?:html|js|mjs|css|json|mp3|png|jpe?g|webp|ttf|woff2?)$/i.test(e.name)&&e.name!=='validation.json')files.push(p)}return files.sort()}
async function sourceIdentity(){const files={};for(const file of await walk(base))files[path.relative(base,file)]=await sha(file);return {files,timing:await sha(timingPath),audio:await sha(audioPath),renderer:await sha(new URL(import.meta.url))}}
function run(command,argv,{pipe=false}={}){const p=spawn(command,argv,{stdio:[pipe?'pipe':'ignore','pipe','pipe']});children.add(p);let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);const done=new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',code=>{children.delete(p);code===0?resolve({stdout,stderr}):reject(Error(`${command} exited ${code}: ${stderr.slice(-5000)}`))})});done.catch(()=>{});if(pipe)p.stdin.on('error',()=>{});return {process:p,done}}
async function probe(file){const {stdout}=await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]).done;return JSON.parse(stdout)}
function validSegment(info,frames){const v=info.streams.filter(s=>s.codec_type==='video');return v.length===1&&info.streams.length===1&&v[0].codec_name==='h264'&&v[0].pix_fmt==='yuv420p'&&v[0].width===width&&v[0].height===height&&Number(v[0].nb_frames)===frames&&Math.abs(Number(v[0].duration)-frames/fps)<1/fps+.001}
function stop(){stopping=true;for(const p of children)p.kill('SIGTERM');browser?.close().catch(()=>{});}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
await fs.mkdir(scratch,{recursive:true});await fs.mkdir(path.dirname(output),{recursive:true});
const started=Date.now(),identity=await sourceIdentity();
browser=await chromium.launch({headless:true,executablePath:arg('--chromium',process.env.CHROMIUM_PATH||chromium.executablePath()),args:launchArgs});
const config={schema:1,source:identity,url,browser:browser.version(),launchArgs,start,duration,frameCount,fps,width,height,motion,captureType,jpegQuality:.98,crf:17,preset:'fast',segmentFrames};
const runId=digest(config),runDir=path.join(scratch,runId.slice(0,16));await fs.mkdir(runDir,{recursive:true});
await writeJSON(path.join(runDir,'manifest.json'),{runId,config,createdAt:new Date().toISOString()});
await writeJSON(path.join(scratch,'latest-run.json'),{runId,runDir,output});
const segments=Array.from({length:Math.ceil(frameCount/segmentFrames)},(_,i)=>({index:i,startFrame:i*segmentFrames,endFrame:Math.min(frameCount,(i+1)*segmentFrames)}));
const segmentReports=[];
async function makePage(){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});page.setDefaultTimeout(120000);await page.goto(url+(url.includes('?')?'&':'?')+'render=1',{waitUntil:'networkidle',timeout:120000});await page.evaluate(async motion=>{await (window.episodeReady||window.pilotReady);await document.fonts.ready;const select=document.querySelector('#motion');if(!select)throw Error('Missing motion control');select.value=String(motion);select.dispatchEvent(new Event('change',{bubbles:true}));if(Number(select.value)!==motion)throw Error('Requested motion unavailable');if(typeof window.renderAt!=='function')throw Error('Missing renderAt');},motion);const servedDuration=await page.evaluate(()=>window.pilotInfo?.duration??window.pilotData?.duration);if(Math.abs(Number(servedDuration)-timing.duration)>.001||!Number.isFinite(Number(servedDuration)))throw Error('Served scene duration differs from selected timing.json');const size=await page.locator('#film').evaluate(c=>({w:c.width,h:c.height}));if(size.w!==width||size.h!==height)throw Error('Native canvas is not 1920×1080');return {page,context}}
async function capture(page,t,type=captureType){return Buffer.from(await page.evaluate(({t,type})=>{window.renderAt(t);return document.querySelector('#film').toDataURL('image/'+type,.98).split(',')[1]},{t,type}),'base64')}
async function encode(page,segment){if(stopping)throw Error('Interrupted');const frames=segment.endFrame-segment.startFrame,file=path.join(runDir,`segment-${String(segment.index).padStart(3,'0')}.mp4`),receipt=file+'.json';
 try{const saved=JSON.parse(await fs.readFile(receipt,'utf8'));if(saved.runId===runId&&saved.frames===frames&&saved.sha256===await sha(file)&&validSegment(await probe(file),frames)){const item={...saved,reused:true};segmentReports.push(item);console.log(`Reused segment ${segment.index+1}/${segments.length}`);return file}}catch{}
 const part=file+'.partial.mp4',t0=Date.now(),err0=errors.length;
 const {process:encoder,done}=run(ffmpeg,['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-framerate',String(fps),'-vcodec',captureType==='png'?'png':'mjpeg','-i','pipe:0','-an','-vf',`scale=in_range=full:out_range=tv:${captureType==='jpeg'?'in_color_matrix=bt601:':''}out_color_matrix=bt709,format=yuv420p`,'-c:v','libx264','-x264-params','colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-r',String(fps),'-video_track_timescale','90000','-threads','2',part],{pipe:true});
 try{for(let f=segment.startFrame;f<segment.endFrame;f++){if(stopping)throw Error('Interrupted');const buffer=await capture(page,start+f/fps);if(!encoder.stdin.write(buffer))await once(encoder.stdin,'drain');}encoder.stdin.end();const result=await done;if(result.stderr.trim())warnings.push(result.stderr.trim());if(errors.length>err0)throw Error('Browser error during segment');const info=await probe(part);if(!validSegment(info,frames))throw Error('Encoded segment failed metadata validation');await fs.rename(part,file);const saved={runId,index:segment.index,file,frames,start:start+segment.startFrame/fps,end:start+segment.endFrame/fps,sha256:await sha(file),seconds:(Date.now()-t0)/1000};await writeJSON(receipt,saved);segmentReports.push({...saved,reused:false});console.log(`Completed segment ${segment.index+1}/${segments.length}: ${saved.start.toFixed(2)}–${saved.end.toFixed(2)}s in ${saved.seconds.toFixed(1)}s`);await writeJSON(path.join(scratch,'progress.json'),{runId,completed:segmentReports.length,total:segments.length,segments:segmentReports});return file}catch(e){encoder.kill('SIGTERM');throw e}
}
let result;
try{
 if(args.includes('--samples')){const {page,context}=await makePage(),times=arg('--times',`${start+3},${start+duration/2},${start+duration-3}`).split(',').map(Number);const samples=[];for(const t of times){if(t<start||t>=start+duration)continue;const file=path.join(scratch,`sample-${t.toFixed(3).replace('.','-')}.png`);await fs.writeFile(file,await capture(page,t,'png'));samples.push({t,file})}await context.close();result={mode:'samples',samples};}
 else if(args.includes('--benchmark')){const {page,context}=await makePage(),count=Number(arg('--benchmark-frames','60')),bench=[];for(const type of ['png','jpeg']){let bytes=0;const begin=Date.now();for(let f=0;f<count;f++)bytes+=(await capture(page,start+Math.min(duration-.01,3+f/fps),type)).length;bench.push({type,frames:count,seconds:(Date.now()-begin)/1000,bytes,averageBytes:bytes/count});await fs.writeFile(path.join(scratch,`benchmark-${type}.${type==='png'?'png':'jpg'}`),await capture(page,start+Math.min(duration-.01,3),type))}await context.close();result={mode:'benchmark',bench};}
 else{let next=0;const files=new Array(segments.length);await Promise.all(Array.from({length:Math.min(workers,segments.length)},async()=>{const {page,context}=await makePage();try{while(next<segments.length){const segment=segments[next++];files[segment.index]=await encode(page,segment)}}finally{await context.close()}}));if(stopping)throw Error('Interrupted');if(digest(await sourceIdentity())!==digest(identity))throw Error('Source changed during export; refusing to combine inconsistent frames. Completed segments retained.');const concat=path.join(runDir,'concat.txt');await fs.writeFile(concat,files.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join('\n')+'\n');const part=output+'.partial.mp4';await run(ffmpeg,['-hide_banner','-loglevel','warning','-y','-f','concat','-safe','0','-i',concat,'-ss',String(start),'-i',audioPath,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-af','apad','-t',String(duration),'-movflags','+faststart',part]).done;const info=await probe(part),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');if(!v||!a||Math.abs(Number(v.duration)-duration)>1/fps+.01||Math.abs(Number(a.duration)-duration)>.1)throw Error('Final stream durations are inconsistent');await fs.rename(part,output);result={mode:'video',file:output,sha256:await sha(output),bytes:(await fs.stat(output)).size,frameCount,duration,start,width,height,fps,motion,segments:segmentReports.sort((a,b)=>a.index-b.index)};}
}finally{stop();await browser.close().catch(()=>{})}
const report={...result,runId,runDir,elapsedSeconds:(Date.now()-started)/1000,errors:[...new Set(errors)],warnings:[...new Set(warnings)],source:{url,base,timingPath,audioPath},config};
await writeJSON(path.join(scratch,result.mode==='video'?'render-report.json':`${result.mode}-report.json`),report);console.log(JSON.stringify({...report,config:undefined,segments:undefined},null,2));if(errors.length)process.exitCode=1;
