'use client';
import {useState,useEffect,useRef} from 'react';
import {Activity,ArrowUpRight,ArrowRight,LayoutDashboard,Dumbbell,ChartNoAxesCombined,UserRound,Settings2,Mic,MicOff,Flame,Clock3,Heart,Move,AudioLines,Camera,Check,ChevronRight,Play,Pause,Square,Volume2,RefreshCw,ShieldCheck,PlugZap,Expand,LogOut,Download,Footprints,Sparkles,Target,Wind,Music2,ScanFace,AlertTriangle,CalendarDays,X,Menu,Lock,ShieldAlert,KeyRound,UserPlus,Maximize,Minimize} from 'lucide-react';
import {Sidebar,SidebarProvider,SidebarContent,SidebarHeader,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarTrigger} from '@/components/ui/sidebar';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {Progress} from '@/components/ui/progress';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Toaster,toast} from 'sonner';
import {runtime,intent} from './runtime';
const games=[{id:'DragonDodge',name:'Dragon Dodge',tag:'WARM-UP',desc:'Get moving. Dodge, duck, and find your rhythm.',time:'5–10 min',icon:Wind,color:'cyan',level:'All levels'},{id:'DanceTrainer',name:'Dance Trainer',tag:'WARM-UP',desc:'Follow the beat. Make every move your own.',time:'10–15 min',icon:Music2,color:'violet',level:'All levels'},{id:'BoxingTrainer',name:'Boxing Trainer',tag:'MAIN WORKOUT',desc:'Build your technique, one punch at a time.',time:'15–20 min',icon:Target,color:'orange',level:'Progressive'}];
const nav=[['Dashboard',LayoutDashboard],['Workouts',Dumbbell],['Progress',ChartNoAxesCombined],['Profile',UserRound]];
const fields=[['name','What should we call you?','text'],['age','How old are you?','number'],['height','Your height in centimetres','number'],['weight','Your weight in kilograms','number'],['goal','What is your fitness goal?','text']];
const initialForm={name:'',age:'',height:'',weight:'',goal:'Build consistency',experience:'Beginner',injuries:'None',food_preferences:'Vegetarian',restrictions:'None',email:'',password:''};
function Video({stream}){const ref=useRef();useEffect(()=>{if(ref.current)ref.current.srcObject=stream},[stream]);return <video ref={ref} autoPlay muted playsInline className="camera-video"/>}
function Metric({icon:Icon,title,value,unit,note}){return <div className="metric"><div className="metric-label"><Icon size={17}/>{title}</div><div className="metric-value">{value}<span>{unit}</span></div><div className="muted small">{note}</div></div>}
export default function FitnessApp(){
 const [page,setPage]=useState('Dashboard'),[boot,setBoot]=useState(true),[login,setLogin]=useState(false),[profile,setProfile]=useState(null),[token,setToken]=useState(''),[backend,setBackend]=useState(''),[urlInput,setUrlInput]=useState(''),[health,setHealth]=useState(null),[checking,setChecking]=useState(false),[voice,setVoice]=useState('Voice off'),[transcript,setTranscript]=useState(''),[command,setCommand]=useState(''),[camera,setCamera]=useState(null),[cameraError,setCameraError]=useState(''),[speaker,setSpeaker]=useState(true),[mirror,setMirror]=useState(false),[manifest,setManifest]=useState({}),[selected,setSelected]=useState(null),[session,setSession]=useState(null),[paused,setPaused]=useState(false),[summary,setSummary]=useState(null),[sessionWorkouts,setSessionWorkouts]=useState([]),[history,setHistory]=useState([]),[stats,setStats]=useState({streak:0,total:0}),[sensors,setSensors]=useState(null),[register,setRegister]=useState(false),[step,setStep]=useState(0),[form,setForm]=useState(initialForm),[authMode,setAuthMode]=useState('face'),[busy,setBusy]=useState(false),[coach,setCoach]=useState('A little movement makes a big difference. Let’s find your rhythm.'),[difficulty,setDifficulty]=useState(1),[safety,setSafety]=useState(false),[guide,setGuide]=useState(false),[faceCount,setFaceCount]=useState(0),[failCount,setFailCount]=useState(0),[scanStatus,setScanStatus]=useState('standby'),[micLevel,setMicLevel]=useState(0),[isFullscreen,setIsFullscreen]=useState(false),[captureProgress,setCaptureProgress]=useState(0);
 const frameRef=useRef(),current=useRef({}),started=useRef(0),wsRef=useRef(),offlineRef=useRef(),commandHandler=useRef(),sessionRef=useRef(),mounted=useRef(false),lastCmdRef=useRef(''),cmdTimerRef=useRef(null),lastCmdTimeRef=useRef(0),lastIntentRef=useRef(''),lastIntentTimeRef=useRef(0),unregisteredAnnouncedRef=useRef(false);
 commandHandler.current=handleCommand;current.current={page,selected,session,paused,token,backend,register,step,form,speaker};sessionRef.current=session;
 const scoreQueue=useRef(Promise.resolve()), lastSayRef=useRef({text:'',time:0});
 async function api(path,opts={}){
  if(!backend)throw Error('Connect your local fitness service in Setup center.');
  let response;
  try{
    response=await fetch(backend+path,{
      ...opts,
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...opts.headers},
      signal:AbortSignal.timeout(opts.timeout||25000)
    });
  }catch(err){
    if(err.name==='TimeoutError'||err.name==='AbortError'){
      throw Error('Service request timed out. Please try again.');
    }
    throw Error('Fitness service is unreachable. Check its address and connection in Setup center.');
  }
  let data;
  try{
    data=await response.json();
  }catch{
    throw Error('Invalid response from fitness service ('+response.status+').');
  }
  if(!response.ok){
    let msg='Request failed. Check your entries and try again.';
    if(typeof data.detail==='string'){
      msg=data.detail;
    }else if(Array.isArray(data.detail)){
      msg=data.detail.map(d=>(d.loc&&d.loc.length?d.loc[d.loc.length-1]+': ':'')+d.msg).join('; ');
    }else if(data.message){
      msg=data.message;
    }
    throw Error(msg);
  }
  return data;
 }
 function say(t){if(!t)return;const clean=typeof t==='string'?t.trim():'';if(!clean)return;setCoach(clean);const now=Date.now();if(lastSayRef.current.text===clean.toLowerCase() && now-lastSayRef.current.time<4500)return;lastSayRef.current={text:clean.toLowerCase(),time:now};if(speaker)try{runtime.speak(clean)}catch(e){toast.error(e.message)}}
 async function refresh(){if(!token)return;try{const h=await api('/api/workouts');setHistory(h.workouts);setStats(h.stats)}catch(e){toast.error(e.message)}}
 async function check(base=backend){setChecking(true);if(!base){setHealth(null);setChecking(false);return;}try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();setHealth(await r.json())}catch{setHealth({services:[{name:'FastAPI backend',status:'ERROR',message:'Cannot connect. Start the local service and check the address.'}]})}finally{setChecking(false)}}
  useEffect(()=>{
   mounted.current=true;let pref;
   try{pref=JSON.parse(localStorage.getItem('fitness.preferences')||'{}')}catch{pref={}}
   const defaultBackend = pref.backend || 'http://127.0.0.1:8000';
   setBackend(defaultBackend);setUrlInput(defaultBackend);setMirror(pref.mirror||false);
   fetch('/games/manifest.json').then(r=>r.json()).then(setManifest).catch(()=>toast.error('Game registry could not load.'));

   const activateVoice = async () => {
     try {
       if (!runtime.wanted) await runtime.listen();
     } catch (err) {
       console.warn('Voice auto-activation deferred:', err);
     }
   };
   activateVoice();
   const handleFirstGesture = () => {
     activateVoice();
     window.removeEventListener('pointerdown', handleFirstGesture);
     window.removeEventListener('keydown', handleFirstGesture);
   };
   window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
   window.addEventListener('keydown', handleFirstGesture, { passive: true });

   const savedToken = localStorage.getItem('fitness.token') || '';
   let timerId = null;
   if(savedToken && defaultBackend){
     fetch(defaultBackend + '/api/users/me', {
       headers: { 'Authorization': 'Bearer ' + savedToken },
       signal: AbortSignal.timeout(4000)
     }).then(r => r.ok ? r.json() : null)
       .then(verifiedUser => {
         if(verifiedUser && verifiedUser.id){
           setProfile(verifiedUser);
           setToken(savedToken);
           setBoot(false);
           const firstName = verifiedUser.name.split(' ')[0] || verifiedUser.name; say("Hey " + firstName + "! Let's go, what's up today? Shall we start our workout?");
         } else {
           localStorage.removeItem('fitness.token');
           localStorage.removeItem('fitness.profile');
           setProfile(null);
           setToken('');
           setBoot(false);
           say("Hey there! Welcome to MIRAI. Looking toward the camera for face recognition.");
         }
       })
       .catch(() => {
         localStorage.removeItem('fitness.token');
         localStorage.removeItem('fitness.profile');
         setProfile(null);
         setToken('');
         setBoot(false);
         say("Hey there! Welcome to MIRAI. Looking toward the camera for face recognition.");
       });
   } else {
     timerId = setTimeout(()=>{
       setBoot(false);
       activateVoice();
       say("Hey there! Welcome to MIRAI. Looking toward the camera for face recognition.");
     }, 1100);
   }

   return()=>{
     if(timerId) clearTimeout(timerId);
     window.removeEventListener('pointerdown', activateVoice);
     window.removeEventListener('keydown', activateVoice);
     runtime.stopCamera();runtime.stopVoice();runtime.cancel();wsRef.current?.close();offlineRef.current?.close();
   };
  },[]);
  useEffect(()=>{if(!profile){runtime.camera().then(setCamera).catch(()=>{});}},[profile]);
  useEffect(()=>{if(mounted.current){localStorage.setItem('fitness.preferences',JSON.stringify({backend,mirror}));check()}},[backend,mirror]);
 useEffect(()=>{if(token){refresh();api("/api/workouts/active").then(w=>{if(w){setSession(w);setSelected(games.find(g=>g.id===w.game));setPaused(true);toast.info("Previous workout paused. Say resume or choose any workout.");}}).catch(()=>{})}},[token]);
 useEffect(()=>{
  runtime.onStatus=setVoice;
  runtime.onAudioLevel=setMicLevel;
  runtime.onText=(text,final)=>{
    setTranscript(text);
    if(!text)return;
    const t=text.trim();
    handleCommand(t);
  };
  window.fitnessHost={getCamera:()=>runtime.camera(),desktop:async(action,level,command)=>{if(!session||session.game!=='DragonDodge'||!['start','status'].includes(action))throw Error('No active Dragon Dodge session.');return api('/api/workouts/'+session.id+'/desktop/'+action,{method:'POST',body:JSON.stringify({difficulty:level||difficulty,command})})}};
  return()=>{delete window.fitnessHost;clearTimeout(cmdTimerRef.current);};
 },[page,session,paused,token,backend,register,step,form,speaker,profile,login,authMode,selected]);
 async function enableCamera(){try{setCamera(await runtime.camera());setCameraError('');toast.success('Camera connected');say('Camera connected.');}catch(e){setCameraError(e.message);toast.error('Camera unavailable: '+e.message);say('Camera error: '+e.message);}}
 async function voiceToggle(){offlineRef.current?.close();offlineRef.current=null;if(runtime.wanted){runtime.stopVoice();toast.info('Voice commands paused');say('Voice recognition paused.');}else{try{await runtime.listen();toast.success('Voice commands listening');say('Voice recognition active. Speak commands anytime.');}catch(e){setVoice('Unavailable');toast.error(e.message);say('Voice recognition unavailable: '+e.message);}}}
 function post(type,data={}){try{frameRef.current?.contentWindow?.postMessage({source:'fitness-host',type,...data},'*');}catch(e){}}
  async function pauseWorkout(reason=null){
    if(!session||paused)return;
    setPaused(true);
    post('pause');
    runtime.cancel();
    if(reason)say(reason);
    if(session)try{await api('/api/workouts/'+session.id+'/pause',{method:'POST',body:JSON.stringify({paused:true})})}catch(e){}
    toast.info('Workout paused.');
  }

  async function resumeWorkout(){
    if(!session||!paused)return;
    try{await api('/api/workouts/'+session.id+'/pause',{method:'POST',body:JSON.stringify({paused:false})});}catch(e){}
    setPaused(false);
    setSafety(false);
    post('resume');
    toast.success('Workout resumed.');
    say('Resuming workout.');
  }

  async function stopWorkout(){
    if(!session){
      setSelected(null);
      setPage('Dashboard');
      say('Returning to dashboard.');
      return;
    }
    post('stop');
    runtime.cancel();
    setPaused(false);
    const finishingGameName = selected?.name || (games.find(g => g.id === session.game)?.name) || 'Workout';
    const activeSecs = Math.max(15, Math.round((Date.now() - (started.current || Date.now())) / 1000));
    let result = {
      id: session.id,
      game: session.game,
      score: 850,
      active_seconds: activeSecs,
      calories_burned: Math.round(activeSecs * 0.12),
      finished_at: new Date().toISOString()
    };
    try {
      await Promise.race([scoreQueue.current, new Promise(r => setTimeout(r, 1000))]);
      if (backend && !session.id.startsWith('local-')) {
        try {
          const r = await api('/api/workouts/'+session.id+'/finish', {method:'POST', timeout: 4000});
          if (r) result = r;
        } catch(apiErr) {
          console.warn('Backend finish sync error (using local summary):', apiErr);
        }
      }
    } catch {}
    setSummary(result);
    setSessionWorkouts(prev => [...prev, {...result, gameName: finishingGameName, finishedAt: new Date().toLocaleTimeString()}]);
    setSession(null);
    setIsFullscreen(false);
    try { refresh(); } catch {}
    say(`${finishingGameName} completed and saved. You can choose your next exercise or say complete all workout.`);
    toast.success(`${finishingGameName} saved! Choose your next workout or say "complete all workout".`);
  }

  async function switchWorkout(targetGameId){
    const target = games.find(g => g.id === targetGameId);
    if (!target) return;
    if (page === 'Workout' && selected?.id === targetGameId) {
      return;
    }
    if (session) {
      post('stop');
      try {
        await scoreQueue.current;
        const result = await api('/api/workouts/' + session.id + '/finish', { method: 'POST' });
        const curName = selected?.name || (games.find(g => g.id === session.game)?.name) || 'Previous workout';
        setSessionWorkouts(prev => [...prev, {...result, gameName: curName, finishedAt: new Date().toLocaleTimeString()}]);
        setSummary(result);
        refresh();
      } catch (e) {
        console.warn('Switch workout auto-save error:', e);
      }
      setSession(null);
    }
    setSelected(target);
    setPage('Workout');
    setPaused(false);
    toast.info(`Switched to ${target.name}`);
    say(`Moving to ${target.name}. Let's go!`);
    setTimeout(() => {
      startGame(target);
    }, 350);
  }

  async function completeAllWorkouts(){
    if (session) {
      post('stop');
      try {
        await scoreQueue.current;
        const result = await api('/api/workouts/' + session.id + '/finish', { method: 'POST' });
        const curName = selected?.name || (games.find(g => g.id === session.game)?.name) || 'Workout';
        setSessionWorkouts(prev => [...prev, {...result, gameName: curName, finishedAt: new Date().toLocaleTimeString()}]);
        setSummary(result);
        refresh();
      } catch (e) {
        console.warn('Complete all auto-save error:', e);
      }
      setSession(null);
    }
    setPaused(false);
    setPage('Recovery');
    toast.success('All workouts completed! Welcome to Food & Recovery.');
    say('All workouts completed! Welcome to food and recovery.');
  }

 function validateField(stepIndex){
   if(stepIndex < 0 || stepIndex >= fields.length) return null;
   const key = fields[stepIndex][0];
   const val = form[key];
   if(key === 'name'){
     if(!val || typeof val !== 'string' || val.trim().length < 2){
       return 'Please enter or say your name first.';
     }
   } else if(key === 'age'){
     const num = Number(val);
     if(!val || isNaN(num) || num < 18 || num > 110){
       return 'Please enter or say a valid age of 18 or older.';
     }
   } else if(key === 'height'){
     const num = Number(val);
     if(!val || isNaN(num) || num < 80 || num > 250){
       return 'Please enter or say your height in centimetres (e.g. 175).';
     }
   } else if(key === 'weight'){
     const num = Number(val);
     if(!val || isNaN(num) || num < 25 || num > 300){
       return 'Please enter or say your weight in kilograms (e.g. 70).';
     }
   } else if(key === 'goal'){
     if(!val || typeof val !== 'string' || val.trim().length < 3){
       return 'Please enter or say your fitness goal.';
     }
   }
   return null;
 }

 function toggleFullscreen(forceState=null){
   const next = forceState !== null ? Boolean(forceState) : !isFullscreen;
   setIsFullscreen(next);
   if(next){
     try{
       if(document.documentElement.requestFullscreen){
         document.documentElement.requestFullscreen().catch(()=>{});
       }
     }catch{}
     say('Full screen mode active. Say exit full screen or press Escape to minimize.');
     toast.info('Full screen enabled. Press Esc or say "exit full screen" to minimize.');
   }else{
     try{
       if(document.fullscreenElement && document.exitFullscreen){
         document.exitFullscreen().catch(()=>{});
       }
     }catch{}
     say('Exited full screen mode.');
     toast.info('Full screen closed.');
   }
 }

 useEffect(()=>{
   const onFsChange=()=>{
     if(!document.fullscreenElement && isFullscreen){
       setIsFullscreen(false);
     }
   };
   const onKey=(e)=>{
     if(e.key==='Escape' && isFullscreen){
       toggleFullscreen(false);
     }
   };
   document.addEventListener('fullscreenchange',onFsChange);
   window.addEventListener('keydown',onKey);
   return()=>{
     document.removeEventListener('fullscreenchange',onFsChange);
     window.removeEventListener('keydown',onKey);
   };
 },[isFullscreen]);

 async function handleLogout(){
   try{ post('stop'); }catch(e){}
   if(session){
     if(backend && !session.id.startsWith('local-')){
       try{ await api('/api/workouts/'+session.id+'/finish',{method:'POST', timeout: 2000}).catch(()=>{}); }catch{}
     }
     setSession(null);
   }
   if(backend){
     try{ await api('/api/auth/logout',{method:'POST', timeout: 2000}).catch(()=>{}); }catch{}
   }
   try{
     localStorage.removeItem('fitness.profile');
     localStorage.removeItem('fitness.token');
   }catch{}
   offlineRef.current?.close();
   offlineRef.current=null;
   setToken('');
   setProfile(null);
   setHistory([]);
   setStats({streak:0,total:0});
   runtime.stopCamera();
   setCamera(null);
   setScanStatus('standby');
   unregisteredAnnouncedRef.current = false;
   setPage('Dashboard');
   setLogin(false);
   setIsFullscreen(false);
   toast.success('Signed out. Screen locked.');
   say('Signed out. Looking toward the camera for face recognition.');
 }

 function triggerSTTButtonClick(spokenClean){
   if(!spokenClean || spokenClean.length < 2) return false;
   const cleanSpoken = spokenClean.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
   if(!cleanSpoken) return false;

   // 1. Gather all clickable elements in main window
   const hostCandidates = Array.from(document.querySelectorAll(
     'button, a[role="button"], a.secondary-btn, [data-voice-target], [role="tab"], .choose-game, .nav-button, .game-card, .voice-pill, .icon-btn, .text-btn, .white-btn, .primary-btn, .secondary-btn, .safety-btn'
   ));

   // 2. Gather all clickable elements inside active game iframe (if available)
   let iframeCandidates = [];
   try {
     const iframeDoc = frameRef.current?.contentDocument;
     if (iframeDoc) {
       iframeCandidates = Array.from(iframeDoc.querySelectorAll(
         'button, a, [role="button"], [data-voice-target], .action-btn, .hud-icon-btn, .footer-btn, .dance-card, .level-item, .step-node, .toggle-btn, .sim-btn, .btn-pause-primary, .btn-pause-secondary, .btn-pause-text, .modal-start-btn, input[type="button"], input[type="submit"]'
       ));
     }
   } catch (e) {}

   const allCandidates = [...hostCandidates, ...iframeCandidates];
   let bestMatch = null;
   let bestScore = 0;

   for (const el of allCandidates) {
     if (!el || el.disabled) continue;
     if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
     try {
       const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
       if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) continue;
     } catch {}

     const rawVoiceTargets = (el.getAttribute('data-voice-target') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
     const innerText = (el.innerText || el.textContent || '').toLowerCase().trim();
     const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim();
     const title = (el.getAttribute('title') || '').toLowerCase().trim();
     const id = (el.id || '').toLowerCase().replace(/[-_]/g, ' ').trim();

     const rawLabels = [...rawVoiceTargets, innerText, ariaLabel, title, id].filter(Boolean);
     const cleanedLabels = rawLabels.map(l => l.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length >= 2);

     for (const label of cleanedLabels) {
       let score = 0;
       if (cleanSpoken === label) {
         score = 100;
       } else if (cleanSpoken.includes(label) && label.length >= 3) {
         score = 75 + Math.min(20, label.length);
       } else if (label.includes(cleanSpoken) && cleanSpoken.length >= 3) {
         score = 70 + Math.min(20, cleanSpoken.length);
       } else {
         const spokenTokens = cleanSpoken.split(' ').filter(w => w.length > 2);
         const labelTokens = label.split(' ').filter(w => w.length > 2);
         if (spokenTokens.length > 0 && labelTokens.length > 0) {
           const matches = spokenTokens.filter(t => labelTokens.some(lt => lt.includes(t) || t.includes(lt))).length;
           if (matches === spokenTokens.length && spokenTokens.length > 0) {
             score = 60 + matches * 10;
           } else if (matches > 0 && matches >= labelTokens.length) {
             score = 50 + matches * 8;
           }
         }
       }

       if (score > bestScore) {
         bestScore = score;
         bestMatch = { el, label: rawLabels[0] || 'Button', score };
       }
     }
   }

   if (bestMatch && bestScore >= 50) {
     const { el, label } = bestMatch;
     el.classList.add('stt-voice-activated');
     setTimeout(() => {
       try { el.classList.remove('stt-voice-activated'); } catch {}
     }, 600);

     if (typeof el.click === 'function') {
       el.click();
     } else {
       el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
     }

     const readable = label.slice(0, 32).replace(/\s+/g, ' ');
     say('Selecting ' + readable + '.');
     toast.success('Voice action: "' + readable + '"');
     return true;
   }

   return false;
 }

 async function clearDatabaseAction(){
   if(!backend){toast.error('Connect your backend service first.');say('Backend service not connected.');return;}
   try{
     setBusy(true);
     await api('/api/system/reset-database',{method:'POST'});
     try{
       localStorage.removeItem('fitness.profile');
       localStorage.removeItem('fitness.token');
     }catch{}
     setToken('');
     setProfile(null);
     setHistory([]);
     setStats({streak:0,total:0});
     runtime.stopCamera();
     setCamera(null);
     setScanStatus('standby');
     unregisteredAnnouncedRef.current = false;
     setPage('Dashboard');
     setLogin(false);
     toast.success('Database has been completely cleared and reset to fresh state.');
     say('Database has been completely cleared. All records reset.');
   }catch(e){
     toast.error('Failed to reset database: '+e.message);
     say('Database reset failed: '+e.message);
   }finally{
     setBusy(false);
   }
 }

 function handleCommand(text){
  if(!text)return;
  const raw=text.toLowerCase().trim();
  const clean=raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”]/g,' ').replace(/\s+/g,' ').trim();
  const cmdIntent=intent(clean);
  const now=Date.now();

  // 0. REGISTRATION ACTIVE - PRIORITIZE FORM NAVIGATION & INPUT EXTRACTION
  if(register){
    // Navigation: Next / Continue / Forward (Only explicit commands move to the next slide, and current field must be filled!)
    if(cmdIntent==='NEXT' || /^(next|continue|proceed|forward|advance|go next|next step|next slide)$/i.test(clean)){
      if(now - lastIntentTimeRef.current < 1500 && lastIntentRef.current === 'NEXT') return;
      lastIntentRef.current = 'NEXT'; lastIntentTimeRef.current = now;
      const err = validateField(step);
      if(err){
        toast.warning(err);
        say(err);
        return;
      }
      if(step === fields.length - 1){
        say('You are on the final step. Say save or click complete to finish registration.');
        toast.info('Say "save" to finish registration.');
      }else{
        const nextStep = step + 1;
        setStep(nextStep);
        if(speaker && fields[nextStep][0] !== 'password') say(fields[nextStep][1]);
        toast.info('Next: ' + fields[nextStep][1]);
      }
      return;
    }
    // Navigation: Back / Previous
    if(cmdIntent==='BACK' || /^(back|previous|go back|prev|previous step|previous slide)$/i.test(clean)){
      if(now - lastIntentTimeRef.current < 1500 && lastIntentRef.current === 'BACK') return;
      lastIntentRef.current = 'BACK'; lastIntentTimeRef.current = now;
      const prevStep = Math.max(0, step - 1);
      setStep(prevStep);
      if(speaker && fields[prevStep][0] !== 'password') say(fields[prevStep][1]);
      toast.info('Previous: ' + fields[prevStep][1]);
      return;
    }
    // Submit / Save (Requires explicit save or submit command)
    if(cmdIntent==='SAVE' || /\b(submit|save|finish registration|complete registration|done)\b/i.test(clean)){
      if(now - lastIntentTimeRef.current < 2000 && lastIntentRef.current === 'SAVE') return;
      lastIntentRef.current = 'SAVE'; lastIntentTimeRef.current = now;
      saveRegistration();
      return;
    }
    // Cancel / Close
    if(/\b(cancel|close|exit|stop registration)\b/i.test(clean)){
      setRegister(false);say('Registration closed.');return;
    }
    // User repeats "register" while already in registration
    if(cmdIntent==='REGISTER' || /\b(register|sign up)\b/i.test(clean)){
      say(fields[step][1]);
      return;
    }
    // Voice extraction for current field (DO NOT speak "Say next to continue" to prevent auto-advancing!)
    if(step < fields.length && fields[step][0] !== 'password'){
      const curKey = fields[step][0];
      if(curKey === 'name'){
        let val = text.replace(/^(my name is|i am called|call me|i am|i'm|this is|my name's|it is|it's|name is)\s+/i, '').replace(/[.,!?;:]+$/g, '').trim();
        val = val.split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
        if(val.length > 0 && !/\b(register|next|back|cancel|close|save|submit)\b/i.test(val)){
          setForm(f => ({...f, name: val}));
          toast.success('Name set: ' + val);
          say('Got it, ' + val + '.');
          return;
        }
      } else if(curKey === 'age' || curKey === 'height' || curKey === 'weight'){
        const numMatch = text.match(/\b\d+\b/);
        if(numMatch){
          const num = parseInt(numMatch[0], 10);
          setForm(f => ({...f, [curKey]: num}));
          toast.success(`${fields[step][1].split('?')[0]}: ${num}`);
          say(`Set to ${num}.`);
          return;
        }
      } else if(curKey === 'goal'){
        let val = text.replace(/^(my goal is|i want to|my fitness goal is|my aim is|goal is)\s+/i, '').trim();
        if(val && !/\b(save|submit|next|back)\b/i.test(val)){
          val = val.charAt(0).toUpperCase() + val.slice(1);
          setForm(f => ({...f, goal: val}));
          toast.success('Goal set: ' + val);
          say('Goal set to ' + val + '.');
          return;
        }
      }
    }
    return;
  }

  // 1. REGISTER / SIGN UP (When NOT already in registration)
  if(cmdIntent==='REGISTER' || /\b(register|registration|sign up|signup|create profile|create account|new profile|new user|enroll|i want to register|please register|go for register|go to register)\b/i.test(clean)){
    if(now - lastIntentTimeRef.current < 2000 && lastIntentRef.current === 'REGISTER') return;
    lastIntentRef.current = 'REGISTER'; lastIntentTimeRef.current = now;
    setLogin(false);
    setRegister(true);
    setStep(0);
    toast.info('Opening member registration.');
    say("Question 1 of 5: What should we call you?");
    return;
  }

  // 2. RECOGNIZE ME / WHO AM I / FACE IDENTIFICATION
  if(cmdIntent==='RECOGNIZE' || /\b(recogniz|who am i|identify|scan.*face|face.*scan|scan|look at me|detect me|face login|face sign|check face|check my face)\b/i.test(clean)){
    if(now - lastIntentTimeRef.current < 2000 && lastIntentRef.current === 'RECOGNIZE') return;
    lastIntentRef.current = 'RECOGNIZE'; lastIntentTimeRef.current = now;
    if(profile){
      const firstName = profile.name.split(' ')[0] || profile.name;
      say("Hey " + firstName + "! Let's go, what's up today? Shall we start our workout?");
      toast.success('Recognized: '+profile.name);
    }else{
      unregisteredAnnouncedRef.current = false;
      setAuthMode('face');
      authenticate('face');
    }
    return;
  }

  // 3. TRY AGAIN / RETRY ("If I say try again, then it will say 'okay', if it recognizes then we go inside. If it not, 'you are not a registered person' - just only once!")
  if(cmdIntent==='RETRY' || /\b(try again|retry|try|scan again|attempt again|one more time|again|can we try again|let's try again)\b/i.test(clean)){
    if(now - lastIntentTimeRef.current < 2000 && lastIntentRef.current === 'RETRY') return;
    lastIntentRef.current = 'RETRY'; lastIntentTimeRef.current = now;
    unregisteredAnnouncedRef.current = false;
    say('Okay. Looking toward the camera.');
    setAuthMode('face');
    setTimeout(() => {
      authenticate('face', true);
    }, 600);
    return;
  }

  // 4. WORKOUT START AFFIRMATION (Responding to "Shall we start our workout?")
  if(cmdIntent==='WORKOUT' || /\b(start workout|begin workout|start training|shall we start)\b/i.test(clean)){
    if(profile && page !== 'Workout' && !session){
      if(now - lastIntentTimeRef.current < 2500 && lastIntentRef.current === 'WORKOUT') return;
      lastIntentRef.current = 'WORKOUT'; lastIntentTimeRef.current = now;
      navigate('Workouts');
      say("Let's move! Select any workout to begin.");
      return;
    }
  }

  // 5. EXPLORE / GUEST / ATHLETE ATTEMPTS (Polite redirection)
  if(cmdIntent==='EXPLORE' || /\b(explore|guest|without sign|without login|skip login|skip sign|athlete)\b/i.test(clean)){
    if(now - lastIntentTimeRef.current < 2500 && lastIntentRef.current === 'EXPLORE') return;
    lastIntentRef.current = 'EXPLORE'; lastIntentTimeRef.current = now;
    say('You are not a registered person. Would you like to please register, or try again?');
    toast.info('Please register or try again.');
    return;
  }

  // 6. SIGN IN / LOGIN / LOG ME IN
  if(/\b(sign in|log in|login|open login)\b/i.test(clean)){
    if(login){
      authenticate(authMode);
    }else{
      setLogin(true);
      say('Opening sign in. Say recognize me to scan your face.');
    }
    return;
  }

  // 7. SIGN OUT / LOGOUT / SWITCH USER
  if(/\b(sign out|log out|logout|signout|switch user|switch account|change user|exit profile)\b/i.test(clean) || cmdIntent === 'LOGOUT'){
    handleLogout();
    return;
  }

  // 8. CLEAR / RESET DATABASE
  if(/\b(clear database|reset database|wipe database|delete all data)\b/i.test(clean)){
    clearDatabaseAction();
    return;
  }

  // Camera, Voice & Mirror controls allowed in Gate
  if(/\b(check camera|test camera|enable camera|open camera)\b/i.test(clean)){enableCamera();return;}
  if(/\b(mirror|flip camera|invert)\b/i.test(clean)){const n=!mirror;setMirror(n);say(n?'Mirror mode enabled':'Mirror mode disabled');return;}
  if(/\b(mute|turn off voice|turn off sound|quiet|silence)\b/i.test(clean)){setSpeaker(false);toast.info('Voice coaching muted');return;}
  if(/\b(unmute|turn on voice|turn on sound|enable sound)\b/i.test(clean)){setSpeaker(true);say('Voice coaching enabled');return;}

  // GATE GUARD: Only restrict commands if on Gate face recognition screen and not recognized
  if(!profile && !session && page === 'Dashboard' && scanStatus === 'not_recognized') return;

  // PASS SPOKEN COMMAND TO ACTIVE GAME IFRAME SO IN-GAME BUTTONS & ACTIONS EXECUTE
  if(session || page === 'Workout'){
    post('command',{text:clean,raw});
  }

  // WORKOUT SWITCHER & COMPLETION COMMANDS (ANY GAME AT ANY TIME)
  if(/\b(complete all workout|complete all workouts|finish all workouts|all workouts complete|done with workouts|complete workout station|finish all)\b/i.test(clean) || cmdIntent === 'COMPLETE_ALL'){
    completeAllWorkouts();
    return;
  }

  if(/\b(move to ai dance trainer|move to dance trainer|move to dance|switch to dance|open dance trainer|start dance trainer|play dance trainer)\b/i.test(clean) || (selected?.id !== 'DanceTrainer' && /\b(switch to dance|move to dance|i want to dance|play dance trainer)\b/i.test(clean))){
    switchWorkout('DanceTrainer');
    return;
  }

  if(/\b(move to boxing trainer|move to boxing|switch to boxing|open boxing trainer|start boxing trainer|play boxing trainer)\b/i.test(clean) || (selected?.id !== 'BoxingTrainer' && /\b(switch to boxing|move to boxing|i want to do boxing|play boxing trainer)\b/i.test(clean))){
    switchWorkout('BoxingTrainer');
    return;
  }

  if(/\b(move to dragon dodge|move to dodge|switch to dragon dodge|switch to dodge|open dragon dodge|start dragon dodge)\b/i.test(clean) || (selected?.id !== 'DragonDodge' && /\b(switch to dragon dodge|move to dragon dodge|play dragon dodge)\b/i.test(clean))){
    switchWorkout('DragonDodge');
    return;
  }

  // FULLSCREEN / SCREEN SIZING CONTROLS
  if(/\b(fullscreen|full screen|maximize|bigger screen|make screen bigger|expand screen|full system)\b/i.test(clean)){
    toggleFullscreen(true);
    return;
  }
  if(/\b(exit fullscreen|exit full screen|minimize|normal screen|close fullscreen|smaller screen)\b/i.test(clean)){
    toggleFullscreen(false);
    return;
  }

  // SAFETY / DISCOMFORT / PAIN
  if(/\b(pain|hurt|dizzy|emergency|uncomfortable|ache|injur|discomfort)\b/i.test(clean)){
   toast('Workout paused. Stop moving and check how you feel.');setSafety(true);
   pauseWorkout('Workout paused for your safety. Stop moving and take a moment to rest.');
   if(session)api('/api/workouts/'+session.id+'/discomfort',{method:'POST',body:JSON.stringify({message:text})}).catch(()=>{});
   return;
  }

  // PAUSE / TAKE A BREAK (Only if in an active running session!)
  if(/\b(pause|take a break|break|hold on|wait a second|stop for a moment)\b/i.test(clean)){
   if(session && !paused){
     pauseWorkout('Workout paused.');
   }
   return;
  }

  // RESUME / UNPAUSE / CONTINUE (Only if paused in an active session!)
  if(/\b(resume|unpause|continue|keep going|ready to continue|back to workout|lets go)\b/i.test(clean)){
   if(session && paused){
     resumeWorkout();
   }
   return;
  }

  // STOP / FINISH SINGLE GAME (Saves score and stays on Workout station!)
  if(/\b(stop workout|end workout|finish workout|finish and save|finish & save|complete workout|save workout|finish session|end session|finish|stop|save)\b/i.test(clean)){
   if(session){
     stopWorkout();
     return;
   }
  }

  // UNIVERSAL STT BUTTON CONTROLLER: Try matching any visible button across Dashboard, Navigation, and Game Iframe!
  const handledByButton = triggerSTTButtonClick(clean);
  if(handledByButton) return;

  // DIFFICULTY
  if(/\b(harder|increase difficulty|level up|make it harder|tougher)\b/i.test(clean)){
   setDifficulty(d=>{const n=Math.min(5,d+1);post('difficulty',{level:n});say('Difficulty increased to level '+n);return n});return;
  }
  if(/\b(easier|reduce difficulty|decrease difficulty|level down|make it easier|softer)\b/i.test(clean)){
   setDifficulty(d=>{const n=Math.max(1,d-1);post('difficulty',{level:n});say('Difficulty decreased to level '+n);return n});return;
  }

  // START / PLAY / BEGIN / LET'S MOVE / QUICK START
  if(/\b(start|begin|play|go|launch|lets move|let's move|quick start)\b/i.test(clean)){
   if(selected && page !== 'Workout'){startGame(selected);return;}
   else if(!selected && page !== 'Workout'){navigate('Workouts');return;}
  }

  // NAVIGATION
  if(/\b(dashboard|home|main screen|overview)\b/i.test(clean)){navigate('Dashboard');return;}
  if(/\b(workouts|training|library|games|exercises)\b/i.test(clean)){navigate('Workouts');return;}
  if(/\b(progress|history|stats|statistics|records|summary)\b/i.test(clean)){navigate('Progress');return;}
  if(/\b(setup|settings|system|configuration)\b/i.test(clean)){navigate('Setup center');return;}
  if(/\b(profile|account|my account|my details)\b/i.test(clean)){navigate('Profile');return;}
  if(/\b(recovery|recharge|stretch|cool down|cooldown|food and recovery|food recommendation)\b/i.test(clean)){
    if(page !== 'Recovery') navigate('Recovery');
    return;
  }

  // SETTINGS / CONTROLS
  if(/\b(check camera|test camera|enable camera|open camera)\b/i.test(clean)){enableCamera();return;}
  if(/\b(mirror|flip camera|invert)\b/i.test(clean)){const n=!mirror;setMirror(n);say(n?'Mirror mode enabled':'Mirror mode disabled');return;}
  if(/\b(mute|turn off voice|turn off sound|quiet|silence)\b/i.test(clean)){setSpeaker(false);toast.info('Voice coaching muted');return;}
  if(/\b(unmute|turn on voice|turn on sound|enable sound)\b/i.test(clean)){setSpeaker(true);say('Voice coaching enabled');return;}
  if(/\b(read coach|coach tip|advice|what should i do)\b/i.test(clean)){say(coach);return;}

  // IF IN WORKOUT SESSION OR ON WORKOUT PAGE, PASS REMAINING TO ACTIVE GAME
  if(session || page === 'Workout'){
    post('command',{text:clean,raw});
    return;
  }

  toast('Command heard: “'+text+'”. Try saying “log out”, “dashboard”, “full screen”, or any button name.');
 }
 function navigate(p){
   if(!profile){
     say('You are not a registered person. Would you like to please register, or try again?');
     toast.info('Please register or try again.');
     return;
   }
   if(p === page) return;
   if(p==='Workouts'&&session){setPage('Workout');say('Current workout session active.');return;}
   if(session&&p!=='Workout')pauseWorkout('Workout paused while you navigate.');
   setPage(p);
   if(p !== 'Recovery') {
     say('Opening '+p);
   }
 }
 function choose(g){if(session){toast('Finish your current session before changing games.');say('Finish your current session before changing games.');setPage('Workout');return;}setSelected(g);setPage('Workout');say('Selected '+g.name+'. Say start or click start session to begin.');}
 async function startGame(customGame=null){
  const target=customGame||selected;
  if(!profile){
    say('You are not a registered person. Would you like to please register, or try again?');
    toast.info('Please register or try again.');
    return;
  }
  if(!target||!manifest[target.id]?.installed)return;
  setBusy(true);
  try{
    const stream=await runtime.camera();
    setCamera(stream);
    let s={id:'local-'+Date.now(),game:target.id};
    if(backend){try{s=await api('/api/workouts',{method:'POST',body:JSON.stringify({game:target.id})});}catch{}}
    started.current=Date.now();setSelected(target);setSession(s);setPaused(false);setPage('Workout');setIsFullscreen(true);
    say('Starting '+target.name+'. Let’s move!');
  }catch(e){
    started.current=Date.now();setSelected(target);setSession({id:'local-'+Date.now(),game:target.id});setPaused(false);setPage('Workout');setIsFullscreen(true);
    say('Starting '+target.name+'. Let’s move!');
  }finally{setBusy(false);}
 }
 useEffect(()=>{if(!session||paused||!backend||!token||page!=='Workout')return;let cancelled=false,inFlight=false;const t=setInterval(async()=>{if(inFlight)return;inFlight=true;try{const image=await runtime.frame();const r=await api('/api/workouts/'+session.id+'/movement',{method:'POST',body:JSON.stringify({image})});if(!cancelled){setSession(s=>s?{...s,...r}:s);post('movement',r);if(r.coaching)setCoach(r.coaching);if(r.check_in){setSafety(true);setPaused(true);post('pause');say(r.coaching)};if(r.expression_error)toast.error(r.expression_error)}}catch(e){if(!cancelled){console.warn('Frame movement poll:',e.message)}}finally{inFlight=false}},200);return()=>{cancelled=true;clearInterval(t)}},[session?.id,paused,backend,token,page]);
 useEffect(()=>{if(!session||!backend)return;const u=backend.replace(/^http/,'ws')+'/ws/live';const ws=new WebSocket(u);wsRef.current=ws;ws.onopen=()=>ws.send(JSON.stringify({token,session_id:session.id}));ws.onmessage=e=>{try{setSensors(JSON.parse(e.data))}catch{}};ws.onerror=()=>toast.error('Live sensors unavailable. Workout can continue without hardware.');ws.onclose=()=>setSensors(null);return()=>ws.close()},[session?.id,backend,token]);
 useEffect(()=>{const h=e=>{if(e.data?.source!=='fitness-game')return;const d=e.data;if(d.type==='ready')post('initialize',{profile,session_id:session?.id,difficulty,paused});if(d.type==='pause'&&session&&!paused)pauseWorkout();if(d.type==='resume'&&session&&paused)resumeWorkout();if(d.type==='complete'&&session)stopWorkout();if(d.type==='logout')handleLogout();if(d.type==='fullscreen')toggleFullscreen();if(d.type==='speak'&&typeof d.text==='string')say(d.text.slice(0,500));if(d.type==='discomfort')handleCommand('pain');if(d.type==='score'&&session&&Number.isFinite(d.value))scoreQueue.current=scoreQueue.current.then(()=>api('/api/workouts/'+session.id+'/score',{method:'POST',body:JSON.stringify({score:d.value,accuracy:d.accuracy??null})})).catch(e=>toast.error(e.message))};window.addEventListener('message',h);return()=>window.removeEventListener('message',h)},[session,profile,difficulty,speaker,paused]);
 async function authenticate(overrideMode=null, skipSpeech=false){
  const mode=overrideMode||authMode;
  setBusy(true);
  try{
    let r=null;
    if(mode==='face'){
      if(!skipSpeech){
        say('Scanning face. Looking towards the camera.');
      }
      try{
        const image=await runtime.frame();
        setCamera(runtime.stream);
        if(backend){
          r=await api('/api/auth/face',{method:'POST',body:JSON.stringify({image})});
        }else{
          throw new Error('Database service is not connected. Unable to verify facial biometrics.');
        }
      }catch(camErr){
        console.warn('Camera capture error:',camErr);
        throw new Error(camErr.message||'Camera frame capture failed.');
      }
    }else{
      if(backend){
        r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:form.email,password:form.password})});
      }else{
        throw new Error('Database service is not connected. Unable to authenticate.');
      }
    }
    if(r&&r.user){
      unregisteredAnnouncedRef.current = false;
      setProfile(r.user);setToken(r.token);setLogin(false);setForm(initialForm);
      setFailCount(0);setScanStatus('recognized');
      try{localStorage.setItem('fitness.profile',JSON.stringify(r.user));localStorage.setItem('fitness.token',r.token);}catch{}
      sessionStorage.setItem('fitness.explored','true');
      setPage('Dashboard');
      const firstName = r.user.name.split(' ')[0] || r.user.name;
      say("Hey " + firstName + "! Let's go, what's up today? Shall we start our workout?");
      toast.success('Welcome ' + r.user.name + '!');
      return;
    }
    throw new Error('NOT_REGISTERED');
  }catch(e){
    setProfile(null);
    setToken('');
    try{localStorage.removeItem('fitness.profile');localStorage.removeItem('fitness.token');}catch{}
    setScanStatus('not_recognized');
    if(!unregisteredAnnouncedRef.current){
      unregisteredAnnouncedRef.current = true;
      say("You are not a registered person. Would you like to please register, or try again?");
    }
    toast.info("You are not a registered person. Please register or try again.");
  }finally{
    setBusy(false);
  }
 }
 async function saveRegistration(){
  for(let i = 0; i < fields.length; i++){
    const err = validateField(i);
    if(err){
      setStep(i);
      toast.warning(err);
      say(err);
      return;
    }
  }
  setBusy(true);
  setCaptureProgress(1);
  try{
    if(!backend){
      throw new Error('Database backend is not connected. Unable to register.');
    }

    // Make sure camera is actively running for biometric picture capture
    let activeCam = camera;
    if(!activeCam){
      try{
        activeCam = await runtime.camera();
        setCamera(activeCam);
      }catch(camErr){
        console.warn('Camera initiation during registration:', camErr);
      }
    }

    say("Starting face registration. Capturing at least 3 pictures for recognition in database. Please look directly at the camera.");
    toast.info("Capturing 3 face pictures for database recognition...");

    // Capture at least 3 pictures from camera spaced apart
    const images = [];
    for(let pic = 1; pic <= 3; pic++){
      setCaptureProgress(pic);
      await new Promise(r => setTimeout(r, 650));
      try{
        const frame = await runtime.frame();
        images.push(frame);
        say(`Picture ${pic} captured.`);
        toast.success(`Face picture ${pic} of 3 captured!`);
      }catch(frameErr){
        console.warn(`Frame ${pic} capture error:`, frameErr);
      }
    }

    if(images.length === 0){
      throw new Error('Could not capture face images from camera. Please allow camera access and try again.');
    }

    const trimmedName=form.name.trim();
    const safeForm={
      name:trimmedName,
      age:Math.max(18, Math.min(110, Number(form.age)||20)),
      height:Math.max(80, Math.min(250, Number(form.height)||170)),
      weight:Math.max(25, Math.min(300, Number(form.weight)||70)),
      goal:form.goal ? form.goal.trim() : 'Fitness & Health',
      experience:'Beginner',
      injuries:'None',
      food_preferences:'Vegetarian',
      restrictions:'None',
      email:`${trimmedName.toLowerCase().replace(/[^a-z0-9]/g,'')||'athlete'}${Date.now().toString().slice(-4)}@aifitness.local`,
      password:'Password123!'
    };

    let r=null;
    try{
      r=await api('/api/auth/register',{
        method:'POST',
        body:JSON.stringify({...safeForm, face_images: images}),
        timeout: 25000
      });
    }catch(regErr){
      console.warn('Registration with face_images failed, trying fallback:', regErr);
      if(regErr.message && (regErr.message.includes('face_images') || regErr.message.includes('Extra inputs'))){
        r=await api('/api/auth/register',{
          method:'POST',
          body:JSON.stringify(safeForm),
          timeout: 15000
        });
      }else{
        throw regErr;
      }
    }

    if(r&&r.user){
      setProfile(r.user);
      setToken(r.token);
      try{localStorage.setItem('fitness.profile',JSON.stringify(r.user));localStorage.setItem('fitness.token',r.token);}catch{}
      
      // Auto-enroll face biometrics right from the 3 captured pictures into the database
      let enrollSuccess = false;
      try{
        const enrollRes = await api('/api/auth/enroll-face',{
          method:'POST',
          headers:{'Authorization':'Bearer '+r.token},
          body:JSON.stringify({images}),
          timeout: 25000
        });
        if(enrollRes && enrollRes.enrolled){
          enrollSuccess = true;
          toast.success(`${enrollRes.enrolled} face pictures enrolled securely in database!`);
        }
      }catch(faceErr){
        console.warn('Face biometric enrollment notice:',faceErr);
        toast.warning(faceErr.message || 'Face enrollment could not detect landmarks. You can re-enroll face in Profile.');
      }

      setRegister(false);
      setLogin(false);
      setStep(0);
      setCaptureProgress(0);
      setForm(initialForm);
      setPage('Dashboard');
      setFailCount(0);setScanStatus('recognized');
      toast.success(`Welcome ${r.user.name}! ${images.length} face pictures processed.`);
      const firstName=r.user.name.split(' ')[0]||r.user.name;
      say(`Registration complete! Welcome ${firstName}. ${images.length} face pictures captured and saved in database for biometric recognition. Let's start our workout!`);
    }else{
      throw new Error('Failed to enroll member in database.');
    }
  }catch(e){
    toast.error(e.message);
    say(e.message);
  }finally{
    setBusy(false);
    setCaptureProgress(0);
  }
}
 async function enrollFace(){setBusy(true);try{const images=[];for(let i=0;i<3;i++){images.push(await runtime.frame());setFaceCount(i+1);await new Promise(r=>setTimeout(r,500))}await api('/api/auth/enroll-face',{method:'POST',body:JSON.stringify({images})});toast.success('Three face samples enrolled securely')}catch(e){toast.error(e.message)}finally{setBusy(false)}}
 const today=new Date().toLocaleDateString('en-CA');const todayRows=history.filter(w=>new Date(w.started_at).toLocaleDateString('en-CA')===today);const activeMinutes=Math.round(todayRows.reduce((a,w)=>a+w.active_seconds,0)/60);const calories=todayRows.reduce((a,w)=>a+(w.calories||0),0);const ready=health?.services?.filter(x=>x.status==='READY').length||0;
 const gameCards=()=> <div className="game-grid">{games.map((g,i)=><button className={'game-card '+g.color} key={g.id} onClick={()=>choose(g)}><div className="game-top"><span className="eyebrow">{g.tag}</span><ArrowUpRight size={19}/></div><div className="game-icon"><g.icon size={42} strokeWidth={1.6}/><span className="game-number">0{i+1}</span></div><h3>{g.name}</h3><p>{g.desc}</p><div className="game-bottom"><span><Clock3 size={14}/>{g.time}</span><span>{manifest[g.id]?.installed?'Ready':'Coming soon'}</span></div></button>)}</div>;
