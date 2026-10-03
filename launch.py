"""Double-click start.bat after the one-time README setup. No terminal menus."""
from pathlib import Path
import subprocess,sys,os,time,webbrowser
ROOT=Path(__file__).resolve().parent
python=ROOT/'backend'/'.venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
if not python.exists():
    print('Setup required: follow README.md to install the local service.');sys.exit(1)
if not (ROOT/'node_modules/next/dist/bin/next').exists():
    print('Frontend dependencies missing. Run npm install once.');sys.exit(1)
os.environ['FITNESS_DESKTOP_GAMES']='1'
processes=[]
try:
    processes.append(subprocess.Popen([str(python),'-m','uvicorn','main:app','--host','127.0.0.1','--port','8000','--reload'],cwd=ROOT/'backend'))
    processes.append(subprocess.Popen(['node',str(ROOT/'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3000'],cwd=ROOT))
    import urllib.request
    for _ in range(60):
        try:urllib.request.urlopen('http://localhost:3000',timeout=1);break
        except Exception:time.sleep(1)
    webbrowser.open('http://localhost:3000')
    while all(p.poll() is None for p in processes):time.sleep(1)
except KeyboardInterrupt:pass
finally:
    for p in processes:p.terminate()
