"""Generates short sound effects as WAV files at first run and caches them
to disk, so the game has real audio without shipping any binary audio
assets. Uses only numpy + the stdlib 'wave' module.
"""

import os
import wave
import numpy as np

MIX_RATE = 22050  # lower sample rate = less CPU/disk on a Raspberry Pi 4

SFX_DEFS = {
    "dodge":         (900, 0.08, 0.35, "sine"),
    "jump":          (500, 0.12, 0.30, "square"),
    "attack":        (250, 0.09, 0.35, "noise"),
    "hit_player":    (140, 0.45, 0.50, "noise"),
    "flame":         (200, 0.30, 0.30, "noise"),
    "dragon_hit":    (120, 0.15, 0.40, "square"),
    "dragon_die":    (80,  1.10, 0.50, "noise"),
    "boss_incoming": (90,  0.70, 0.40, "square"),
    "victory1":      (523, 0.15, 0.35, "sine"),
    "victory2":      (659, 0.15, 0.35, "sine"),
    "victory3":      (784, 0.35, 0.40, "sine"),
    "explosion":     (100, 0.35, 0.45, "noise"),
    "punch_land":    (180, 0.10, 0.40, "square"),
    "ui_move":       (700, 0.05, 0.25, "sine"),
    "ui_select":     (1050, 0.10, 0.30, "sine"),
    "pause":         (440, 0.08, 0.25, "sine"),
}


def synth_tone(freq, duration, volume=0.4, wave_type="sine"):
    n = max(1, int(duration * MIX_RATE))
    t = np.arange(n) / MIX_RATE

    if wave_type == "sine":
        s = np.sin(2 * np.pi * freq * t)
    elif wave_type == "square":
        s = np.sign(np.sin(2 * np.pi * freq * t))
    elif wave_type == "noise":
        s = np.random.uniform(-1.0, 1.0, n)
    elif wave_type == "saw":
        s = 2.0 * (t * freq - np.floor(t * freq + 0.5))
    else:
        s = np.zeros(n)

    fade = max(1, int(0.02 * MIX_RATE))
    env = np.ones(n)
    env[:fade] = np.linspace(0.0, 1.0, fade)
    env[-fade:] = np.linspace(1.0, 0.0, fade)

    s = np.clip(s * volume * env, -1.0, 1.0)
    return (s * 32767).astype(np.int16)


def write_wav(path, samples):
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(MIX_RATE)
        f.writeframes(samples.tobytes())


def ensure_sfx_cached(sfx_dir):
    os.makedirs(sfx_dir, exist_ok=True)
    paths = {}
    for name, (freq, dur, vol, wave_type) in SFX_DEFS.items():
        path = os.path.join(sfx_dir, f"{name}.wav")
        if not os.path.exists(path):
            samples = synth_tone(freq, dur, vol, wave_type)
            write_wav(path, samples)
        paths[name] = path
    return paths
