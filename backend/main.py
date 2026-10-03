from dotenv import load_dotenv
load_dotenv()
import os,json,hashlib,secrets,base64,time,logging,importlib.util,asyncio
from datetime import datetime,timedelta,timezone
from pathlib import Path
from collections import defaultdict,deque
from fastapi import FastAPI,Depends,HTTPException,WebSocket,WebSocketDisconnect,Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from pydantic import BaseModel,Field,ConfigDict
from sqlalchemy import select,text
from cryptography.fernet import Fernet,InvalidToken
from database.models import User,FitnessProfile,FoodPreference,FaceProfile,Token,Workout,Streak,records,connect,now
from services.vision import vision
from services.desktop_games import desktop_games
from services.voice import voice
from services.expression import expression
logging.basicConfig(level=logging.INFO)
logger=logging.getLogger('fitness')
app=FastAPI(title='AI Fitness local service',version='1.0.0')
origins=[v.strip() for v in os.getenv('ALLOWED_ORIGINS','http://localhost:3000,http://127.0.0.1:3000').split(',')]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type'])
engine=None;Session=None;db_error='Not connected';latest_sensors={};attempts=defaultdict(deque)
bearer=HTTPBearer(auto_error=False)
def initialize():
    global engine,Session,db_error
    try:engine,Session=connect();db_error=None
    except Exception as exc:db_error=f"{type(exc).__name__}: Database is unavailable. Check DATABASE_URL."
@app.on_event('startup')
def startup():initialize()
def db():
    global Session
    if not Session:initialize()
    if not Session:raise HTTPException(503,'Database is unavailable. Please check system setup.')
    with Session() as s:yield s
@app.exception_handler(Exception)
async def error_handler(request:Request,exc:Exception):
    logger.error('Request failed: %s %s (%s)',request.method,request.url.path,type(exc).__name__)
    return JSONResponse(status_code=500,content={'code':'SERVICE_ERROR','message':'A service failed. Retry or check System health.','recoverable':True})
def aware(d):return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
def token_user(value,s):
    t=s.get(Token,hashlib.sha256(value.encode()).hexdigest())
    if not t or aware(t.expires_at)<now():raise HTTPException(401,'Please sign in again.')
    return s.get(User,t.user_id)
def current(credentials:HTTPAuthorizationCredentials=Depends(bearer),s=Depends(db)):
    if not credentials:raise HTTPException(401,'Sign in to continue.')
    return token_user(credentials.credentials,s)
def public_user(u,s):return {'id':u.id,'email':u.email,'name':u.name,**s.get(FitnessProfile,u.id).data}
def auth_result(u,s):
    value=secrets.token_urlsafe(36);s.add(Token(digest=hashlib.sha256(value.encode()).hexdigest(),user_id=u.id,expires_at=now()+timedelta(hours=12)));s.commit()
    return {'token':value,'user':public_user(u,s)}
def password_hash(value,salt=None):
    salt=salt or secrets.token_hex(16)
    result=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
    return salt+':'+result
def rate_limit(request):
    key=request.client.host if request.client else 'local';q=attempts[key];stamp=time.monotonic()
    while q and stamp-q[0]>60:q.popleft()
    if len(q)>=10:raise HTTPException(429,'Too many attempts. Wait one minute and retry.')
    q.append(stamp)
def record(s,table,u,w,data):s.add(records[table](user_id=u.id,session_id=w.id,data=data))
def owned(s,id,u):
    w=s.scalar(select(Workout).where(Workout.id==id).with_for_update())
    if not w or w.user_id!=u.id:raise HTTPException(404,'Workout not found.')
    return w
def live(s,id,u):
    w=owned(s,id,u)
    if w.ended_at:raise HTTPException(409,'Workout is already finished.')
    return w
def workout_json(w):return {k:(getattr(w,k).isoformat() if isinstance(getattr(w,k),datetime) else getattr(w,k)) for k in ['id','game','started_at','ended_at','active_seconds','total_seconds','calories','score','accuracy','paused']}
def package(name):
    try:return importlib.util.find_spec(name) is not None
    except (ImportError,ValueError):return False
