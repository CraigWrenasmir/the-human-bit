import * as THREE from './vendor/three.module.js';
import { createPortrait } from './portrait.js?v=7';

const W=1920,H=1080, $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const renderMode=params.has('render');
if(renderMode)document.body.classList.add('render-mode');
const audio=$('audio'), canvas=$('film');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setClearColor('#f5f4fb');
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight('#e6f0ff','#303346',2.0));
const key=new THREE.DirectionalLight('#fff4e6',2.6);key.position.set(-600,800,1000);scene.add(key);
const fill=new THREE.DirectionalLight('#a2cfff',.65);fill.position.set(800,100,400);scene.add(fill);
const camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,.1,3000);camera.position.z=1500;
const accents={josh:'#5a7ec2',craig:'#6b6b9d'}, white='#2a2a3a', muted='#5a5a6a';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{let x=clamp((v-a)/(b-a));return x*x*(3-2*x)};
const font=(size,weight=400)=>`${weight} ${size}px "Inter",Arial,sans-serif`;
const mono=size=>`${size}px "Space Mono",ui-monospace,monospace`;
let timing,chapters=[],portraits={},motion=1.6,lastTime=0,pendingSeek=null,lastSaved=-1,currentChapter=-1;
const storageKey='the-human-bit-s2e14-v1';
let saved={};
try{if(!renderMode)saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{}
if(!renderMode&&[.35,1,1.6].includes(saved.motion)){motion=saved.motion;$('motion').value=String(motion)}
if(!renderMode&&matchMedia('(prefers-reduced-motion: reduce)').matches){motion=.35;$('motion').value='0.35'}
const bg=document.createElement('canvas');bg.width=W;bg.height=H;
const b=bg.getContext('2d');
let brandLogo;
function background(){
  b.fillStyle='#f5f4fb';b.fillRect(0,0,W,H);
  // Characters share the continuous lavender stage, with no portrait backplates.
  b.fillStyle='#9090c017';for(let y=288;y<995;y+=28)for(let x=110;x<=1810;x+=28)b.fillRect(x,y,2,2);
  b.font=mono(14);b.fillStyle='#6b6b9d';b.fillText('// THE UNIVERSAL SANDPIT // CONVERSATIONS',110,70);
  b.font='700 64px "Space Mono",monospace';b.fillStyle=white;const title='The Human Bit';b.fillText(title,106,159);
  const titleEnd=106+b.measureText(title).width;b.fillStyle='#9090c0';b.fillRect(Math.round(titleEnd+18),112,26,46);
  b.font=font(22,400);b.fillStyle='#5a5a6a';b.fillText('AI, education & the human side of learning',112,208);
  if(brandLogo)b.drawImage(brandLogo,1560,30,250,250*brandLogo.naturalHeight/brandLogo.naturalWidth);
  b.textAlign='right';b.font=font(20,500);b.fillStyle='#2a2a3a';b.fillText('Joshua MacWilliams x Craig Smith',1810,186);b.font=mono(12);b.fillStyle='#6b6b9d';b.fillText('PARENT TEACHER INTERVIEW / S2 E14',1810,219);b.textAlign='left';
  ['#d64a4a','#e8c547','#5ab97a','#5a7ec2'].forEach((colour,i)=>{b.fillStyle=colour;b.fillRect(110+i*425,251,425,3)});
  b.strokeStyle='#9090c04d';b.beginPath();b.moveTo(110,1000);b.lineTo(1810,1000);b.stroke();
  b.font=mono(12);b.fillStyle='#6b6b9d';b.fillText('/// HAVE A NICE DAY ///',110,1045);b.textAlign='right';b.fillText('THEUNIVERSALSANDPIT.ORG',1810,1045);b.textAlign='left';
}

function layer(c,z){const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({map:texture,transparent:z>0,depthWrite:false,depthTest:false,toneMapped:false}));mesh.position.z=z;mesh.renderOrder=z;scene.add(mesh);return texture}
const backgroundTexture=layer(bg,-200);
const groundCanvas=document.createElement('canvas');groundCanvas.width=W;groundCanvas.height=H;const ground=groundCanvas.getContext('2d');
for(const x of [435,1485]){ground.fillStyle='#6b6b9d22';ground.beginPath();ground.ellipse(x+5,874,114,13,0,0,Math.PI*2);ground.fill()}
const groundTexture=layer(ground,-150);groundTexture.image=groundCanvas;groundTexture.needsUpdate=true;
// This second backdrop has alpha; draw it immediately after the opaque paper.
const groundMesh=scene.children.find(o=>o.material?.map===groundTexture);groundMesh.material.transparent=true;

const ink=document.createElement('canvas');ink.width=W;ink.height=H;const ctx=ink.getContext('2d'),inkTexture=layer(ink,200);

