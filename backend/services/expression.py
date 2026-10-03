"""Optional expression-change check-in; explicitly NOT a pain classifier.
Uses a personal baseline plus sustained change and inactivity. False positives
and false negatives are possible; user voice reports always take precedence.
"""
import os,time,threading
from pathlib import Path
class ExpressionMonitor:
    def __init__(self):self.model=None;self.error=None;self.states={};self.lock=threading.Lock()
    def load(self):
        if self.model:return
        import mediapipe as mp
        path=os.getenv('FACE_LANDMARKER_PATH','models/face_landmarker.task')
        if not Path(path).exists():raise RuntimeError('Expression model missing: '+path)
        with self.lock:
            self.model=mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=path),running_mode=mp.tasks.vision.RunningMode.IMAGE,num_faces=1,output_face_blendshapes=True))
        self.error=None
    def analyze(self,key,image,active):
        if not self.model:return {'available':False,'check_in':False}
        import mediapipe as mp
        with self.lock:r=self.model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=image))
        if not r.face_blendshapes:return {'available':True,'face_visible':False,'check_in':False}
        scores={v.category_name:float(v.score) for v in r.face_blendshapes[0]}
        keys=['browDownLeft','browDownRight','eyeSquintLeft','eyeSquintRight','mouthStretchLeft','mouthStretchRight']
        value=sum(scores.get(k,0) for k in keys)/len(keys)
        state=self.states.setdefault(key,{'samples':[],'count':0,'last':0})
        if len(state['samples'])<20:
            state['samples'].append(value)
            return {'available':True,'calibrating':True,'check_in':False}
        baseline=sum(state['samples'])/len(state['samples'])
        changed=value>baseline+.2 and not active
        state['count']=state['count']+1 if changed else 0
        trigger=state['count']>=3 and time.monotonic()-state['last']>60
        if trigger:state['last']=time.monotonic();state['count']=0
        return {'available':True,'check_in':trigger,'expression_change':round(value-baseline,3),'method':'uncalibrated heuristic; not pain diagnosis'}
expression=ExpressionMonitor()
