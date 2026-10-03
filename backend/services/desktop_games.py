"""One authenticated, fixed-path native Dragon Dodge process per local service.
No arbitrary command/path input. Private temporary IPC; browser owns the camera.
"""
import atexit, importlib.util, json, os, subprocess, sys, tempfile, threading, time
from pathlib import Path

class DesktopGames:
    def __init__(self):
        self.lock=threading.RLock();self.process=None;self.session=None;self.directory=None;self.data={}
    def launch(self,session,paused=False,difficulty=1):
        with self.lock:
            if os.getenv('FITNESS_DESKTOP_GAMES')!='1':
                raise RuntimeError('Dragon Dodge requires the local desktop launcher. Run start.bat or python launch.py on your computer.')
            if self.process and self.process.poll() is None:
                if self.session==session:return self.status(session)
                raise RuntimeError('Another Dragon Dodge window is running. Finish that workout first.')
            if importlib.util.find_spec('panda3d') is None:
                raise RuntimeError('Install backend/requirements-games.txt in the backend virtual environment, then restart the app.')
            self.close()
            self.directory=tempfile.TemporaryDirectory(prefix='fitness-dragon-')
            self.session=session
            self.data={'paused':paused,'difficulty':difficulty,'landmarks':[],'pose_at':0}
            self.update(session)
            root=Path(__file__).resolve().parents[2]/'desktop-games/DragonDodgePy'
            self.log=open(Path(self.directory.name)/'game.log','w')
            try:
                self.process=subprocess.Popen([sys.executable,str(root/'main.py'),'--no-camera','--fitness-state',str(Path(self.directory.name)/'input.json')],cwd=root,stdout=self.log,stderr=self.log)
            except Exception:
                self.close();raise RuntimeError('Could not open the Dragon Dodge desktop process.')
            return {'running':True,'score':0,'state':'launching'}
    def update(self,session,**values):
        with self.lock:
            if session!=self.session or not self.directory:return
            self.data.update(values);self.data['heartbeat']=time.time()
            path=Path(self.directory.name)/'input.json';tmp=path.with_suffix('.tmp')
            tmp.write_text(json.dumps(self.data));os.replace(tmp,path)
    def status(self,session):
        with self.lock:
            if self.session!=session or not self.directory:return {'running':False,'score':None,'state':'not_started'}
            result={}
            try:result=json.loads((Path(self.directory.name)/'output.json').read_text())
            except (OSError,ValueError):pass
            running=self.process is not None and self.process.poll() is None
            score=result.get('score')
            if not isinstance(score,(int,float)) or not 0<=score<=100000000:score=None
            return {'running':running,'score':score,'state':result.get('state','starting' if running else 'closed'),'paused':bool(result.get('paused')), 'speech':result.get('speech'), 'error':None if running or self.process is None or self.process.returncode==0 else 'Dragon Dodge could not keep running. Check Panda3D installation and desktop graphics support.'}
    def close(self,session=None):
        with self.lock:
            if session is not None and self.session!=session:return
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try:self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=2)
            if getattr(self,'log',None):self.log.close();self.log=None
            if self.directory:self.directory.cleanup()
            self.process=None;self.session=None;self.directory=None;self.data={}

desktop_games=DesktopGames()
atexit.register(desktop_games.close)
