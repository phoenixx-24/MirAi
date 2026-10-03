"""MirAi Fitness Platform Launcher.
Automatically verifies/installs dependencies if missing and launches both backend and frontend services.
"""
from pathlib import Path
import subprocess, sys, os, time, webbrowser, shutil

ROOT = Path(__file__).resolve().parent
python = ROOT / 'backend' / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
next_bin = ROOT / 'node_modules' / 'next' / 'dist' / 'bin' / 'next'

def ensure_environment():
    """Verify dependencies and set up missing components automatically."""
    needs_setup = not python.exists() or not next_bin.exists()
    
    if needs_setup:
        print("=" * 60)
        print(" [MirAi] Initializing setup: missing dependencies detected...")
        print("=" * 60)
        
        # 1. Ensure backend .env exists
        backend_env = ROOT / 'backend' / '.env'
        backend_env_example = ROOT / 'backend' / '.env.example'
        if not backend_env.exists() and backend_env_example.exists():
            print("[Setup] Creating backend/.env from .env.example...")
            shutil.copyfile(backend_env_example, backend_env)

        # 2. Create virtualenv and install pip packages if missing
        if not python.exists():
            print(f"[Setup] Creating virtual environment at {ROOT / 'backend' / '.venv'}...")
            subprocess.check_call([sys.executable, '-m', 'venv', str(ROOT / 'backend' / '.venv')])
            print("[Setup] Upgrading pip and installing backend requirements...")
            subprocess.check_call([str(python), '-m', 'pip', 'install', '--upgrade', 'pip'])
            req_file = ROOT / 'backend' / 'requirements.txt'
            if req_file.exists():
                subprocess.check_call([str(python), '-m', 'pip', 'install', '-r', str(req_file)])
            req_games = ROOT / 'backend' / 'requirements-games.txt'
            if req_games.exists():
                subprocess.check_call([str(python), '-m', 'pip', 'install', '-r', str(req_games)])

        # 3. Ensure AI models are downloaded
        pose_model = ROOT / 'backend' / 'models' / 'pose_landmarker.task'
        if not pose_model.exists():
            print("[Setup] Downloading AI models...")
            download_script = ROOT / 'backend' / 'download_models.py'
            if download_script.exists():
                try:
                    subprocess.check_call([str(python), str(download_script)], cwd=ROOT / 'backend')
                    subprocess.check_call([str(python), str(download_script), '--expression'], cwd=ROOT / 'backend')
                except Exception as e:
                    print(f"[Setup] Note: Model download warning: {e}")

        # 4. Install npm dependencies if missing
        if not next_bin.exists():
            print("[Setup] Installing frontend dependencies (npm install)...")
            npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'
            try:
                subprocess.check_call([npm_cmd, 'install'], cwd=ROOT)
            except Exception:
                print("[Setup] Retrying npm install with --legacy-peer-deps...")
                subprocess.check_call([npm_cmd, 'install', '--legacy-peer-deps'], cwd=ROOT)

        print("[Setup] Environment ready!\n")

def main():
    ensure_environment()

    os.environ['FITNESS_DESKTOP_GAMES'] = '1'
    processes = []
    
    print("=" * 60)
    print(" Starting MirAi Fitness Platform...")
    print(" Backend:  http://127.0.0.1:8000")
    print(" Frontend: http://localhost:3000")
    print(" Press Ctrl+C in this window to stop all services.")
    print("=" * 60)

    try:
        # Launch backend FastAPI server
        processes.append(subprocess.Popen(
            [str(python), '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'],
            cwd=ROOT / 'backend'
        ))
        
        # Launch frontend Next.js server
        processes.append(subprocess.Popen(
            ['node', str(ROOT / 'node_modules' / 'next' / 'dist' / 'bin' / 'next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
            cwd=ROOT
        ))
        
        # Poll until frontend is accessible
        import urllib.request
        print("[MirAi] Waiting for frontend server to be ready...")
        for _ in range(60):
            try:
                urllib.request.urlopen('http://localhost:3000', timeout=1)
                break
            except Exception:
                time.sleep(1)
                
        print("[MirAi] Opening application in browser...")
        webbrowser.open('http://localhost:3000')
        
        while all(p.poll() is None for p in processes):
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[MirAi] Shutting down services...")
    finally:
        for p in processes:
            p.terminate()
            try:
                p.wait(timeout=3)
            except Exception:
                p.kill()

if __name__ == '__main__':
    main()
