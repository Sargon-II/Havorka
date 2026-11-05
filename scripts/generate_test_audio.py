import wave
import math
import struct
import random
import os

def generate_test_wav(filepath, duration_sec=20, sample_rate=44100):
    num_samples = int(duration_sec * sample_rate)
    freq = 440.0
    amplitude = 16000 # ~0.5 of max 32767 for 16-bit PCM

    with wave.open(filepath, 'w') as wav_file:
        # 1 channel (mono), 2 bytes per sample (16-bit), sample_rate
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            t = i / sample_rate
            # 440 Hz sine wave + some light noise
            sine_val = math.sin(2.0 * math.pi * freq * t)
            noise_val = (random.random() * 2.0 - 1.0) * 0.1
            sample = int((sine_val * 0.9 + noise_val) * amplitude)
            sample = max(-32767, min(32767, sample))
            frames.extend(struct.pack('<h', sample))

        wav_file.writeframes(frames)
    
    print(f"Generated {filepath}: {duration_sec}s, {sample_rate}Hz, size={os.path.getsize(filepath)} bytes")

if __name__ == '__main__':
    os.makedirs('temp_test', exist_ok=True)
    generate_test_wav('temp_test/test_audio_440hz.wav', duration_sec=25)
