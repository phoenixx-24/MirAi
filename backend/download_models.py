"""Download the official MediaPipe pose model with normal TLS verification."""
from pathlib import Path
from urllib.request import urlopen
import hashlib,sys
URL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'
# Source: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
filename='pose_landmarker.task'
if '--expression' in sys.argv:
    URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
    filename='face_landmarker.task'
path=Path(__file__).resolve().parent/'models'/filename
path.parent.mkdir(exist_ok=True)
if path.exists():
    print('Pose model already exists:',path)
else:
    temp=path.with_suffix('.download')
    try:
        with urlopen(URL,timeout=90) as response,temp.open('wb') as output:
            while chunk:=response.read(1024*1024):output.write(chunk)
        if temp.stat().st_size<100_000:raise RuntimeError('Downloaded file was unexpectedly small.')
        temp.replace(path)
        print('Saved:',path)
        print('SHA256:',hashlib.sha256(path.read_bytes()).hexdigest())
    except Exception as exc:
        temp.unlink(missing_ok=True)
        raise SystemExit('Model download failed. Check internet/certificates; do not disable TLS validation. '+str(exc))