function format(t){t=Math.max(0,Math.floor(t));const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=String(t%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`}
function intervalAt(items,t){let lo=0,hi=items.length-1,index=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(items[mid].start<=t){index=mid;lo=mid+1}else hi=mid-1}const item=items[index];return item&&t<item.end?item:null}
function cueAt(t){return intervalAt(timing.cues,t)}
function energyAt(t){const e=timing.envelope;if(!e)return .1;const a=Array.isArray(e)?e:e.values;const fps=e.fps||60;const i=Math.max(0,Math.floor(t*fps));let total=0,weight=0;for(let n=-2;n<=2;n++){let w=3-Math.abs(n);total+=(a[Math.max(0,Math.min(a.length-1,i+n))]||0)*w;weight+=w}return clamp(total/weight)}
function turnAt(t){return intervalAt(timing.turns,t)}
function wordsFor(cue){return Number.isInteger(cue.wordStart)?timing.words.slice(cue.wordStart,cue.wordEnd):timing.words.filter(w=>w.speaker===cue.speaker&&w.start>=cue.start-.04&&w.start<cue.end-.015)}

function drawName(x,y,name,role,kind,active,e,t){
 ctx.save();ctx.textAlign='center';ctx.fillStyle=white;ctx.font='700 27px "Space Mono",monospace';ctx.fillText(name,x,y);
 ctx.font=mono(12);ctx.fillStyle=active?accents[kind]:'#6b6b9d';ctx.fillText(role,x,y+30);
 for(let i=0;i<17;i++){const amp=active?(4+e*22*(.25+.75*Math.abs(Math.sin(i*1.27+t*8)))):3;ctx.fillStyle=active?accents[kind]+'c0':'#9090c050';ctx.fillRect(x-47+i*6,y+55-amp/2,3,amp)}
 ctx.restore();
}
function drawConversation(t,cue,speaker,energy){
 const name=speaker==='josh'?'JOSHUA MACWILLIAMS':speaker==='craig'?'CRAIG':'PARENT TEACHER INTERVIEW',color=accents[speaker]||'#879aab';
 if(!cue)return;
 let words=wordsFor(cue);if(!words.length)words=cue.text.split(/\s+/).map((text,i,a)=>({text,start:cue.start+(cue.end-cue.start)*i/a.length,end:cue.start+(cue.end-cue.start)*(i+1)/a.length}));
 let fs=55,width=518;const maxLines=4;let rows;
 const layout=()=>{ctx.font=font(fs,500);let out=[[]],used=0;for(const w of words){const tw=ctx.measureText(w.text).width,space=ctx.measureText(' ').width;if(used+tw>width&&out[out.length-1].length){out.push([]);used=0}out[out.length-1].push({...w,x:used,width:tw});used+=tw+space}return out};
 rows=layout();while((rows.length>maxLines||rows.some(row=>row.some(w=>w.width>width)))&&fs>28){fs-=2;rows=layout()}
 const lineHeight=fs*1.23,blockHeight=rows.length*lineHeight;
 const x=702,y=545-blockHeight/2+fs;
 const fade=smooth(cue.start,cue.start+.1,t)*(1-smooth(cue.end-.12,cue.end,t));
 ctx.save();ctx.globalAlpha=fade;
 const boxX=666,boxY=y-fs-78,boxW=588,boxH=blockHeight+123;
 // Stepped speech balloon with a tiny pixel tail towards the person speaking.
 function balloon(offset,fill){ctx.fillStyle=fill;ctx.fillRect(boxX+14,boxY+offset,boxW-28,boxH);ctx.fillRect(boxX,boxY+14+offset,boxW,boxH-28);const tailY=Math.min(boxY+boxH-45,Math.max(boxY+30,555));if(speaker==='josh'){ctx.fillRect(boxX-12,tailY+offset,12,24);ctx.fillRect(boxX-24,tailY+offset,12,12)}else if(speaker==='craig'){ctx.fillRect(boxX+boxW,tailY+offset,12,24);ctx.fillRect(boxX+boxW+12,tailY+offset,12,12)}}
 balloon(7,'#dcdbea');balloon(0,'#ffffff');
 ctx.font=mono(14);ctx.fillStyle=color;ctx.fillRect(x,y-fs-41,7,7);ctx.fillText(name+' SAYS',x+18,y-fs-33);
 ctx.font=font(fs,500);
 rows.forEach((row,r)=>row.forEach(w=>{
   const appeared=smooth(w.start-.045,w.start+.12,t),past=t>=w.start,current=t>=w.start-.035&&t<w.end;
   ctx.globalAlpha=fade*(past?.98:.105);ctx.fillStyle=current?color:white;
   const dy=(1-appeared)*8*motion;ctx.fillText(w.text,x+w.x,y+r*lineHeight+dy);
   if(current){ctx.globalAlpha=fade*.75;ctx.fillStyle=color;ctx.fillRect(x+w.x,y+r*lineHeight+12,Math.max(4,w.width*clamp((t-w.start)/(Math.max(.05,w.end-w.start)))),2)}
 }));

 ctx.restore();
}

function drawAmbient(t,speaker,e){
 // A low, slowly flowing path recalls the rhythm of a walk.
 ctx.save();ctx.lineWidth=1;ctx.strokeStyle='#9090c066';ctx.beginPath();
 for(let x=650;x<=1270;x+=7){const y=912+Math.sin(x*.014+t*.65)*8+Math.sin(x*.006-t*.3)*13;if(x===650)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
 for(let i=0;i<16;i++){let x=663+((i*41+t*12)%587),y=912+Math.sin(x*.014+t*.65)*8+Math.sin(x*.006-t*.3)*13;ctx.fillStyle=i%4===0?'#e8c547aa':'#5a7ec288';ctx.fillRect(x,y-1,3,3)}
 ctx.font=mono(11);ctx.fillStyle='#6b6b9d';ctx.textAlign='center';ctx.fillText('R H Y T H M   ·   I N S I G H T   ·   P L A Y',960,966);
 const p=clamp(t/timing.duration);ctx.fillStyle='#9090c045';ctx.fillRect(110,999,1700*p,2);ctx.fillStyle=(accents[speaker]||white)+'a0';ctx.fillRect(110+1700*p,997,4,5);
 ctx.restore();
}

window.renderAt=function(t){
 if(!timing||!portraits.josh)return;lastTime=clamp(t,0,timing.duration);
 const turn=turnAt(t),cue=cueAt(t),speaker=cue?.speaker||turn?.speaker||null,e=cue?energyAt(t):0;
 const focus=turn?smooth(turn.start,turn.start+.35,t)*(1-smooth(turn.end-.25,turn.end,t)):0;
 for(const kind of ['josh','craig']){const portrait=portraits[kind],active=speaker===kind;portrait.update(t,active?e:0,active,motion);portrait.group.position.set(kind==='josh'?-525:525,-36,0);portrait.group.scale.setScalar(1+.008*(active?focus:0))}
 ctx.clearRect(0,0,W,H);drawAmbient(t,speaker,e);
 drawName(435,919,'Joshua MacWilliams','HOST','josh',speaker==='josh',e,t);
 drawName(1485,919,'Craig Smith','GUEST','craig',speaker==='craig',e,t);
 drawConversation(t,cue,cue?.speaker||speaker,e);
 if(t>timing.duration-.6){ctx.fillStyle=`rgba(245,244,251,${smooth(timing.duration-.6,timing.duration,t)*.8})`;ctx.fillRect(0,0,W,H)}
 inkTexture.needsUpdate=true;renderer.render(scene,camera);
 $('seek').value=String(t);$('seek').setAttribute('aria-valuetext',`${format(t)} of ${format(timing.duration)}`);$('clock').textContent=`${format(t)} / ${format(timing.duration)}`;
 if(!renderMode)updateChapter(t);
};

function savePosition(){
 if(renderMode||!timing)return;
 try{localStorage.setItem(storageKey,JSON.stringify({seconds:lastTime>=timing.duration-2?0:lastTime,motion}))}catch{}
}
function updateChapter(t){
 let index=-1;for(let i=0;i<chapters.length;i++){if(chapters[i].start<=t)index=i;else break}
 if(index===currentChapter)return;currentChapter=index;
 document.querySelectorAll('.chapter-button').forEach((button,i)=>{if(i===index)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current')});
 $('chapter-current').textContent=index>=0?chapters[index].title:'The full conversation';
}
async function seekTo(seconds,play=false){
 await window.episodeReady;
 const t=clamp(Number(seconds)||0,0,timing.duration);
 pendingSeek=t;window.renderAt(t);
 if(audio.readyState>=1){audio.currentTime=t;pendingSeek=null}
 if(play){try{await audio.play()}catch{$('play-status').textContent='Playback could not start. Press Play to try again.'}}
 savePosition();updateButtons();
}
function buildNavigation(){
 const fragment=document.createDocumentFragment();
 chapters.forEach(chapter=>{const li=document.createElement('li'),button=document.createElement('button'),time=document.createElement('span'),label=document.createElement('span');button.type='button';button.className='chapter-button';time.className='chapter-time';time.textContent=format(chapter.start);label.textContent=chapter.title;button.append(time,label);button.onclick=()=>seekTo(chapter.start,true);li.append(button);fragment.append(li)});
 $('chapters').replaceChildren(fragment);
 const transcript=document.createDocumentFragment();
 for(const turn of timing.turns){const words=timing.words.filter(w=>w.speaker===turn.speaker&&w.start>=turn.start-.01&&w.start<turn.end);if(!words.length)continue;const p=document.createElement('p'),button=document.createElement('button'),strong=document.createElement('strong');button.type='button';button.className='transcript-time';button.textContent=format(turn.start);button.setAttribute('aria-label',`Play from ${format(turn.start)}`);button.onclick=()=>seekTo(turn.start,true);strong.textContent=turn.speaker==='josh'?'Joshua MacWilliams: ':turn.speaker==='craig'?'Craig Smith: ':'Transcript: ';p.append(button,strong,document.createTextNode(words.map(w=>w.text).join(' ')));transcript.append(p)}
 $('transcript').replaceChildren(transcript);
}
window.episodeReady=(async()=>{
 const [logo,data,chapterData]=await Promise.all([
  new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('The Sandpit logo could not be loaded'));img.src='assets/universal-sandpit-logo.png'}),
  fetch('assets/timing.json').then(r=>{if(!r.ok)throw Error('Timing file could not be loaded');return r.json()}),
  fetch('assets/chapters.json').then(r=>{if(!r.ok)throw Error('Chapter file could not be loaded');return r.json()}),
  document.fonts.load('400 14px "Space Mono"'),document.fonts.load('700 64px "Space Mono"'),
  document.fonts.load('400 22px "Inter"'),document.fonts.load('500 55px "Inter"'),document.fonts.load('600 16px "Inter"')
 ]);
 timing=data;chapters=Array.isArray(chapterData)?chapterData:chapterData.chapters;
 brandLogo=logo;background();backgroundTexture.needsUpdate=true;
 const [josh,craig]=await Promise.all([createPortrait(THREE,null,'josh'),createPortrait(THREE,null,'craig')]);
 portraits={josh,craig};scene.add(josh.group,craig.group);
 $('seek').max=timing.duration;window.pilotData=timing;window.pilotInfo={duration:timing.duration,pixels:josh.pixelCount+craig.pixelCount,motion};
 if(!renderMode)buildNavigation();
 let initial=0;
 if(!renderMode){
  const linked=params.has('t')?Number(params.get('t')):NaN;
  initial=Number.isFinite(linked)?linked:Number(saved.seconds)||0;
  initial=clamp(initial,0,timing.duration-1);
  if(initial>timing.duration-3)initial=0;
  pendingSeek=initial;
  // Stream directly: the first frame and navigation never wait for the whole MP3.
  audio.src='assets/episode.mp3';audio.load();
  $('start').textContent=initial>1?`▶ Resume at ${format(initial)}`:'▶ Watch the conversation';
 }
 $('loading').remove();window.renderAt(initial);return window.pilotInfo;
})().catch(err=>{$('loading').textContent='Could not load the episode: '+err.message;throw err});
window.pilotReady=window.episodeReady;

function updateButtons(){const playing=!audio.paused;$('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-label',playing?'Pause episode':'Play episode');if(playing){document.querySelector('.start').classList.add('hide');$('play-status').textContent=''}}
async function toggle(){await window.episodeReady;if(audio.paused){if(audio.ended)audio.currentTime=0;if(pendingSeek!==null&&audio.readyState>=1){audio.currentTime=pendingSeek;pendingSeek=null}try{await audio.play()}catch{$('play-status').textContent='Playback could not start. Press Play to try again.'}}else audio.pause();updateButtons()}
$('play').onclick=toggle;$('start').onclick=toggle;
$('restart').onclick=()=>seekTo(0,true);
$('seek').addEventListener('input',()=>seekTo(Number($('seek').value)));
$('motion').onchange=()=>{motion=Number($('motion').value);window.renderAt(lastTime);savePosition()};
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.querySelector('.stage').requestFullscreen();
audio.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){audio.currentTime=pendingSeek;pendingSeek=null}});
audio.addEventListener('play',updateButtons);audio.addEventListener('pause',()=>{updateButtons();savePosition()});audio.addEventListener('ended',()=>{updateButtons();window.renderAt(timing.duration);savePosition()});
audio.addEventListener('waiting',()=>{if(!audio.paused)$('play-status').textContent='Loading audio…'});
audio.addEventListener('playing',()=>{$('play-status').textContent=''});
audio.addEventListener('error',()=>{$('play-status').textContent='Audio could not load. Please refresh and try again.'});
window.addEventListener('pagehide',savePosition);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','SELECT','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();toggle()}});
if(!renderMode){let last=-1;function tick(){requestAnimationFrame(tick);if(timing&&!audio.paused&&audio.currentTime!==last){last=audio.currentTime;window.renderAt(last);if(Math.abs(last-lastSaved)>5){savePosition();lastSaved=last}}}requestAnimationFrame(tick)}
