"""Integration boundaries: native launch ownership, recovery, scoring, and IPC."""
import sys,time,importlib.util
from pathlib import Path
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_api import main

def test_desktop_routes_and_recovery(monkeypatch):
    monkeypatch.delenv('FITNESS_DESKTOP_GAMES',raising=False)
    monkeypatch.setattr(main.vision,'load',lambda:None)
    profile={'name':'Player','age':25,'height':170,'weight':65,'goal':'Fitness','experience':'Beginner','injuries':'none','food_preferences':'Any','restrictions':'none','password':'a-long-password'}
    with TestClient(main.app) as c:
        a=c.post('/api/auth/register',json={**profile,'email':'games-a@example.com'}).json()
        b=c.post('/api/auth/register',json={**profile,'email':'games-b@example.com'}).json()
        ha={'Authorization':'Bearer '+a['token']};hb={'Authorization':'Bearer '+b['token']}
        wid=c.post('/api/workouts',headers=ha,json={'game':'DragonDodge'}).json()['id']
        url=f'/api/workouts/{wid}/desktop/start'
        assert c.post(url,json={},headers=hb).status_code==404
        assert c.post(url,json={}).status_code==401
        assert c.post(url,json={},headers=ha).status_code==503
        assert c.get('/api/workouts/active',headers=ha).json()['paused'] is True
        assert c.post(f'/api/workouts/{wid}/desktop/status',headers=ha,json={'difficulty':6}).status_code==422
        calls=[]
        monkeypatch.setattr(main.desktop_games,'status',lambda id:{'score':120,'running':False})
        monkeypatch.setattr(main.desktop_games,'close',lambda id=None:calls.append(id))
        result=c.post(f'/api/workouts/{wid}/finish',headers=ha).json()
        assert result['score']==120 and wid in calls
        assert c.post(url,json={},headers=ha).status_code==409
        assert c.post(f'/api/workouts/{wid}/finish',headers=ha).json()['score']==120

def test_shared_native_tracker_does_not_open_camera():
    path=Path(__file__).resolve().parents[2]/'desktop-games/DragonDodgePy/game/fitness_adapter.py'
    spec=importlib.util.spec_from_file_location('fitness_adapter',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    tracker=module.FitnessTracker()
    p=[dict(x=.5,y=.5,visibility=1) for _ in range(33)]
    p[11]['y']=p[12]['y']=.3;p[23]['y']=p[24]['y']=.6
    tracker.feed({'pose_at':time.time(),'landmarks':p})
    assert tracker.is_connected and tracker.get_lateral()==0
    tracker.feed({'pose_at':time.time()-10,'landmarks':p})
    assert not tracker.is_connected and not tracker.consume_jump() and not tracker.consume_punch()