@app.get('/api/health')
def health():
    global db_error
    if not Session:initialize()
    database_ok=False
    if engine:
        try:
            with engine.connect() as c:c.execute(text('SELECT 1'))
            database_ok=True
        except Exception:pass
    face_model_ok = Path('models/face_landmarker.task').is_file() or Path('backend/models/face_landmarker.task').is_file()
    items=[('FastAPI backend','READY','Local service is running.'),('Database','READY' if database_ok else 'ERROR','Workout storage is available.' if database_ok else db_error or 'Database connection failed.'),('MediaPipe','READY' if vision.pose else 'MISSING','Pose model is loaded.' if vision.pose else 'Load pose_landmarker.task with the model check.'),('Face recognition','READY' if face_model_ok and os.getenv('FACE_ENCRYPTION_KEY') else 'MISSING','Biometric face recognition is ready.' if face_model_ok else 'Download face_landmarker.task to enable face recognition.'),('Offline speech','READY' if voice.owner and not voice.error else 'WARNING',voice.error or 'Enable offline voice to load Vosk and test the microphone.'),('ESP32 sensors','NOT_CONNECTED','Connect hardware during a workout. No simulated readings.'),('Expression check-in','READY' if expression.model else 'MISSING','Experimental expression-change check, not a pain diagnosis.' if expression.model else 'Optional face_landmarker.task not loaded. User discomfort reports still work.'),('AI coaching','READY','Movement-based coaching is available when pose tracking is loaded.')]
    return {'services':[{'name':n,'status':s,'message':m} for n,s,m in items]}
@app.post('/api/health/models')
def load_models(u=Depends(current)):
    try:vision.load();return {'status':'READY'}
    except RuntimeError as e:raise HTTPException(503,str(e))
@app.post('/api/health/expression')
def load_expression(u=Depends(current)):
    try:expression.load();return {'status':'READY','method':'Experimental expression-change check, not pain diagnosis.'}
    except Exception as e:raise HTTPException(503,str(e))
@app.post('/api/system/reset-database')
def reset_database():
    global engine, Session
    if not engine:
        raise HTTPException(500, 'Database engine not initialized.')
    try:
        from database.models import Base
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        return {'status':'OK','message':'Database cleared and reset successfully.'}
    except Exception as e:
        raise HTTPException(500, f'Database reset failed: {str(e)}')

