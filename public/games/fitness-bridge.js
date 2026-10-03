/* Trusted same-origin games share the host camera, pose, voice and session. */
window.fitness={
 state:{paused:false,difficulty:1}, listeners:new Set(),
 send(type,payload={}){try{parent?.postMessage({source:'fitness-game',type,...payload},'*');}catch(e){}},
 ready(){this.send('ready')}, score(value,accuracy){this.send('score',{value,accuracy})},
 complete(){this.send('complete')}, speak(text){if(!text)return;this.send('speak',{text});if(!parent||parent===window){try{if(window.speechSynthesis){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);window.speechSynthesis.speak(u);}}catch{}}},
 discomfort(message){this.send('discomfort',{message})},
 onMessage(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)},
 getCamera(){return parent?.fitnessHost?.getCamera?parent.fitnessHost.getCamera():navigator.mediaDevices?.getUserMedia({video:true})},
 pause(){this.send('pause')}, resume(){this.send('resume')}
};
addEventListener('message',e=>{
 if(!e.data||e.data.source!=='fitness-host')return;
 const m=e.data,f=window.fitness;
 if(m.type==='initialize')Object.assign(f.state,m);
 if(m.type==='pause'||m.type==='stop'){f.state.paused=true;f.movement=null;}
 if(m.type==='resume')f.state.paused=false;
 if(m.type==='difficulty')f.state.difficulty=m.level;
 if(m.type==='movement'&&!f.state.paused){f.movement=m;f.movementAt=performance.now()}
 f.listeners.forEach(fn=>{try{fn(m);}catch(err){console.warn('Error in fitness listener:',err);}});
});
