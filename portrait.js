/** Hand-drawn pixel characters, built from coloured blocks in Three.js.
 * The supplied portraits inform identity; no photograph is sampled or warped.
 * Large connected colour shapes keep the face legible while the character acts. */
export async function createPortrait(THREE, _url, kind='craig') {
  const josh=kind==='josh', cell=13, cols=32, rows=46;
  const palette={
    outline:'#292e40', hair:josh?'#463e35':'#65503f', hairLight:josh?'#655644':'#8b6b4c', hairDark:josh?'#36342f':'#514237', beard:'#7d6a59', beardShade:'#695c50',
    skin:josh?'#f5ccaa':'#ffdaa2', skinLight:josh?'#ffe0bf':'#ffe8bd', skinShade:josh?'#dbaa88':'#eab486', nose:josh?'#ce9c7e':'#d59670', cheek:josh?'#e6b294':'#edb090',
    eye:'#292e40', cream:'#fff3d1', mustard:'#e9b852', rust:'#cc8e59', teal:'#82b6ad', tealDark:'#60948f',
    blue:'#769daf', blueLight:'#a8c5ca', iris:'#83aabb', henley:'#f4efdf', henleyLight:'#fffaee', henleyShade:'#d7d1c3', trouser:josh?'#789fa6':'#86b8a8', trouserLight:josh?'#a4c0be':'#b0d1b4',
    sole:'#444955', tongue:'#d58b83', button:'#e7c874'
  };
  const group=new THREE.Group();group.name=kind+'-pixel-character';
  // Mirror the whole Craig character around its centre so he faces screen-left.
  // Instance transforms stay positive; the enclosing group carries the reflection.
  const character=new THREE.Group();character.name=kind+'-facing-conversation';character.scale.x=josh?1:-1;group.add(character);
  const head=new THREE.Group(),body=new THREE.Group();character.add(body,head);
  const colours=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,new THREE.Color(v)]));
  const geometry=new THREE.BoxGeometry(cell,cell,5);
  const material=new THREE.MeshBasicMaterial({toneMapped:false});
  const allMeshes=[];let pixelCount=0;
  const grid=()=>Array.from({length:rows},()=>Array(cols).fill(null));
  function rect(g,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(g[yy]&&xx>=0&&xx<cols)g[yy][xx]=c}
  function poly(g,points,c){for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y+.5)!==(yj>y+.5)&&x+.5<(xj-xi)*(y+.5-yi)/(yj-yi)+xi)inside=!inside}if(inside)g[y][x]=c}}
  function make(g,parent,pivotX=16,pivotY=23,z=0){
    const pixels=[];g.forEach((row,y)=>row.forEach((c,x)=>{if(c)pixels.push({x,y,c})}));
    const mesh=new THREE.InstancedMesh(geometry,material,pixels.length),dummy=new THREE.Object3D();
    pixels.forEach((p,i)=>{dummy.position.set((p.x+.5-pivotX)*cell,(pivotY-p.y-.5)*cell,z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,colours[p.c])});
    mesh.name=kind+'-authored-pixel-layer';parent.add(mesh);allMeshes.push(mesh);pixelCount+=pixels.length;return mesh;
  }
  // Little trousers and shoes. The dark outline is part of the drawing.
  const legs=grid();rect(legs,9,38,7,8,'outline');rect(legs,18,38,7,8,'outline');
  rect(legs,10,39,5,5,'trouser');rect(legs,19,39,5,5,'trouser');
  rect(legs,10,39,2,5,'trouserLight');rect(legs,19,39,2,5,'trouserLight');
  rect(legs,10,44,5,1,'sole');rect(legs,19,44,5,1,'sole');make(legs,body);
  // Articulated sleeves and hands sit behind the shirt, without gaps at shoulders.
  function arm(right){
    const a=grid(),x=right?23:5;
    poly(a,[[x+1,29],[x+5,29],[x+5,31],[x+6,31],[x+6,40],[x,40],[x,32],[x+1,32]],'outline');
    if(josh){
      rect(a,x+1,31,4,5,'henley');rect(a,x+1,31,1,5,'henleyShade');rect(a,x+2,31,2,1,'henleyLight');
    }else{
      rect(a,x+1,31,4,5,'cream');rect(a,x+1,33,4,2,'teal');rect(a,x+1,35,4,1,'mustard');
    }
    rect(a,x+1,37,4,2,'skin');rect(a,x+1,37,1,2,'skinShade');
    const parent=new THREE.Group(),px=right?24:9,py=30;
    parent.position.set((px-16)*cell,(23-py)*cell,0);body.add(parent);make(a,parent,px,py,0);return parent;
  }
  const leftArm=arm(false),rightArm=arm(true);
  const shirt=grid();
  poly(shirt,[[10,27],[22,27],[22,29],[25,29],[25,40],[8,40],[8,30],[10,30]],'outline');
  if(josh){
    // Josh's reference photo: a plain cream henley, with a short button placket.
    rect(shirt,10,29,13,10,'henley');rect(shirt,10,32,1,7,'henleyShade');rect(shirt,22,31,1,8,'henleyShade');
    rect(shirt,11,29,11,2,'henleyLight');
    poly(shirt,[[13,28],[20,28],[20,30],[19,30],[19,31],[17,33],[15,31],[14,31],[14,30],[13,30]],'skinShade');
    rect(shirt,15,28,4,2,'skin');rect(shirt,17,32,1,5,'henleyShade');
    rect(shirt,17,33,1,1,'outline');rect(shirt,17,36,1,1,'outline');
  }else{
    rect(shirt,10,29,13,10,'cream');
    // Craig's broad cream, teal and mustard flannel checks.
    for(let y=30;y<39;y++)for(let x=10;x<23;x++){
      const stripeX=(x>=12&&x<14)||(x>=20&&x<22), stripeY=(y>=32&&y<34)||(y>=36&&y<38);
      shirt[y][x]=stripeX?(stripeY?'rust':'teal'):(stripeY?'mustard':'cream');
    }
    rect(shirt,16,29,1,10,'outline');
    poly(shirt,[[10,29],[14,29],[16,32],[13,32]],'cream');
    poly(shirt,[[18,29],[23,29],[21,32],[17,32]],'cream');
    rect(shirt,15,28,4,2,'skinShade');rect(shirt,16,30,1,2,'outline');
    rect(shirt,17,33,1,1,'button');rect(shirt,17,37,1,1,'button');
  }
  make(shirt,body,16,23,7);

  // Head silhouette: large, connected and shallow, like a friendly game sprite.
  const h=grid();
  if(josh){
    // A compact side part and tapered jaw follow Josh's photograph.
    poly(h,[[11,2],[21,2],[21,3],[25,3],[25,5],[27,5],[27,8],[28,8],[28,17],[29,17],[29,21],[27,21],[27,23],[25,23],[25,25],[23,25],[23,27],[21,27],[21,28],[12,28],[12,27],[10,27],[10,25],[8,25],[8,23],[6,23],[6,21],[4,21],[4,17],[5,17],[5,11],[4,11],[4,7],[6,7],[6,5],[8,5],[8,3],[11,3]],'outline');
    poly(h,[[8,7],[25,7],[25,10],[26,10],[26,20],[25,20],[25,22],[23,22],[23,24],[21,24],[21,26],[12,26],[12,25],[10,25],[10,23],[8,23],[8,20],[7,20],[7,11],[8,11]],'skin');
    rect(h,7,12,1,7,'skinShade');rect(h,8,17,1,4,'skinShade');rect(h,24,11,2,8,'skinLight');
    rect(h,5,17,2,3,'skinShade');rect(h,27,17,1,3,'skinShade');
    // Close-cropped beard hugs the jaw, leaving cheeks and ears exposed.
    poly(h,[[8,19],[10,19],[10,21],[12,21],[12,23],[14,23],[14,24],[21,24],[21,23],[23,23],[23,21],[25,21],[25,19],[26,19],[26,22],[24,22],[24,24],[22,24],[22,26],[20,26],[20,27],[13,27],[13,26],[11,26],[11,24],[9,24],[9,22],[8,22]],'beard');
    rect(h,13,26,7,1,'beardShade');rect(h,14,20,7,1,'beard');
    rect(h,11,19,2,1,'cheek');rect(h,23,19,1,1,'cheek');rect(h,17,17,1,2,'nose');rect(h,17,19,2,1,'nose');
    // The sweep is fuller on the viewer's left, with a short right temple.
    poly(h,[[6,7],[8,7],[8,5],[11,5],[11,4],[21,4],[21,5],[25,5],[25,7],[26,7],[26,10],[27,10],[27,15],[25,15],[25,9],[22,9],[22,8],[18,8],[18,9],[13,9],[13,10],[10,10],[10,12],[8,12],[8,16],[6,16]],'hair');
    poly(h,[[8,7],[11,7],[11,6],[16,6],[16,5],[21,5],[21,6],[23,6],[23,7],[18,7],[18,8],[13,8],[13,9],[9,9],[9,10],[7,10],[7,8],[8,8]],'hairLight');
    rect(h,24,7,1,4,'hairDark');rect(h,26,11,1,4,'hairDark');
  }else{
    poly(h,[[13,0],[18,0],[18,2],[27,2],[27,4],[29,4],[29,6],[31,6],[31,9],[29,9],[29,12],[28,12],[28,24],[26,24],[26,27],[23,27],[23,28],[9,28],[9,27],[6,27],[6,25],[4,25],[4,22],[2,22],[2,9],[3,9],[3,6],[5,6],[5,4],[9,4],[9,2],[13,2]],'outline');
  // Broad beard mass, then a stepped, warm face nested inside it.
  poly(h,[[6,10],[26,10],[26,23],[24,23],[24,25],[22,25],[22,26],[10,26],[10,25],[8,25],[8,23],[6,23]],'hair');
  poly(h,[[8,10],[25,10],[25,20],[24,20],[24,22],[22,22],[22,24],[13,24],[13,23],[10,23],[10,21],[8,21]],'skin');
  rect(h,8,11,2,8,'skinShade');rect(h,10,11,13,2,'skinShade');
  rect(h,23,12,2,7,'skinLight');rect(h,21,12,2,2,'skinLight');
  rect(h,4,17,2,5,'skinShade');rect(h,5,17,1,4,'skin');rect(h,27,17,1,5,'skinShade');
  rect(h,11,20,2,1,'cheek');rect(h,22,20,2,1,'cheek');rect(h,17,18,2,2,'nose');
    poly(h,[[4,9],[6,9],[6,6],[10,6],[10,4],[15,4],[15,2],[18,2],[18,4],[27,4],[27,6],[29,6],[29,8],[27,8],[27,10],[24,10],[24,11],[10,11],[10,13],[7,13],[7,17],[4,17]],'hair');
    poly(h,[[6,8],[11,8],[11,6],[17,6],[17,4],[22,4],[22,6],[26,6],[26,8],[20,8],[20,9],[12,9],[12,10],[6,10]],'hairLight');
    rect(h,10,10,14,2,'hairDark');rect(h,6,17,2,6,'hairDark');
    rect(h,11,25,11,1,'hairLight');
  }
  // The head pivots at its neck; every feature stays attached to it.
  head.position.set(0,(23-27)*cell,12);make(h,head,16,27);
  const eyeGrid=grid();
  if(josh){
    rect(eyeGrid,12,14,2,3,'eye');rect(eyeGrid,21,14,2,3,'eye');
    rect(eyeGrid,12,15,1,2,'iris');rect(eyeGrid,21,15,1,2,'iris');
  }else{
    rect(eyeGrid,12,14,2,4,'eye');rect(eyeGrid,21,14,2,4,'eye');
    // Blue iris to the left of each dark pupil before mirroring: the rendered
    // pupils then sit towards Josh, matching his gaze in the opposite direction.
    rect(eyeGrid,12,15,1,2,'iris');rect(eyeGrid,21,15,1,2,'iris');
  }
  const eyes=make(eyeGrid,head,16,27,5);
  const closedGrid=grid();rect(closedGrid,11,16,3,1,'eye');rect(closedGrid,21,16,3,1,'eye');
  const closedEyes=make(closedGrid,head,16,27,5);
  // Small U-shaped rest smile; talking uses two friendly, toothless sprite poses.
  function mouthPose(lines){const g=grid();lines.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='.')rect(g,13+x,21+y,1,1,v==='p'?'tongue':'eye')}));return make(g,head,16,27,6)}
  const mouths=[mouthPose(['o.....o','.ooooo.']),mouthPose(['.ooooo.','..ooo..']),mouthPose(['.ooooo.','.opppo.','..ooo..'])];
  // A separate eyebrow stroke makes the listening character look curious.
  const browsGrid=grid();rect(browsGrid,11,12,3,1,'hair');rect(browsGrid,21,12,3,1,'hair');
  const brows=make(browsGrid,head,16,27,5);
  const phase=josh?1.9:.15,baseY=head.position.y;
  function update(t=0,energy=0,active=false,motion=1){
    const e=active?Math.max(0,Math.min(1,energy)):0;
    const blinkPhase=(t+phase)%5.3, blink=blinkPhase>.08&&blinkPhase<.22;
    eyes.visible=!blink;closedEyes.visible=blink;
    const pose=e<.15?0:e<.53?1:2;mouths.forEach((m,i)=>m.visible=i===pose);
    head.position.y=baseY+Math.sin(t*1.65+phase)*1.7*motion+e*1.2*motion;
    head.rotation.z=(Math.sin(t*.82+phase)*.014+(active?(josh?-.009:.009):0))*motion;
    head.rotation.y=Math.sin(t*.49+phase)*.018*motion;
    brows.position.y=(active?e*cell*.08:Math.sin(t*.67+phase)*cell*.03)*motion;
    const gesture=active?Math.sin(t*1.9+phase)*.035+e*.05:Math.sin(t*.85+phase)*.013;
    leftArm.rotation.z=(.015+gesture)*motion;rightArm.rotation.z=(-.015-gesture*.85)*motion;
    body.position.y=Math.sin(t*1.65+phase)*.8*motion;
  }
  group.userData={kind,facing:josh?'right':'left',mirrored:!josh,columns:cols,rows,blockCount:pixelCount,construction:'hand-authored connected pixel character',bitmapTextures:0};
  update(0,0,false);
  return {group,update,pixelCount,dispose(){geometry.dispose();material.dispose();allMeshes.forEach(m=>m.dispose())}};
}
