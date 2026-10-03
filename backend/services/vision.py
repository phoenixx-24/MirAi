"""Browser owns the single physical camera; this service consumes its frames."""
import base64, os, time, threading
from pathlib import Path
class Vision:
    def __init__(self):
        self.pose=None;self.error=None;self.previous={};self.lock=threading.Lock()
    def load(self):
        if self.pose:return
        with self.lock:
            if self.pose:return
            try:
                import mediapipe as mp
                path=os.getenv('POSE_MODEL_PATH','models/pose_landmarker.task')
                if not Path(path).is_file():raise RuntimeError('Pose model missing: '+path)
                self.pose=mp.tasks.vision.PoseLandmarker.create_from_options(mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=path),running_mode=mp.tasks.vision.RunningMode.IMAGE,num_poses=1))
                self.error=None
            except Exception as exc:
                self.error=str(exc);raise RuntimeError(self.error)
    def image(self,data):
        import numpy as np, cv2
        try:raw=base64.b64decode(data,validate=True)
        except Exception:raise ValueError('Invalid camera image.')
        if len(raw)>2_000_000:raise ValueError('Frame is too large.')
        im=cv2.imdecode(np.frombuffer(raw,dtype=np.uint8),cv2.IMREAD_COLOR)
        if im is None or max(im.shape[:2])>2048:raise ValueError('Invalid camera image dimensions.')
        return cv2.cvtColor(im,cv2.COLOR_BGR2RGB)
    def movement(self,key,data):
        self.load()
        import mediapipe as mp
        import numpy as np
        im=self.image(data)
        with self.lock:result=self.pose.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=im))
        stamp=time.monotonic();before=self.previous.get(key)
        if not result.pose_landmarks:
            self.previous.pop(key,None)
            return {'active':False,'seconds':0,'confidence':0,'landmarks':[],'coaching':'Step back until your body is visible.'}
        pts=result.pose_landmarks[0];indices=[11,12,13,14,15,16,23,24,25,26,27,28]
        confidence=float(np.mean([pts[i].visibility for i in indices]))
        arr=np.array([[pts[i].x,pts[i].y] for i in indices]);delta=0;dt=0
        if before:
            dt=min(max(stamp-before[0],0),1.0)
            # Normalize displacement by torso size, then by elapsed time.
            torso=max(float(np.linalg.norm(arr[:2].mean(0)-arr[6:8].mean(0))),.1)
            delta=float(np.linalg.norm(arr-before[1],axis=1).mean()/torso/max(dt,.05))
        self.previous[key]=(stamp,arr)
        active=confidence>.65 and delta>.12 and before is not None
        return {'active':bool(active),'seconds':dt if active else 0,'confidence':confidence,'landmarks':[{'x':p.x,'y':p.y,'z':p.z,'visibility':p.visibility} for p in pts], 'coaching':'Movement detected. Keep a comfortable pace.' if active else 'Ready when you are. Only active movement counts.'}
    def face(self,data):
        import mediapipe as mp
        import numpy as np
        im=self.image(data)
        if not hasattr(self,'_face_landmarker') or self._face_landmarker is None:
            path=os.getenv('FACE_LANDMARKER_PATH','models/face_landmarker.task')
            if not Path(path).is_file():
                alt=Path(__file__).resolve().parent.parent/'models'/'face_landmarker.task'
                path=str(alt)
            if not Path(path).is_file():raise RuntimeError('Face landmarker model missing: '+path)
            options=mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=path),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_faces=1
            )
            self._face_landmarker=mp.tasks.vision.FaceLandmarker.create_from_options(options)
        res=self._face_landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=im))
        if not res.face_landmarks or len(res.face_landmarks)==0:
            raise ValueError('Show exactly one face, in good lighting, and try again.')
        lm=res.face_landmarks[0]
        center=np.array([lm[1].x,lm[1].y,lm[1].z])
        scale=max(float(np.linalg.norm(np.array([lm[33].x,lm[33].y,lm[33].z])-np.array([lm[263].x,lm[263].y,lm[263].z]))),0.01)
        key_indices=[33,133,159,145,362,263,386,374,1,4,168,61,291,13,14,17,70,63,105,66,107,336,296,334,293,300,10,152,234,454]
        pts=[(np.array([lm[i].x,lm[i].y,lm[i].z])-center)/scale for i in key_indices]
        emb=np.concatenate(pts)
        norm=np.linalg.norm(emb)
        if norm>0:emb=emb/norm
        return emb.tolist()
vision=Vision()
