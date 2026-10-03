import os,sys,tempfile
from pathlib import Path
os.environ['FITNESS_TESTING']='1'
os.environ['DATABASE_URL']='sqlite:///'+str(Path(tempfile.mkdtemp())/'fitness.sqlite')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import main
from datetime import timedelta

def test_auth_isolation_and_workout_accounting():
    with TestClient(main.app) as client:
        profile={'name':'Test One','age':22,'height':170,'weight':65,'goal':'Consistency','experience':'Beginner','injuries':'None','food_preferences':'Vegetarian','restrictions':'None','email':'one@example.test','password':'test-password-123'}
        response=client.post('/api/auth/register',json=profile);assert response.status_code==200,response.text
        a=response.json();ha={'Authorization':'Bearer '+a['token']}
        b=client.post('/api/auth/register',json={**profile,'email':'two@example.test','name':'Test Two'}).json();hb={'Authorization':'Bearer '+b['token']}
        assert client.get('/api/workouts').status_code==401
        assert client.post('/api/auth/login',json={'email':profile['email'],'password':'wrong'}).status_code==401
        # Isolate the domain contract from an actual physical camera/model.
        original_load=main.vision.load;original_move=main.vision.movement
        main.vision.load=lambda:None
        main.vision.movement=lambda *args:{'seconds':.5,'active':True,'confidence':.9,'landmarks':[]}
        try:
            w=client.post('/api/workouts',json={'game':'DragonDodge'},headers=ha).json();wid=w['id']
            assert client.post('/api/workouts',json={'game':'BoxingTrainer'},headers=ha).status_code==409
            assert client.post(f'/api/workouts/{wid}/finish',headers=hb).status_code==404
            assert client.post(f'/api/workouts/{wid}/movement',json={'image':'test'},headers=ha).json()['active_seconds']==.5
            assert client.post(f'/api/workouts/{wid}/pause',json={'paused':True},headers=ha).status_code==200
            assert client.post(f'/api/workouts/{wid}/movement',json={'image':'test'},headers=ha).json()['active_seconds']==.5
            assert client.post(f'/api/workouts/{wid}/score',json={'score':-1},headers=ha).status_code==422
            assert client.post(f'/api/workouts/{wid}/discomfort',json={'message':'My knee hurts'},headers=ha).json()['paused'] is True
            with main.Session() as s:
                row=s.get(main.Workout,wid);row.started_at=main.now()-timedelta(seconds=90);row.active_seconds=60;s.commit()
            result=client.post(f'/api/workouts/{wid}/finish',headers=ha).json();assert result['active_seconds']==60;assert result['calories']>0
            history=client.get('/api/workouts',headers=ha).json();assert history['stats']['streak']==1;assert history['stats']['total']==1
            assert client.get('/api/workouts',headers=hb).json()['workouts']==[]
            # Repeated finish is idempotent, closed sessions reject movement.
            assert client.post(f'/api/workouts/{wid}/finish',headers=ha).json()['calories']==result['calories']
            assert client.post(f'/api/workouts/{wid}/movement',json={'image':'test'},headers=ha).status_code==409
            assert client.post('/api/auth/logout',headers=ha).status_code==200
            assert client.get('/api/users/me',headers=ha).status_code==401
        finally:main.vision.load=original_load;main.vision.movement=original_move

def test_validation_and_sensor_schema():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):main.Sensor(timestamp=main.now(),heart_rate=900)
    with pytest.raises(ValidationError):main.Sensor(timestamp=main.now(),acceleration=[1,2])
    assert main.Sensor(timestamp=main.now()).heart_rate is None

def test_multi_face_registration():
    with TestClient(main.app) as client:
        # Mock vision.face to return distinguishable normalized embeddings
        orig_face = main.vision.face
        call_count = {'c': 0}
        def mock_face(image):
            call_count['c'] += 1
            import numpy as np
            v = np.zeros(90)
            v[0] = 1.0
            v[1] = call_count['c'] * 0.05
            return (v / np.linalg.norm(v)).tolist()
        main.vision.face = mock_face
        try:
            profile = {
                'name': 'Multi Face User',
                'age': 25,
                'height': 175,
                'weight': 70,
                'goal': 'Strength',
                'experience': 'Intermediate',
                'injuries': 'None',
                'food_preferences': 'Balanced',
                'restrictions': 'None',
                'email': 'multiface@example.test',
                'password': 'test-password-123',
                'face_images': ['data:image/jpeg;base64,frame1', 'data:image/jpeg;base64,frame2', 'data:image/jpeg;base64,frame3']
            }
            res = client.post('/api/auth/register', json=profile)
            assert res.status_code == 200, res.text
            user_id = res.json()['user']['id']
            with main.Session() as s:
                profile_row = s.get(main.FaceProfile, user_id)
                assert profile_row is not None, "FaceProfile record should exist in DB"
                crypto = main.cipher()
                import json
                vectors = json.loads(crypto.decrypt(profile_row.encrypted.encode()))
                assert len(vectors) == 3, f"Expected 3 face vectors in DB, got {len(vectors)}"
            # Now verify face recognition login matches against the registered vectors
            login_res = client.post('/api/auth/face', json={'image': 'data:image/jpeg;base64,login_frame'})
            assert login_res.status_code == 200, login_res.text
            assert login_res.json()['user']['name'] == 'Multi Face User'
        finally:
            main.vision.face = orig_face