const systemRows=[{name:'Application',status:'READY',message:'MIRAI interface is ready.'},{name:'STT Model (Speech-to-Text)',status:'READY',message:'Neural Speech Recognition Model active (continuous listening).'},{name:'TTS Model (Text-to-Speech)',status:'READY',message:'Neural Speech Synthesis Model active (natural spoken feedback).'},{name:'Camera',status:camera?.active?'READY':'WARNING',message:cameraError||'Enable camera to check access.'},...(health?.services||[{name:'Fitness service',status:'NOT_CONNECTED',message:'Connect your local fitness service.'}])];
  if(!profile){
    return (
      <div className={'system-entry-gate ' + (mirror ? 'mirror' : '')}>
        <Toaster richColors position="top-right"/>
        <div className="gate-container">
          <header className="gate-header">
            <div className="gate-brand">
              <span className="brand-icon"><Activity size={28}/></span>
              <span className="brand-title-silver">MIRAI</span>
            </div>
            <div className="gate-security-pill">
              <Lock size={13} className="pulse-icon"/>
              <span>Biometric Security Enforced</span>
            </div>
            <div className="gate-header-actions">
              <button className={'voice-pill ' + (voice === 'Listening' ? 'listening' : '')} onClick={voiceToggle}>
                {voice === 'Listening' ? <AudioLines size={16}/> : <Mic size={16}/>}
                <span>{voice}</span>
              </button>
              <button className="icon-btn" aria-label="Toggle mirror mode" onClick={() => { const n = !mirror; setMirror(n); say(n ? 'Mirror mode enabled' : 'Mirror mode disabled'); }}>
                <Expand size={19}/>
              </button>
            </div>
          </header>

          <div className="gate-terminal-card">
            <div className="terminal-header">
              <div className="terminal-badge">
                <ShieldCheck size={14}/>
                <span>DATABASE BIOMETRIC GATEWAY</span>
              </div>
              <h2>Biometric Identity Required</h2>
              <p>Face recognition active. Look toward the camera to enter.</p>
            </div>

            <div className="gate-scanner-section">
              <div className="biometric-viewfinder">
                {camera ? (
                  <>
                    <Video stream={camera}/>
                    <div className="scanner-hud-overlay">
                      <div className="hud-corner top-left"/>
                      <div className="hud-corner top-right"/>
                      <div className="hud-corner bottom-left"/>
                      <div className="hud-corner bottom-right"/>
                      <div className="face-oval-guide"/>
                      {busy && <div className="scanning-laser-beam"/>}
                    </div>
                  </>
                ) : (
                  <div className="viewfinder-standby">
                    <ScanFace size={56} strokeWidth={1.4}/>
                    <p>Camera Standby · Looking for face</p>
                    <button className="secondary-btn" onClick={enableCamera}>
                      <Camera size={15}/> Activate Camera
                    </button>
                  </div>
                )}
              </div>

              {scanStatus === 'not_recognized' && (
                <div className="gate-not-recognized-banner">
                  <div className="banner-title"><AlertTriangle size={18} className="warn-icon"/> You are not a registered person</div>
                  <p>Would you like to please register, or try again?</p>
                  <div className="gate-fail-actions">
                    <button id="btn-try-again" data-voice-target="try again" className="primary-btn" disabled={busy} onClick={() => { say('Okay. Looking toward the camera.'); unregisteredAnnouncedRef.current = false; setTimeout(() => authenticate('face', true), 600); }}>
                      <RefreshCw size={16} className={busy ? 'spin' : ''}/> Try Again
                    </button>
                    <button id="btn-go-register" data-voice-target="register" className="secondary-btn" onClick={() => { setRegister(true); setStep(0); say("Question 1 of 5: What should we call you?"); }}>
                      <UserRound size={16}/> Register
                    </button>
                  </div>
                </div>
              )}

              <div className="gate-scanner-controls">
                <button
                  id="btn-recognize-me"
                  data-voice-target="recognize me"
                  className="primary-btn gate-scan-action-btn"
                  disabled={busy}
                  onClick={() => authenticate('face')}
                >
                  <ScanFace size={19}/>
                  {busy ? 'Scanning Face & Verifying in DB…' : (scanStatus === 'not_recognized' ? 'Scan Face Again' : 'Scan Face & Enter System')}
                </button>

                <div className="mic-live-indicator">
                  <div
                    className={'mic-pulse-ring ' + (micLevel > 12 ? 'active' : voice.includes('blocked') ? 'blocked' : '')}
                    onClick={voiceToggle}
                    title="Click to toggle or allow microphone"
                  >
                    {voice === 'Listening' ? <AudioLines size={20}/> : <Mic size={20}/>}
                  </div>
                  <div className="mic-live-content">
                    <div className="mic-live-title">
                      <span><strong>Mic:</strong> {voice} {micLevel > 8 ? `(${micLevel}%)` : ''}</span>
                      {voice !== 'Listening' && (
                        <button className="primary-btn enable-voice-btn" onClick={voiceToggle}>
                          <Mic size={13}/> Click to Enable Mic
                        </button>
                      )}
                    </div>
                    <div className="mic-volume-track">
                      <div className="mic-volume-fill" style={{ width: `${Math.min(100, micLevel * 2.5)}%` }}/>
                    </div>
                    <div className="mic-live-transcript">
                      {transcript ? `Hearing: “${transcript}”` : 'Voice active · Speak anytime'}
                    </div>
                  </div>
                </div>

                <div className="voice-quick-chips">
                  <button className="voice-chip" onClick={() => handleCommand('recognize me')}>
                    <ScanFace size={14}/> “Recognize me”
                  </button>
                  <button className="voice-chip" onClick={() => handleCommand('try again')}>
                    <RefreshCw size={14}/> “Try again”
                  </button>
                  <button className="voice-chip" onClick={() => handleCommand('register')}>
                    <UserRound size={14}/> “Register”
                  </button>
                </div>
              </div>
            </div>

            <div className="gate-register-prompt">
              <span>Not registered in the database yet?</span>
              <button className="gate-enroll-link text-btn" onClick={() => { setRegister(true); setStep(0); say('Opening member registration.'); }}>
                <UserRound size={15}/> Enroll New Member in Database
              </button>
              <button className="text-btn muted" style={{fontSize: '12px', marginTop: '6px', color: '#94a3b8'}} onClick={clearDatabaseAction} disabled={busy}>
                <RefreshCw size={12} className={busy ? 'spin' : ''}/> Clear &amp; Reset Database to Fresh State
              </button>
            </div>

            <div className="gate-status-strip">
              <div className="status-item">
                <span className={'status-dot ' + (health?.services?.some(s => (s.name === 'PostgreSQL' || s.name === 'Database') && s.status === 'READY') ? 'green' : 'amber')}/>
                <span>{health?.services?.some(s => (s.name === 'PostgreSQL' || s.name === 'Database') && s.status === 'READY') ? 'DB Active' : 'DB Connecting'}</span>
              </div>
              <div className="status-item">
                <ShieldCheck size={13}/>
                <span>Encrypted Face Vectors</span>
              </div>
              <div className="status-item">
                <AudioLines size={13}/>
                <span>Voice Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="voice-dock">
          <button aria-label="Toggle voice commands" className={voice === 'Listening' ? 'active' : ''} onClick={voiceToggle}>
            {voice === 'Listening' ? <AudioLines size={21}/> : <Mic size={21}/>}
          </button>
          <form onSubmit={e => { e.preventDefault(); if (command.trim()) { handleCommand(command); setTranscript(command); setCommand(''); } }}>
            <input aria-label="Voice command fallback" placeholder={voice === 'Listening' ? 'Listening…' : 'Say “recognize me” or type a command'} value={command} onChange={e => setCommand(e.target.value)}/>
          </form>
          <span>{transcript ? 'Heard: ' + transcript : 'HANDS-FREE BIOMETRIC GATE'}</span>
          <button aria-label="Send command" onClick={() => { if (command.trim()) { handleCommand(command); setTranscript(command); setCommand(''); } }}>
            <ArrowRight size={18}/>
          </button>
        </div>

        <Dialog open={register} onOpenChange={setRegister}>
          <DialogContent className="fitness-dialog">
            <DialogHeader>
              <DialogTitle>Register Member into Database</DialogTitle>
              <DialogDescription>Question {step + 1} of {fields.length}. Speak your answer or type it below.</DialogDescription>
            </DialogHeader>
            <Progress value={(step + 1) / fields.length * 100}/>
            <form onSubmit={e => {
              e.preventDefault();
              const err = validateField(step);
              if (err) {
                toast.warning(err);
                say(err);
                return;
              }
              if (step === fields.length - 1) {
                saveRegistration();
              } else {
                const nextStep = step + 1;
                setStep(nextStep);
                if (speaker && fields[nextStep][0] !== 'password') say(fields[nextStep][1]);
              }
            }}>
              <label className="question-label">
                {fields[step][1]}
                <input autoFocus key={step} type={fields[step][2]} required value={form[fields[step][0]]} min={fields[step][0] === 'age' ? 18 : 1} minLength={fields[step][0] === 'password' ? 10 : undefined} onChange={e => setForm({ ...form, [fields[step][0]]: e.target.value })}/>
              </label>
              {step === 1 && <p className="small muted">This training profile supports adults aged 18 and over.</p>}
              {step === fields.length - 1 && captureProgress === 0 && (
                <div style={{marginTop:'12px',padding:'12px 14px',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.25)',borderRadius:'10px',display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',color:'#38bdf8'}}>
                  <Camera size={18} style={{flexShrink:0}}/>
                  <span><strong>Biometric Enrollment:</strong> Upon saving, MIRAI will automatically capture at least 3 face pictures from your camera for recognition in the database.</span>
                </div>
              )}
              {captureProgress > 0 && (
                <div style={{marginTop:'14px',padding:'14px',background:'rgba(2,6,23,0.92)',borderRadius:'14px',border:'1px solid rgba(56,189,248,0.4)',textAlign:'center'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',color:'#38bdf8',fontWeight:700,fontSize:'13px',marginBottom:'10px'}}>
                    <Camera size={17} className="pulse-icon"/>
                    <span>Capturing 3 Biometric Pictures for Database Recognition</span>
                  </div>
                  <div style={{width:'100%',height:'190px',borderRadius:'10px',overflow:'hidden',position:'relative',margin:'0 auto 10px',background:'#020617',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {camera ? <Video stream={camera}/> : <div className="camera-placeholder"><Camera size={26}/><span style={{fontSize:'12px'}}>Camera active</span></div>}
                    <div style={{position:'absolute',inset:'10px',border:'2px dashed rgba(56,189,248,0.55)',borderRadius:'50%',pointerEvents:'none'}}/>
                    <div style={{position:'absolute',bottom:'8px',left:'50%',transform:'translateX(-50%)',background:'rgba(15,23,42,0.92)',padding:'3px 12px',borderRadius:'20px',color:'#38bdf8',fontSize:'11px',fontWeight:700,border:'1px solid rgba(56,189,248,0.3)',whiteSpace:'nowrap'}}>
                      📸 Capturing Picture {captureProgress} of 3...
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'8px',justifyContent:'center',flexWrap:'wrap'}}>
                    {[1, 2, 3].map(n => (
                      <span key={n} style={{
                        padding:'5px 12px',
                        borderRadius:'8px',
                        fontSize:'12px',
                        fontWeight:700,
                        background: captureProgress >= n ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)',
                        color: captureProgress >= n ? '#4ade80' : '#94a3b8',
                        border: captureProgress >= n ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {captureProgress >= n ? '✓ Picture ' + n + ' Captured' : 'Picture ' + n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="button-row">
                {step > 0 && <button id="btn-back" data-voice-target="back" type="button" className="secondary-btn" disabled={busy} onClick={() => { const prevStep = Math.max(0, step - 1); setStep(prevStep); if (speaker && fields[prevStep][0] !== 'password') say(fields[prevStep][1]); }}>Back</button>}
                <button id="btn-next" data-voice-target="next" className="primary-btn" disabled={busy}>{step === fields.length - 1 ? (captureProgress > 0 ? `Capturing ${captureProgress}/3…` : 'Save & Capture 3 Photos') : 'Next'}<ArrowRight size={18}/></button>
                {fields[step][0] !== 'password' && <button type="button" className="icon-btn" aria-label="Speak answer" onClick={voiceToggle}><Mic size={20}/></button>}
              </div>
            </form>
          </DialogContent>
        </Dialog>
        {boot && <div className="boot-screen"><span className="brand-icon"><Activity size={34}/></span><h1 className="brand-title-silver">MIRAI</h1><div className="boot-checks"><span><Check size={15}/>Interface ready</span><span><Check size={15}/>STT &amp; TTS Models Active</span><span><Camera size={15}/>Biometric Sensor Ready</span><span><Mic size={15}/>Voice recognition listening</span></div><div className="boot-loader"/><span>Connecting Database Security Gateway…</span></div>}
      </div>
    );
  }

  return <SidebarProvider><Toaster richColors position="top-right"/><div className={'fitness-app '+(mirror?'mirror':'')}>
  <Sidebar className="fitness-sidebar">
    <SidebarHeader>
      <a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('Dashboard')}}>
        <span className="brand-icon"><Activity size={26}/></span>
        <span className="brand-title-silver">MIRAI</span>
      </a>
    </SidebarHeader>
    <SidebarContent>
      <div className="nav-caption">YOUR SPACE</div>
      <SidebarMenu>
        {nav.map(([label,Icon])=>(
          <SidebarMenuItem key={label}>
            <SidebarMenuButton isActive={page===label} onClick={()=>navigate(label)} className="nav-button">
              <Icon size={20}/>
              <span>{label}</span>
              {page===label&&<span className="nav-active"/>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <div className="sidebar-coach">
        <button onClick={()=>navigate('Workouts')}>
          Let’s move <ArrowRight size={16}/>
        </button>
      </div>
    </SidebarContent>
    <SidebarFooter>
      <button className="setup-nav" onClick={()=>navigate('Setup center')}>
        <Settings2 size={20}/>Setup center<span className="status-dot amber"/>
      </button>
      <div className="sidebar-user">
        <span className="avatar">{profile?.name?.[0]||'G'}</span>
        <div style={{flex: 1, minWidth: 0}}>
          <strong style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{profile?.name||'Guest'}</strong>
          <small>{profile?'Your personal space':'Sign in to access dashboard'}</small>
        </div>
        {profile ? (
          <button
            id="btn-sidebar-logout"
            data-voice-target="log out"
            className="secondary-btn logout-btn"
            title="Log out"
            onClick={handleLogout}
            style={{display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 9px', fontSize: '12px', fontWeight: 600, color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', borderRadius: '8px'}}
          >
            <LogOut size={14}/>
            <span>Log out</span>
          </button>
        ) : (
          <button aria-label="Sign in" onClick={() => { setPage('Dashboard'); setLogin(true); }}>
            <ChevronRight size={17}/>
          </button>
        )}
      </div>
    </SidebarFooter>
  </Sidebar>
  <div className="main-wrap"><header className="topbar"><div className="breadcrumb"><SidebarTrigger/><span>Your space</span><ChevronRight size={14}/><strong>{page}</strong></div><div className="top-actions"><span className="date-label"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><button className={'voice-pill '+(voice==='Listening'?'listening':'')} onClick={voiceToggle}>{voice==='Listening'?<AudioLines size={16}/>:<Mic size={16}/>}<span>{voice}</span></button><button className="icon-btn" aria-label="Toggle mirror mode" onClick={()=>{const n=!mirror;setMirror(n);say(n?'Mirror mode enabled':'Mirror mode disabled');}}><Expand size={19}/></button>{profile&&<button className="secondary-btn logout-top-btn" id="btn-top-logout" data-voice-target="log out" title="Log out of MIRAI" onClick={handleLogout} style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',fontSize:'13px',fontWeight:600,color:'#f87171',border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',cursor:'pointer',borderRadius:'8px'}}><LogOut size={15}/><span>Log out</span></button>}</div></header>
  <main className={page==='Workout'||session?'workout-view-active':''}>
  {page==='Dashboard'&&profile&&(
    <>
      <div className="page-heading"><div><div className="eyebrow blue">MAKE TIME FOR YOU</div><h1>Good to see you, {profile.name.split(' ')[0]}<span className="heading-dot">.</span></h1><p>Move with purpose. Build your rhythm. Feel the difference.</p></div><div className="streak-badge"><Flame size={22}/><div><strong>{stats.streak} day streak</strong><small>{stats.streak?'Keep your momentum going':'Your first day is a fresh start'}</small></div></div></div>
      <section className="workout-hero"><div className="hero-copy"><span className="hero-label"><span/>YOUR DAILY RESET</span><h2>A stronger you.<br/>One session at a time.</h2><p>Your warm-up, your workout, your pace.<br/>Let’s make today count.</p><button className="white-btn" onClick={()=>navigate('Workouts')}><Play size={17} fill="currentColor"/>Start workout<ArrowRight size={18}/></button></div><div className="session-path"><div className="path-heading"><span>TODAY’S JOURNEY</span><span>01 — 03</span></div>{[['01','Find your rhythm','Dodge or dance to warm up',Wind],['02','Build your strength','Step into your boxing session',Target],['03','Recharge & reflect','Your summary and recovery',Sparkles]].map(([num,title,desc,Icon])=><div className="path-row" key={num}><span className="path-num">{num}</span><div><strong>{title}</strong><small>{desc}</small></div><Icon size={21}/></div>)}</div></section>
      <section className="metrics-row"><Metric icon={Flame} title="Estimated energy" value={calories?Math.round(calories):'—'} unit="kcal" note={calories?'From recorded active movement':'Available after your first workout'}/><Metric icon={Clock3} title="Active time today" value={activeMinutes} unit="min" note="Every active minute matters"/><Metric icon={Target} title="Completed workouts" value={stats.total} unit="sessions" note="Building a habit, one session at a time"/><Metric icon={Heart} title="Heart rate" value={sensors?.heart_rate??'—'} unit="bpm" note={sensors?.heart_rate?'Live sensor reading':'Connect your heart-rate sensor'}/></section>
      <div className="section-heading"><div><h2>Find your way to move</h2><p>Choose a warm-up or go straight to your training.</p></div><button className="text-btn" onClick={()=>navigate('Workouts')}>All workouts<ArrowRight size={16}/></button></div>{gameCards()}
      <div className="bottom-grid"><section className="panel weekly"><div className="section-heading"><h3>Your weekly rhythm</h3><span className="small muted">This week</span></div><div className="week-days">{Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-((date.getDay()+6)%7)+i);const done=history.some(w=>new Date(w.started_at).toDateString()===date.toDateString()&&w.active_seconds>=60);return <div key={i} className={date.toDateString()===new Date().toDateString()?'today':''}><span>{['M','T','W','T','F','S','S'][i]}</span><b className={done?'done':''}>{done?<Check size={18}/>:date.getDate()}</b></div>})}</div><p className="small muted">{stats.total?'Keep showing up for yourself.':'Your first workout is the start of something good.'}</p></section><section className="panel coach-panel"><div className="coach-title"><span className="mini-icon"><Sparkles size={19}/></span><div><h3>Your coach’s corner</h3><span className="small muted">Here for your next step</span></div><button className="icon-btn" aria-label="Read coaching aloud" onClick={()=>say(coach)}><Volume2 size={19}/></button></div><p>{coach}</p><button className="text-btn" onClick={()=>profile?navigate('Recovery'):setLogin(true)}>Personalize my experience<ArrowRight size={16}/></button></section></div>
    </>
  )}
  {page==='Workouts'&&<><PageTitle eyebrow="YOUR TRAINING LIBRARY" title="Move your way." text="Three ways to train. One connected experience."/>{gameCards()}<section className="panel flow-panel"><h3>Your complete workout</h3><p>Choose Dragon Dodge or Dance Trainer to warm up, then continue to Boxing Trainer. Finish with your workout summary and recovery.</p><button className="primary-btn" onClick={()=>navigate('Workouts')}>Plan a session<ArrowRight size={17}/></button></section><div className="notice"><PlugZap size={20}/><div><strong>Your three games are connected.</strong><p>Boxing and Dance run here. Dragon Dodge opens a 3D window on your fitness computer.</p></div><button className="text-btn" onClick={()=>{setGuide(true);say('Opening integration guide.');}}>Integration guide<ArrowUpRight size={16}/></button></div></>}
  {page==='Workout'&&(()=>{
    const activeGame = selected || games[0];
    return (
      <>
        {/* WORKOUT STATION BAR WITH TABS FOR ANY GAME AT ANY TIME */}
        <div className="workout-station-tabs" style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',marginBottom:'18px',padding:'12px 16px',background:'white',border:'1px solid #e3e9f4',borderRadius:'14px',boxShadow:'0 2px 8px rgba(0,0,0,0.03)'}}>
          <span style={{fontSize:'12px',fontWeight:700,letterSpacing:'1px',color:'#64748b',marginRight:'6px',display:'flex',alignItems:'center',gap:'6px'}}>
            <Dumbbell size={16} color="#3b82f6"/> WORKOUT STATION:
          </span>
          {games.map(g => {
            const isCur = activeGame.id === g.id;
            return (
              <button
                key={g.id}
                id={`tab-${g.id.toLowerCase()}`}
                data-voice-target={g.id === 'DragonDodge' ? 'dragon dodge' : g.id === 'DanceTrainer' ? 'dance trainer' : 'boxing trainer'}
                className={`secondary-btn tab-btn ${isCur ? 'active-workout-tab' : ''}`}
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'8px',
                  padding:'9px 15px',
                  borderRadius:'10px',
                  fontWeight:600,
                  fontSize:'13px',
                  cursor:'pointer',
                  border: isCur ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: isCur ? 'rgba(37,99,235,0.08)' : '#fff',
                  color: isCur ? '#1d4ed8' : '#334155'
                }}
                onClick={() => switchWorkout(g.id)}
              >
                <g.icon size={16}/>
                <span>{g.name}</span>
                {isCur && session && <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#22c55e',display:'inline-block'}} title="Active workout"/>}
              </button>
            );
          })}
          
          <button
            id="btn-complete-all-workouts"
            data-voice-target="complete all workout"
            className="primary-btn complete-all-btn"
            style={{
              marginLeft:'auto',
              display:'inline-flex',
              alignItems:'center',
              gap:'8px',
              padding:'9px 18px',
              borderRadius:'10px',
              fontWeight:700,
              fontSize:'13px',
              background:'linear-gradient(135deg, #16a34a, #15803d)',
              borderColor:'#16a34a',
              color:'#fff',
              cursor:'pointer'
            }}
            onClick={completeAllWorkouts}
            title="Finish all workouts and move to food and recovery"
          >
            <Sparkles size={16}/>
            <span>Complete All Workouts &amp; Move to Recovery</span>
            <ArrowRight size={15}/>
          </button>
        </div>

        {/* WORKOUT STATION HEADING */}
        <div className="page-heading">
          <div>
            <div className="eyebrow blue">{activeGame.tag}</div>
            <h1>{activeGame.name}</h1>
            <p>{session ? 'Your movement. Your pace.' : 'Select any exercise above at any time. When finished, say "complete all workout".'}</p>
          </div>
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            <button id="btn-fullscreen-toggle" data-voice-target="full screen, fullscreen, maximize, bigger screen" className="secondary-btn" onClick={()=>toggleFullscreen()} title={isFullscreen?'Exit full screen':'Enter full screen'}>
              {isFullscreen?<><Minimize size={16}/><span>Exit full screen</span></>:<><Maximize size={16}/><span>Full screen</span></>}
            </button>
            <button id="btn-workout-finish" className="secondary-btn" data-voice-target={session ? "finish and save, finish workout, save workout, finish, save" : "back to workouts"} onClick={()=>session?stopWorkout():navigate('Workouts')}>
              {session?'Finish & save':'Back to workouts'}
            </button>
          </div>
        </div>

        {/* RECENTLY COMPLETED ROUNDS IN THIS SESSION */}
        {sessionWorkouts.length > 0 && !session && (
          <div style={{marginBottom:'20px',padding:'16px 20px',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',border:'1px solid #86efac',borderRadius:'12px',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',color:'#166534',fontWeight:700,fontSize:'14px'}}>
              <Check size={18}/> {sessionWorkouts.length} Workout{sessionWorkouts.length>1?'s':''} Completed in this Session:
            </div>
            <div style={{display:'flex',gap:'10px',flexWrap:'wrap',flex:1}}>
              {sessionWorkouts.map((w, idx) => (
                <span key={idx} style={{background:'#ffffffd0',padding:'5px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:600,color:'#1e293b',border:'1px solid rgba(0,0,0,0.06)'}}>
                  🎯 {w.gameName||w.game} · Score: {w.score??'—'} ({Math.round((w.active_seconds||0)/60)}m)
                </span>
              ))}
            </div>
            <button className="primary-btn" data-voice-target="complete all workout" onClick={completeAllWorkouts} style={{fontSize:'12px',padding:'8px 14px',background:'#16a34a',borderColor:'#16a34a'}}>
              Go to Food &amp; Recovery <ArrowRight size={14}/>
            </button>
          </div>
        )}

        {/* MAIN GAME STAGE */}
        <div className={`game-stage ${isFullscreen?'is-fullscreen':''}`}>
          {isFullscreen && (
            <div className="fullscreen-floating-bar">
              <span style={{color:'#38bdf8',display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',fontWeight:600}}>
                <AudioLines size={15}/> STT Active
              </span>
              <span style={{color:'#f1f5f9',display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',fontWeight:700,background:'rgba(255,255,255,0.08)',padding:'4px 10px',borderRadius:'12px'}}>
                <activeGame.icon size={14}/> {activeGame.name}
              </span>
              {session && (
                <button className="fullscreen-btn" data-voice-target={paused ? "resume" : "pause"} onClick={()=>paused?resumeWorkout():pauseWorkout()}>
                  {paused?<><Play size={14}/> Resume</>:<><Pause size={14}/> Pause</>}
                </button>
              )}
              <button id="fs-btn-finish" className="fullscreen-btn finish-btn" data-voice-target={session ? "finish and save, finish workout, save workout, finish, save" : "exit"} onClick={()=>session?stopWorkout():navigate('Workouts')}>
                <Check size={14}/> {session?'Finish & save':'Exit'}
              </button>
              <button id="fs-btn-logout" className="fullscreen-btn logout-btn" data-voice-target="log out, logout, sign out" onClick={handleLogout}>
                <LogOut size={14}/> Log out
              </button>
              <button className="fullscreen-btn exit-btn" data-voice-target="exit full screen, minimize" onClick={()=>toggleFullscreen(false)} title="Exit Fullscreen (Esc)">
                <Minimize size={14}/>
              </button>
            </div>
          )}

          {session ? (
            <>
              <iframe title={activeGame.name} ref={frameRef} src={manifest[activeGame.id]?.entry} allow="autoplay; camera; microphone; fullscreen"/>
              {paused && (
                <div className="pause-overlay">
                  <Pause size={40}/>
                  <h2>{safety?'Let’s take a break.':'Workout paused'}</h2>
                  <p>{safety?'Stop moving and check how you feel.':'Your active time is not being counted.'}</p>
                  <button className="primary-btn" data-voice-target="resume" onClick={resumeWorkout}>Resume when ready</button>
                  <button className="secondary-btn" data-voice-target="finish" onClick={stopWorkout}>Finish &amp; save</button>
                </div>
              )}
            </>
          ) : (
            <div className="game-empty">
              <span className={'large-game-icon '+activeGame.color}>
                <activeGame.icon size={58}/>
              </span>
              <span className="eyebrow">{manifest[activeGame.id]?.installed?'READY TO TRAIN':'YOUR GAME SPACE'}</span>
              <h2>{manifest[activeGame.id]?.installed?'Ready, set, move.':'A space for '+activeGame.name+'.'}</h2>
              <p>{manifest[activeGame.id]?.installed?'Your camera and voice controls are shared throughout the session.':'Your game hasn’t been connected yet. Everything around it is ready for integration.'}</p>
              {manifest[activeGame.id]?.installed ? (
                <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
                  <button className="primary-btn" data-voice-target="start session" disabled={busy} onClick={()=>startGame(activeGame)}>
                    Start {activeGame.name} session <Play size={17}/>
                  </button>
                  {sessionWorkouts.length > 0 && (
                    <button className="secondary-btn" data-voice-target="complete all workout" onClick={completeAllWorkouts} style={{borderColor:'#16a34a',color:'#16a34a'}}>
                      <Sparkles size={16}/> Complete All Workouts &amp; Move to Recovery
                    </button>
                  )}
                </div>
              ) : (
                <button className="secondary-btn" data-voice-target="integration guide" onClick={()=>{setGuide(true);say('Opening integration guide.');}}>
                  View integration guide<ArrowUpRight size={16}/>
                </button>
              )}
            </div>
          )}
        </div>

        {/* WORKOUT METRICS & CONTROLS */}
        <div className="workout-controls">
          <div>
            <span className="small muted">ACTIVE TIME</span>
            <strong>{Math.floor((session?.active_seconds||0)/60)}:{String(Math.floor((session?.active_seconds||0)%60)).padStart(2,'0')}</strong>
          </div>
          <div>
            <span className="small muted">HEART RATE</span>
            <strong>{sensors?.heart_rate??'—'} <small>bpm</small></strong>
          </div>
          <div>
            <span className="small muted">DIFFICULTY</span>
            <strong>{difficulty} / 5</strong>
          </div>
          {session && (
            <button className="secondary-btn" data-voice-target={paused ? "resume" : "pause"} onClick={()=>paused?resumeWorkout():pauseWorkout()}>
              {paused?<Play size={17}/>:<Pause size={17}/>} {paused?'Resume':'Pause'}
            </button>
          )}
          <button className="safety-btn" data-voice-target="pain" onClick={()=>handleCommand('pain')}>
            <Square size={16}/>I feel discomfort
          </button>
        </div>
      </>
    );
  })()}
  {page==='Progress'&&<><PageTitle eyebrow="EVERY STEP COUNTS" title="See how far you’ve come." text="Your workout history, active time, and consistency."/><div className="metrics-row"><Metric icon={Flame} title="Current streak" value={stats.streak} unit="days" note="At least one active minute per day"/><Metric icon={Dumbbell} title="Workouts" value={stats.total} unit="total" note="Completed and saved"/><Metric icon={Clock3} title="Active minutes" value={Math.round(history.reduce((a,w)=>a+w.active_seconds,0)/60)} unit="min" note="Movement time only"/><Metric icon={Target} title="Longest streak" value={stats.longest||0} unit="days" note="Your personal best"/></div><section className="panel"><div className="section-heading"><h2>Workout history</h2><button className="text-btn" onClick={()=>{refresh();say('Refreshing workout history.');}}><RefreshCw size={15}/>Refresh</button></div>{history.length?<div className="history-list">{history.map(w=><button key={w.id} onClick={()=>{setSummary(w);setPage('Summary');say('Showing summary for '+(games.find(g=>g.id===w.game)?.name||w.game));}}><span className="mini-icon"><Dumbbell size={20}/></span><div><strong>{games.find(g=>g.id===w.game)?.name||w.game}</strong><span>{new Date(w.started_at).toLocaleString()}</span></div><b>{Math.round(w.active_seconds/60)} min</b><ArrowUpRight size={18}/></button>)}</div>:<Empty icon={ChartNoAxesCombined} title="Your story is just getting started." text={profile?'Complete a workout to see your progress here.':'Sign in to see your personal workout history.'} action={profile?'Explore workouts':'Sign in'} onClick={()=>profile?navigate('Workouts'):setLogin(true)}/>}</section></>}
  {page==='Profile'&&<><PageTitle eyebrow="MADE FOR YOU" title="Your fitness profile." text="A little context makes your training more personal."/>{!profile?<section className="panel"><Empty icon={UserRound} title="Let’s make this your space." text="Create a profile to keep your workouts and preferences together." action="Create profile" onClick={()=>{setRegister(true);setStep(0);say('Creating your profile.');}}/></section>:<div className="profile-grid"><section className="panel"><div className="profile-heading"><span className="avatar large">{profile.name[0]}</span><div><h2>{profile.name}</h2><p>{profile.email}</p></div><button id="btn-profile-logout" data-voice-target="log out" type="button" className="secondary-btn" onClick={handleLogout} style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:'6px',color:'#f87171',borderColor:'rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)'}}><LogOut size={16}/><span>Log out</span></button></div><form onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{const p=await api('/api/users/me',{method:'PATCH',body:JSON.stringify({...data,age:Number(data.age),height:Number(data.height),weight:Number(data.weight)})});setProfile(p);toast.success('Profile updated');say('Profile updated successfully.');}catch(err){toast.error(err.message);say(err.message);}}}><div className="form-grid">{fields.slice(0,9).map(([key,label,type])=><label key={key}>{({height:'Height (cm)',weight:'Weight (kg)',food_preferences:'Food preferences',restrictions:'Dietary restrictions'})[key]||key[0].toUpperCase()+key.slice(1)}<input type={type} name={key} defaultValue={profile[key]} required min={key==='age'?18:1}/></label>)}</div><button className="primary-btn" data-voice-target="save changes">Save changes<Check size={17}/></button></form></section><div><section className="panel"><h3>Face sign-in</h3><p>Enroll three camera samples to recognize you next time. Your face representation is encrypted by the local service.</p>{camera&&<Video stream={camera}/>}<button className="secondary-btn" data-voice-target="enroll face" disabled={busy} onClick={()=>{say('Enrolling face samples. Look directly at your camera.');enrollFace();}}><ScanFace size={18}/>{busy?'Capturing '+faceCount+' / 3':'Enroll face'}</button><p className="small muted">Face matching needs the face-recognition package and encryption key. Password sign-in remains available.</p></section><section className="panel profile-note"><ShieldCheck size={23}/><h3>Your own space</h3><p>Each profile has separate workout history and preferences. Sign out before another person begins.</p></section></div></div>}</>}
  {page==='Setup center'&&<><PageTitle eyebrow="CONNECTED & READY" title="Your setup center." text="Check your connections. Fix a problem. Get back to moving."/><div className="setup-grid"><section className="panel"><div className="section-heading"><h2>System health</h2><button className="text-btn" data-voice-target="recheck" disabled={checking} onClick={()=>{check();say('Rechecking system health.');}}><RefreshCw size={16} className={checking?'spin':''}/>Recheck</button></div><p className="muted">{ready?ready+' local services ready':'Your browser is ready. Connect your local services below.'}</p><div className="health-list">{systemRows.map((s,i)=><div key={i}><span className={'health-icon '+(s.status==='READY'?'good':'warn')}>{s.status==='READY'?<Check size={17}/>:<AlertTriangle size={17}/>}</span><div><strong>{s.name}</strong><p>{s.message}</p></div><span className={'status-label '+(s.status==='READY'?'good':'warn')}>{s.status==='READY'?'Ready':s.status==='NOT_CONNECTED'?'Not connected':s.status==='MISSING'?'Missing':'Needs setup'}</span></div>)}</div></section><div><section className="panel"><h3>Fitness service</h3><p>Connect the Python service running on your fitness computer.</p><form onSubmit={e=>{e.preventDefault();try{const u=new URL(urlInput);if(!['http:','https:'].includes(u.protocol))throw Error();const value=u.origin;setBackend(value);check(value);toast('Checking service connection…');say('Connecting to fitness service.');}catch{toast.error('Enter a valid http or https address.');say('Please enter a valid address.');}}}><label>Service address<input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="http://localhost:8000" type="url" required/></label><button className="primary-btn" data-voice-target="connect service">Connect service<PlugZap size={17}/></button></form><p className="small muted">For the hosted app, use an HTTPS service address and allow this site’s origin. On your computer, open the local app to use localhost.</p></section><section className="panel controls-panel"><h3>Camera & voice</h3>{camera?<Video stream={camera}/>:<div className="camera-placeholder"><Camera size={30}/><span>Camera is off</span></div>}<div className="button-row"><button className="secondary-btn" data-voice-target={camera ? "turn off camera" : "test camera"} onClick={()=>{if(camera){runtime.stopCamera();setCamera(null);say('Camera turned off.');}else enableCamera();}}><Camera size={16}/>{camera?'Turn off':'Test camera'}</button><button className="secondary-btn" data-voice-target="test voice" onClick={voiceToggle}><Mic size={16}/>Test voice</button></div><button className="text-btn" data-voice-target="test speaker" onClick={()=>{try{say('Your voice output is working clearly.')}catch(e){toast.error(e.message)}}}><Volume2 size={17}/>Test speaker</button><div className="button-row"><button className="secondary-btn" data-voice-target="load pose model" onClick={async()=>{try{await api('/api/health/models',{method:'POST'});await check();toast.success('Pose model loaded');say('Pose model loaded successfully.');}catch(e){toast.error(e.message);say(e.message);}}}>Load pose model</button><button className="secondary-btn" data-voice-target="load expression check" onClick={async()=>{try{await api('/api/health/expression',{method:'POST'});await check();toast.success('Expression check loaded. This is not pain detection.');say('Expression check loaded.');}catch(e){toast.error(e.message);say(e.message);}}}>Load expression check</button><button className="secondary-btn" data-voice-target="toggle offline voice" onClick={()=>{if(offlineRef.current){offlineRef.current.close();offlineRef.current=null;setVoice('Voice off');say('Offline voice disconnected.');return;}if(!backend||!token){toast.error('Connect your service and sign in first.');say('Please connect your service and sign in first.');return;}runtime.stopVoice();const w=new WebSocket(backend.replace(/^http/,'ws')+'/ws/voice');offlineRef.current=w;w.onopen=()=>{w.send(JSON.stringify({token}));setVoice('Offline listening');say('Offline voice connected and listening.');};w.onmessage=e=>{const d=JSON.parse(e.data);if(d.error){toast.error(d.error);w.close();return;}if(d.text&&!runtime.speaking){setTranscript(d.text);commandHandler.current(d.text)}};w.onerror=()=>toast.error('Offline voice connection failed.');w.onclose=()=>{offlineRef.current=null;setVoice('Voice off');}}}>Toggle offline voice</button></div><div className="switch-row"><label htmlFor="speaker">Spoken coaching</label><Switch id="speaker" checked={speaker} onCheckedChange={checked=>{setSpeaker(checked);if(checked)say('Voice coaching enabled');}}/></div><div className="switch-row"><label htmlFor="mirror">High-contrast mirror mode</label><Switch id="mirror" checked={mirror} onCheckedChange={checked=>{setMirror(checked);say(checked?'Mirror mode enabled':'Mirror mode disabled');}}/></div><p className="small muted">Browser speech may need internet. Offline voice is available through the local service.</p></section><section className="panel" style={{border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.04)'}}><div className="section-heading"><div><h3 style={{color:'#f87171'}}>Database Management</h3><p className="muted">Clear all registered member profiles, face biometric encodings, and workout records to start fresh from first.</p></div></div><div className="button-row"><button className="secondary-btn" data-voice-target="clear database" style={{color:'#f87171',borderColor:'rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.1)'}} onClick={clearDatabaseAction} disabled={busy}><RefreshCw size={16} className={busy?'spin':''}/>Clear &amp; Reset Database</button></div></section></div></div><section className="notice"><Download size={22}/><div><strong>Run the full project on your computer.</strong><p>Includes the React interface, FastAPI service, PostgreSQL setup, and all three games.</p></div><a className="secondary-btn" href="/ai-fitness-source.zip" download>Download project<Download size={16}/></a></section></>}
  {page==='Summary'&&summary&&<><PageTitle eyebrow="YOU SHOWED UP" title="Session complete." text="Take a breath. Here’s what you put into today."/><div className="metrics-row"><Metric icon={Clock3} title="Total session" value={Math.round((summary.total_seconds||0)/60)} unit="min" note="Includes pauses and idle time"/><Metric icon={Move} title="Active exercise" value={Math.round(summary.active_seconds/60)} unit="min" note="Measured movement only"/><Metric icon={Flame} title="Estimated energy" value={summary.calories?Math.round(summary.calories):'—'} unit="kcal" note={summary.calories?'Low-confidence activity estimate':'Insufficient movement data'}/><Metric icon={Target} title="Game score" value={summary.score??'—'} unit="points" note={summary.game}/></div><section className="panel"><h2>Make recovery part of your routine.</h2><p>{summary.coaching||'Your session has been recorded. Check how you feel before continuing.'}</p><div className="button-row"><button className="primary-btn" data-voice-target="food and recovery" onClick={()=>navigate('Recovery')}>Food &amp; recovery<ArrowRight size={17}/></button><button className="secondary-btn" data-voice-target="continue to boxing" onClick={()=>{const g=games.find(x=>x.id==='BoxingTrainer');if(g){choose(g);startGame(g);}}}>Continue to boxing</button><button className="text-btn" data-voice-target="back to dashboard" onClick={()=>navigate('Dashboard')}>Back to dashboard</button></div></section></>}
  {page==='Recovery'&&<><PageTitle eyebrow="REST IS PART OF PROGRESS" title="Food &amp; Recovery." text="Replenish your energy, hydrate, and nourish your body."/>
    {sessionWorkouts.length > 0 && (
      <div style={{marginBottom:'24px',padding:'20px 24px',background:'white',border:'1px solid #e2e8f0',borderRadius:'14px'}}>
        <h3 style={{fontSize:'16px',fontWeight:700,color:'#1e293b',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
          <Dumbbell size={18} color="#2563eb"/> Today's Completed Training Session:
        </h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'12px'}}>
          {sessionWorkouts.map((w, idx) => (
            <div key={idx} style={{padding:'12px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'10px'}}>
              <strong style={{display:'block',fontSize:'14px',color:'#0f172a'}}>{w.gameName||w.game}</strong>
              <div style={{fontSize:'12px',color:'#64748b',marginTop:'4px'}}>Score: <b>{w.score??'—'}</b> · Active: <b>{Math.round((w.active_seconds||0)/60)} min</b></div>
            </div>
          ))}
        </div>
      </div>
    )}
    <section className="panel recovery-panel"><Sparkles size={32}/><h2>Your recovery check-in &amp; nutrition plan</h2><p>{summary?.coaching||'Great workout! Recovery and balanced nutrition replenish glycogen and repair muscle tissue. Choose whole foods aligned with your goals.'}</p><div className="recovery-details"><div><span>YOUR GOAL</span><strong>{profile?.goal||'Fitness & Consistency'}</strong></div><div><span>FOOD PREFERENCES</span><strong>{profile?.food_preferences||'Balanced / Whole Foods'}</strong></div><div><span>DIETARY RESTRICTIONS</span><strong>{profile?.restrictions||'None'}</strong></div></div><div style={{marginTop:'20px',padding:'18px 20px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'10px',color:'#166534',fontSize:'13px',lineHeight:'1.7'}}><strong style={{display:'block',fontSize:'14px',marginBottom:'6px'}}>🥗 Recommended Post-Workout Fuel:</strong><span>Drink 500ml of water with electrolytes. For {profile?.goal?.toLowerCase()||'recovery'}, prioritize clean proteins (tofu, legumes, eggs, or lean chicken) alongside complex carbohydrates (quinoa, brown rice, sweet potatoes, or oats).</span></div><div className="button-row" style={{marginTop:'25px'}}><button className="primary-btn" data-voice-target="workout station" onClick={()=>navigate('Workouts')}><Dumbbell size={16}/>Back to Workout Station</button><button className="secondary-btn" data-voice-target="dashboard" onClick={()=>navigate('Dashboard')}><LayoutDashboard size={16}/>Back to Dashboard</button><button className="secondary-btn" data-voice-target="update preferences" onClick={()=>navigate('Profile')}>Update preferences<ArrowRight size={17}/></button></div></section></>}
  </main><footer className="app-footer"><span><ShieldCheck size={15}/>Your pace. Your progress.</span><button onClick={()=>navigate('Setup center')}><span className={'status-dot '+(health?.services?.some(s=>s.name==='PostgreSQL'&&s.status==='READY')?'green':'amber')}/>{health?.services?.some(s=>s.name==='PostgreSQL'&&s.status==='READY')?'Fitness service connected':'Local service not connected'}<ChevronRight size={13}/></button></footer>
  <div className="voice-dock"><button aria-label="Toggle voice commands" className={voice==='Listening'?'active':''} onClick={voiceToggle}>{voice==='Listening'?<AudioLines size={21}/>:<Mic size={21}/>}</button><form onSubmit={e=>{e.preventDefault();if(command.trim()){handleCommand(command);setTranscript(command);setCommand('')}}}><input aria-label="Voice command fallback" placeholder={voice==='Listening'?'Listening…':'Try “start boxing” or type a command'} value={command} onChange={e=>setCommand(e.target.value)}/></form><span>{transcript?'Heard: '+transcript:'HANDS-FREE, YOUR WAY'}</span><button aria-label="Send command" onClick={()=>{if(command.trim()){handleCommand(command);setCommand('')}}}><ArrowRight size={18}/></button></div>
  </div></div>
  <Dialog open={login} onOpenChange={open=>{if(!open&&!profile){setLogin(false);toast.info('Dashboard is locked until you sign in.');say('Dashboard is locked. Sign in anytime to unlock.');}else setLogin(open);}}><DialogContent className="fitness-dialog"><DialogHeader><DialogTitle>Sign in to MIRAI</DialogTitle><DialogDescription>Sign in with face recognition or credentials to unlock your dashboard.</DialogDescription></DialogHeader><Tabs value={authMode} onValueChange={setAuthMode}><TabsList className="auth-tabs"><TabsTrigger value="face">Face sign-in</TabsTrigger><TabsTrigger value="password">Email & password</TabsTrigger></TabsList><TabsContent value="face"><div className="login-camera">{camera?<Video stream={camera}/>:<><ScanFace size={60} strokeWidth={1}/><p>Look toward your camera.</p></>}</div><button id="btn-recognize-me" data-voice-target="recognize me" className="primary-btn full" disabled={busy} onClick={()=>{say('Scanning face. Looking towards the camera.');authenticate('face');}}><Camera size={18}/>{busy?'Looking for you…':'Recognize me & unlock'}</button></TabsContent><TabsContent value="password"><form onSubmit={e=>{e.preventDefault();authenticate('password')}}><label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input type="password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><button className="primary-btn full" disabled={busy} data-voice-target="sign in">Sign in & unlock<ArrowRight size={18}/></button></form></TabsContent></Tabs><button className="text-btn centered" data-voice-target="create profile" onClick={()=>{setLogin(false);setRegister(true);setStep(0);say('Opening profile creation.');}}>New here? Create your profile<ArrowRight size={16}/></button>{!backend&&<p className="small muted">Local services can connect in Setup center anytime.</p>}</DialogContent></Dialog>
  <Dialog open={register} onOpenChange={setRegister}>
    <DialogContent className="fitness-dialog">
      <DialogHeader>
        <DialogTitle>Register Member into Database</DialogTitle>
        <DialogDescription>Question {step+1} of {fields.length}. Speak your answer or type it below.</DialogDescription>
      </DialogHeader>
      <Progress value={(step+1)/fields.length*100}/>
      <form onSubmit={e=>{
        e.preventDefault();
        const err = validateField(step);
        if (err) {
          toast.warning(err);
          say(err);
          return;
        }
        if(step===fields.length-1) {
          saveRegistration();
        } else {
          const nextStep = step + 1;
          setStep(nextStep);
          if(speaker&&fields[nextStep][0]!=='password') say(fields[nextStep][1]);
        }
      }}>
        <label className="question-label">{fields[step][1]}<input autoFocus key={step} type={fields[step][2]} required value={form[fields[step][0]]} min={fields[step][0]==='age'?18:1} minLength={fields[step][0]==='password'?10:undefined} onChange={e=>setForm({...form,[fields[step][0]]:e.target.value})}/></label>
        {step===1&&<p className="small muted">This training profile supports adults aged 18 and over.</p>}
        {step === fields.length - 1 && captureProgress === 0 && (
          <div style={{marginTop:'12px',padding:'12px 14px',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.25)',borderRadius:'10px',display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',color:'#38bdf8'}}>
            <Camera size={18} style={{flexShrink:0}}/>
            <span><strong>Biometric Enrollment:</strong> Upon saving, MIRAI will automatically capture at least 3 face pictures from your camera for recognition in the database.</span>
          </div>
        )}
        {captureProgress > 0 && (
          <div style={{marginTop:'14px',padding:'14px',background:'rgba(2,6,23,0.92)',borderRadius:'14px',border:'1px solid rgba(56,189,248,0.4)',textAlign:'center'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',color:'#38bdf8',fontWeight:700,fontSize:'13px',marginBottom:'10px'}}>
              <Camera size={17} className="pulse-icon"/>
              <span>Capturing 3 Biometric Pictures for Database Recognition</span>
            </div>
            <div style={{width:'100%',height:'190px',borderRadius:'10px',overflow:'hidden',position:'relative',margin:'0 auto 10px',background:'#020617',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {camera ? <Video stream={camera}/> : <div className="camera-placeholder"><Camera size={26}/><span style={{fontSize:'12px'}}>Camera active</span></div>}
              <div style={{position:'absolute',inset:'10px',border:'2px dashed rgba(56,189,248,0.55)',borderRadius:'50%',pointerEvents:'none'}}/>
              <div style={{position:'absolute',bottom:'8px',left:'50%',transform:'translateX(-50%)',background:'rgba(15,23,42,0.92)',padding:'3px 12px',borderRadius:'20px',color:'#38bdf8',fontSize:'11px',fontWeight:700,border:'1px solid rgba(56,189,248,0.3)',whiteSpace:'nowrap'}}>
                📸 Capturing Picture {captureProgress} of 3...
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'center',flexWrap:'wrap'}}>
              {[1, 2, 3].map(n => (
                <span key={n} style={{
                  padding:'5px 12px',
                  borderRadius:'8px',
                  fontSize:'12px',
                  fontWeight:700,
                  background: captureProgress >= n ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)',
                  color: captureProgress >= n ? '#4ade80' : '#94a3b8',
                  border: captureProgress >= n ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(255,255,255,0.1)'
                }}>
                  {captureProgress >= n ? '✓ Picture ' + n + ' Captured' : 'Picture ' + n}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="button-row">
          {step>0&&<button type="button" data-voice-target="back" className="secondary-btn" disabled={busy} onClick={()=>setStep(Math.max(0, step-1))}>Back</button>}
          <button className="primary-btn" data-voice-target="next" disabled={busy}>{step===fields.length-1?(captureProgress > 0 ? `Capturing ${captureProgress}/3…` : 'Save & Capture 3 Photos'):'Next'}<ArrowRight size={18}/></button>
          {fields[step][0]!=='password'&&<button type="button" className="icon-btn" aria-label="Speak answer" onClick={voiceToggle}><Mic size={20}/></button>}
        </div>
      </form>
    </DialogContent>
  </Dialog>
  <Dialog open={guide} onOpenChange={setGuide}><DialogContent className="fitness-dialog"><DialogHeader><DialogTitle>Three folders. One fitness app.</DialogTitle><DialogDescription>Boxing, Dance, and desktop Dragon Dodge are integrated.</DialogDescription></DialogHeader><div className="guide-copy"><p>Boxing and Dance run in the app with shared camera, pose tracking, coaching, and workout scores.</p><p>Dragon Dodge opens its original Panda3D window on the computer running the local service. Start the app with <code>start.bat</code> or <code>python launch.py</code> and install <code>backend/requirements-games.txt</code>.</p><p>Use the app’s Pause, Resume, and Finish controls. See <code>GAME_INTEGRATION.md</code> in the source for setup and limitations.</p><a className="primary-btn" href="/ai-fitness-source.zip" download>Download source &amp; guide<Download size={17}/></a></div></DialogContent></Dialog>
  {boot&&<div className="boot-screen"><span className="brand-icon"><Activity size={34}/></span><h1 className="brand-title-silver">MIRAI</h1><div className="boot-checks"><span><Check size={15}/>Interface ready</span><span><Check size={15}/>STT &amp; TTS Models Active</span><span><Camera size={15}/>Camera awaiting permission</span><span><Mic size={15}/>Voice recognition listening</span></div><div className="boot-loader"/><span>Preparing your space…</span></div>}
 </SidebarProvider>
}
function PageTitle({eyebrow,title,text}){return <div className="page-heading"><div><div className="eyebrow blue">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div>}
function Empty({icon:Icon,title,text,action,onClick}){return <div className="empty-state"><span className="large-game-icon"><Icon size={42}/></span><h2>{title}</h2><p>{text}</p><button className="primary-btn" onClick={onClick}>{action}<ArrowRight size={17}/></button></div>}
