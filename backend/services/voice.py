"""One offline microphone/STT owner. Browser STT must be off when this is active."""
import json,os,queue,threading
class OfflineVoice:
    def __init__(self):self.owner=None;self.stop_event=threading.Event();self.events=queue.Queue(maxsize=100);self.thread=None;self.error=None;self.model=None
    def start(self,owner):
        if self.thread and self.thread.is_alive():
            if self.owner!=owner:raise RuntimeError('Offline microphone is already in use.')
            return
        import vosk, sounddevice as sd
        path=os.getenv('VOSK_MODEL_PATH','models/vosk')
        if not os.path.isdir(path):raise RuntimeError('Offline STT model missing: '+path)
        self.model=vosk.Model(path);self.owner=owner;self.stop_event.clear();self.error=None
        def run():
            audio=queue.Queue(maxsize=50)
            def callback(data,frames,timing,status):
                try:audio.put_nowait(bytes(data))
                except queue.Full:pass
            try:
                rec=vosk.KaldiRecognizer(self.model,16000)
                with sd.RawInputStream(samplerate=16000,blocksize=4000,dtype='int16',channels=1,callback=callback):
                    while not self.stop_event.is_set():
                        try:data=audio.get(timeout=.3)
                        except queue.Empty:continue
                        if rec.AcceptWaveform(data):
                            value=json.loads(rec.Result()).get('text','')
                            if value:
                                try:self.events.put_nowait(value)
                                except queue.Full:pass
            except Exception as exc:self.error=str(exc)
            finally:self.owner=None
        self.thread=threading.Thread(target=run,daemon=True);self.thread.start()
    def stop(self,owner):
        if self.owner==owner:self.stop_event.set()
voice=OfflineVoice()
