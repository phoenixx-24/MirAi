from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root=Path(__file__).resolve().parents[1]
target=root/'public'/'ai-fitness-source.zip'
skip={'node_modules','.git','.next','.vinext','.wrangler','.sites-runtime','dist','.venv','__pycache__','.pytest_cache','examples','.agents','.codex'}
with ZipFile(target,'w',ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if not p.is_file() or any(part in skip for part in p.relative_to(root).parts):continue
        if p.suffix in {'.zip','.log','.sqlite','.sqlite3','.db','.tsbuildinfo','.pyc'}:continue
        if p.name.startswith('.env') and p.name!='.env.example':continue
        if 'backend/models' in str(p) and p.name not in {'README.md','pose_landmarker.task'}:continue
        rel=p.relative_to(root)
        if str(rel)=='.openai/hosting.json':z.writestr('ai-fitness/'+str(rel),json.dumps({'d1':None,'r2':None}));continue
        z.write(p,'ai-fitness/'+str(rel))
print(str(target))
print(str(target.stat().st_size)+' bytes')