class Profile(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    name:str=Field(min_length=1,max_length=80)
    age:int=Field(ge=18,le=110)
    height:float=Field(ge=80,le=250)
    weight:float=Field(ge=25,le=350)
    goal:str=Field(max_length=200)
    experience:str=Field(max_length=100)
    injuries:str=Field(max_length=500)
    food_preferences:str=Field(max_length=300)
    restrictions:str=Field(max_length=500)
class Registration(Profile):
    email:str=Field(min_length=5,max_length=200,pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password:str=Field(min_length=10,max_length=128)
    face_images:list[str] | None=Field(default=None,max_length=10)
class Login(BaseModel):
    email:str=Field(max_length=200)
    password:str=Field(max_length=128)
@app.post('/api/auth/register')
def register(data:Registration,request:Request,s=Depends(db)):
    rate_limit(request);email=data.email.lower()
    if s.scalar(select(User).where(User.email==email)):raise HTTPException(409,'An account with that email already exists.')
    u=User(name=data.name,email=email,password_hash=password_hash(data.password));s.add(u);s.flush()
    info=data.model_dump(exclude={'name','email','password','face_images'})
    s.add(FitnessProfile(user_id=u.id,data=info));s.add(FoodPreference(user_id=u.id,data={k:info[k] for k in ['food_preferences','restrictions']}));s.add(Streak(user_id=u.id))
    if data.face_images and len(data.face_images)>0:
        try:
            crypto=cipher()
            vectors=[]
            for im in data.face_images:
                try:vectors.append(vision.face(im))
                except Exception:pass
            if vectors:
                s.add(FaceProfile(user_id=u.id,encrypted=crypto.encrypt(json.dumps(vectors).encode()).decode()))
        except Exception:pass
    s.commit()
    return auth_result(u,s)
@app.post('/api/auth/login')
def login(data:Login,request:Request,s=Depends(db)):
    rate_limit(request);u=s.scalar(select(User).where(User.email==data.email.lower()))
    if not u or not secrets.compare_digest(password_hash(data.password,u.password_hash.split(':')[0]),u.password_hash):raise HTTPException(401,'Email or password is incorrect.')
    return auth_result(u,s)
@app.post('/api/auth/logout')
def logout(credentials:HTTPAuthorizationCredentials=Depends(bearer),u=Depends(current),s=Depends(db)):
    row=s.get(Token,hashlib.sha256(credentials.credentials.encode()).hexdigest());s.delete(row);s.commit();voice.stop(u.id);return {'ok':True}
@app.get('/api/users/me')
def me(u=Depends(current),s=Depends(db)):return public_user(u,s)
@app.patch('/api/users/me')
def update(data:Profile,u=Depends(current),s=Depends(db)):
    u.name=data.name;info=data.model_dump(exclude={'name'});s.get(FitnessProfile,u.id).data=info;s.get(FoodPreference,u.id).data={k:info[k] for k in ['food_preferences','restrictions']};s.commit();return public_user(u,s)
class Frame(BaseModel):image:str=Field(max_length=2_800_000)
from typing import Annotated
class Faces(BaseModel):images:list[Annotated[str,Field(max_length=2_800_000)]]=Field(min_length=1,max_length=10)
def cipher():
    key=os.getenv('FACE_ENCRYPTION_KEY')
    if not key:raise HTTPException(503,'Set FACE_ENCRYPTION_KEY before enrolling faces.')
    try:return Fernet(key.encode())
    except ValueError:raise HTTPException(503,'FACE_ENCRYPTION_KEY is invalid.')
@app.post('/api/auth/enroll-face')
def enroll(data:Faces,u=Depends(current),s=Depends(db)):
    crypto=cipher()
    vectors=[]
    errors=[]
    for idx, im in enumerate(data.images):
        try:vectors.append(vision.face(im))
        except (RuntimeError,ValueError) as e:errors.append(str(e))
    if not vectors:
        raise HTTPException(422, errors[0] if errors else 'No clear face detected in submitted pictures.')
    row=s.get(FaceProfile,u.id) or FaceProfile(user_id=u.id)
    row.encrypted=crypto.encrypt(json.dumps(vectors).encode()).decode()
    s.add(row);s.commit()
    return {'enrolled':len(vectors),'samples':len(vectors)}
@app.post('/api/auth/face')
def face_login(data:Frame,request:Request,s=Depends(db)):
    rate_limit(request);crypto=cipher()
    try:
        import numpy as np
        target=np.array(vision.face(data.image));matches=[]
        for f in s.scalars(select(FaceProfile)):
            try:
                vectors=json.loads(crypto.decrypt(f.encrypted.encode()))
                distance=min(float(np.linalg.norm(target-np.array(v))) for v in vectors)
                if distance<0.38:matches.append((distance,f.user_id))
            except Exception:pass
        matches.sort()
        if not matches:raise HTTPException(401,'You are not registered in the database. Please register.')
        return auth_result(s.get(User,matches[0][1]),s)
    except (RuntimeError,ValueError,InvalidToken) as e:raise HTTPException(422,str(e))

class Start(BaseModel):game:str=Field(pattern='^(DragonDodge|DanceTrainer|BoxingTrainer)$')
@app.post('/api/workouts')
def start(data:Start,u=Depends(current),s=Depends(db)):
    if s.scalar(select(Workout).where(Workout.user_id==u.id,Workout.ended_at==None)):raise HTTPException(409,'Finish your previous workout before starting another.')
    try:vision.load()
    except RuntimeError as e:raise HTTPException(503,str(e))
    w=Workout(user_id=u.id,game=data.game);s.add(w);s.flush();record(s,'game_sessions',u,w,{'game':data.game});s.commit();return workout_json(w)
@app.get('/api/workouts/active')
def active_workout(u=Depends(current),s=Depends(db)):
    w=s.scalar(select(Workout).where(Workout.user_id==u.id,Workout.ended_at==None))
    if not w:return None
    w.paused=True;desktop_games.update(w.id,paused=True);vision.previous.pop(w.id,None);s.commit();return workout_json(w)
@app.get('/api/workouts')
def history(u=Depends(current),s=Depends(db)):
    rows=list(s.scalars(select(Workout).where(Workout.user_id==u.id,Workout.ended_at!=None).order_by(Workout.started_at.desc())))
    current_streak,longest=streak(rows);return {'workouts':[workout_json(w) for w in rows],'stats':{'streak':current_streak,'longest':longest,'total':len(rows)}}
def streak(rows):
    from zoneinfo import ZoneInfo
    tz=ZoneInfo(os.getenv('FITNESS_TIMEZONE','Asia/Kolkata'));days=sorted({aware(w.started_at).astimezone(tz).date() for w in rows if w.active_seconds>=60});longest=run=0;last=None
    for d in days:
        run=run+1 if last and (d-last).days==1 else 1;longest=max(run,longest);last=d
    current=run if last and (now().astimezone(tz).date()-last).days<=1 else 0
    return current,longest
@app.post('/api/workouts/{id}/movement')
def movement(id:str,data:Frame,u=Depends(current),s=Depends(db)):
    w=live(s,id,u)
    if w.paused:return {'active_seconds':w.active_seconds,'active':False}
    try:r=vision.movement(id,data.image)
    except (RuntimeError,ValueError) as e:raise HTTPException(503,str(e))
    w.active_seconds+=r['seconds']
    if expression.model:
        try:
            check=expression.analyze(id,vision.image(data.image),r['active']);r['expression']=check
            if check.get('check_in'):
                w.paused=True;r['check_in']=True;r['coaching']='Your expression and movement changed. Would you like a break?';record(s,'discomfort_events',u,w,{'source':'expression_and_movement_heuristic','confirmed':False,'message':r['coaching']})
        except Exception as e:
            expression.error=type(e).__name__;r['expression_error']='Expression check unavailable. Movement tracking can continue.'
    # Persist a contextual coaching observation approximately every 30 active seconds.
    if int(w.active_seconds/30)>int((w.active_seconds-r['seconds'])/30):record(s,'ai_feedback',u,w,{'kind':'movement_rule','message':r.get('coaching','Movement recorded.'),'active_seconds':w.active_seconds})
    desktop_games.update(id,landmarks=r.get('landmarks',[]),pose_at=time.time(),paused=w.paused)
    record(s,'movement_analysis',u,w,{k:v for k,v in r.items() if k!='landmarks'});s.commit();return {**r,'active_seconds':w.active_seconds}
class PauseState(BaseModel):paused:bool
@app.post('/api/workouts/{id}/pause')
def pause(id:str,data:PauseState,u=Depends(current),s=Depends(db)):
    w=live(s,id,u);w.paused=data.paused;desktop_games.update(id,paused=data.paused);vision.previous.pop(id,None);s.commit();return {'paused':w.paused}
class Score(BaseModel):
    score:float=Field(ge=0,le=100000000,allow_inf_nan=False)
    accuracy:float|None=Field(default=None,ge=0,le=100,allow_inf_nan=False)
@app.post('/api/workouts/{id}/score')
def score(id:str,data:Score,u=Depends(current),s=Depends(db)):
    w=live(s,id,u);w.score=data.score;w.accuracy=data.accuracy;record(s,'game_scores',u,w,data.model_dump());s.commit();return {'ok':True}
class Discomfort(BaseModel):message:str=Field(min_length=1,max_length=500)
@app.post('/api/workouts/{id}/discomfort')
def discomfort(id:str,data:Discomfort,u=Depends(current),s=Depends(db)):
    w=live(s,id,u);w.paused=True;desktop_games.update(id,paused=True);vision.previous.pop(id,None);record(s,'discomfort_events',u,w,{'source':'user_report','message':data.message});s.commit();return {'paused':True}
@app.post('/api/workouts/{id}/finish')
def finish(id:str,u=Depends(current),s=Depends(db)):
    w=owned(s,id,u)
    if w.ended_at:return workout_json(w)
    native=desktop_games.status(id)
    if native.get('score') is not None:w.score=native['score']
    desktop_games.close(id)
    w.ended_at=now();w.total_seconds=max(0,(now()-aware(w.started_at)).total_seconds());w.active_seconds=min(w.active_seconds,w.total_seconds)
    profile=s.get(FitnessProfile,u.id).data
    # Gross MET estimate, not a sensor measurement; never include idle/paused seconds.
    met={'DragonDodge':3.5,'DanceTrainer':4.5,'BoxingTrainer':5.5}[w.game]
    w.calories=round(met*3.5*profile['weight']/200*w.active_seconds/60,2) if w.active_seconds>0 else None
    coaching='You recorded '+str(round(w.active_seconds/60,1))+' active minutes toward your goal: '+profile['goal']+'. Check how you feel before another session.'
    if profile['injuries'].lower() not in ['none','no',''] :coaching+=' Keep your saved limitations in mind: '+profile['injuries']+'.'
    record(s,'calorie_records',u,w,{'estimate':w.calories,'method':'gross MET × 3.5 × kg / 200 × active minutes','assumed_met':met,'confidence':'low' if w.calories else 'unavailable'})
    record(s,'ai_feedback',u,w,{'kind':'rule_based','message':coaching,'food_preferences':profile['food_preferences'],'restrictions':profile['restrictions']})
    s.flush();rows=list(s.scalars(select(Workout).where(Workout.user_id==u.id,Workout.ended_at!=None)));current_streak,longest=streak(rows);st=s.get(Streak,u.id);st.current=current_streak;st.longest=longest;st.updated_at=now();s.commit();vision.previous.pop(id,None);expression.states.pop(id,None)
    return {**workout_json(w),'coaching':coaching,'streak':current_streak}
class Sensor(BaseModel):
    model_config=ConfigDict(extra='forbid')
    heart_rate:float|None=Field(default=None,ge=25,le=240,allow_inf_nan=False)
    eda:float|None=Field(default=None,ge=0,le=1000,allow_inf_nan=False)
    acceleration:list[Annotated[float,Field(allow_inf_nan=False,ge=-200,le=200)]]|None=Field(default=None,min_length=3,max_length=3)
    gyro:list[Annotated[float,Field(allow_inf_nan=False,ge=-4000,le=4000)]]|None=Field(default=None,min_length=3,max_length=3)
    timestamp:datetime
@app.post('/api/workouts/{id}/device-token')
def device_token(id:str,u=Depends(current),s=Depends(db)):
    w=live(s,id,u);value=secrets.token_urlsafe(32);device_tokens[hashlib.sha256(value.encode()).hexdigest()]=(u.id,w.id,time.monotonic()+3600);return {'token':value,'expires_in':3600}
device_tokens={}
@app.websocket('/ws/sensors')
async def sensor_socket(ws:WebSocket):
    await ws.accept()
    try:
        hello=await asyncio.wait_for(ws.receive_json(),10);grant=device_tokens.get(hashlib.sha256(str(hello.get('token','')).encode()).hexdigest())
        if not grant or grant[2]<time.monotonic():await ws.close(4401);return
        while True:
            payload=await ws.receive_json()
            if time.monotonic()>grant[2]:await ws.close(4401);return
            try:data=Sensor.model_validate(payload)
            except Exception:await ws.send_json({'error':'Invalid sensor packet.'});continue
            stamp=aware(data.timestamp)
            if abs((now()-stamp).total_seconds())>60:await ws.send_json({'error':'Sensor timestamp is stale or in the future.'});continue
            with Session() as s:
                u=s.get(User,grant[0]);w=live(s,grant[1],u);record(s,'sensor_readings',u,w,data.model_dump(mode='json'));s.commit()
            latest_sensors[grant[1]]={**data.model_dump(mode='json'),'received':time.monotonic()};await ws.send_json({'ok':True})
    except (WebSocketDisconnect,asyncio.TimeoutError):pass
    except Exception:await ws.close(1011)
@app.websocket('/ws/live')
async def live_socket(ws:WebSocket):
    await ws.accept()
    try:
        hello=await asyncio.wait_for(ws.receive_json(),10)
        with Session() as s:u=token_user(hello.get('token',''),s);owned(s,hello.get('session_id',''),u)
        while True:
            data=latest_sensors.get(hello['session_id']);fresh=data and time.monotonic()-data['received']<10
            await ws.send_json({k:v for k,v in data.items() if k!='received'} if fresh else {'heart_rate':None,'eda':None,'status':'NOT_CONNECTED'});await asyncio.sleep(1)
    except (WebSocketDisconnect,asyncio.TimeoutError):pass
    except Exception:await ws.close(4401)
@app.websocket('/ws/voice')
async def voice_socket(ws:WebSocket):
    await ws.accept();owner=None
    try:
        hello=await asyncio.wait_for(ws.receive_json(),10)
        with Session() as s:u=token_user(hello.get('token',''),s);owner=u.id
        await asyncio.to_thread(voice.start,owner)
        while True:
            await ws.send_json({'status':'listening'})
            if voice.error:await ws.send_json({'error':voice.error});break
            try:value=voice.events.get_nowait();await ws.send_json({'text':value})
            except Exception:pass
            await asyncio.sleep(.1)
    except (WebSocketDisconnect,asyncio.TimeoutError):pass
    except Exception as e:
        try:await ws.send_json({'error':str(e)})
        except Exception:pass
    finally:
        if owner:voice.stop(owner)

class DesktopSettings(BaseModel):
    difficulty:int=Field(default=1,ge=1,le=5)
    command:str|None=None
@app.post('/api/workouts/{id}/desktop/start')
def desktop_start(id:str,data:DesktopSettings,u=Depends(current),s=Depends(db)):
    w=live(s,id,u)
    if w.game!='DragonDodge':raise HTTPException(400,'This workout is not a desktop game.')
    try:return desktop_games.launch(id,w.paused,data.difficulty)
    except RuntimeError as e:raise HTTPException(503,str(e))
@app.post('/api/workouts/{id}/desktop/status')
def desktop_status(id:str,data:DesktopSettings,u=Depends(current),s=Depends(db)):
    w=live(s,id,u)
    if w.game!='DragonDodge':raise HTTPException(400,'This workout is not a desktop game.')
    update_data={'paused':w.paused,'difficulty':data.difficulty}
    if data.command:update_data['command']=data.command
    desktop_games.update(id,**update_data)
    result=desktop_games.status(id)
    if result.get('score') is not None:w.score=result['score'];s.commit()
    return result
@app.on_event('shutdown')
def close_desktop_games():desktop_games.close()
