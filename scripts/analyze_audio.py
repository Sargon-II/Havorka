import sys
import os
import math
import struct
import json

def analyze_raw_or_wav(filepath):
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        return None
    
    size = os.path.getsize(filepath)
    print(f"Analyzing {filepath}: size={size} bytes")
    
    with open(filepath, 'rb') as f:
        data = f.read()

    # Check header
    header_preview = data[:32]
    print(f"Header preview (hex): {header_preview.hex()}")
    print(f"Header preview (ascii): {header_preview}")

    # If it's a WAV file, read PCM samples
    if data[:4] == b'RIFF':
        import wave
        with wave.open(filepath, 'rb') as wf:
            nchannels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            frames = wf.readframes(nframes)
            
            print(f"WAV: {nchannels}ch, {sampwidth}B/sample, {framerate}Hz, {nframes} frames ({nframes/framerate:.2f}s)")
            
            if sampwidth == 2:
                samples = struct.unpack(f"<{nframes * nchannels}h", frames)
                max_amp = max(abs(s) for s in samples) if samples else 0
                sum_sq = sum(s * s for s in samples) if samples else 0
                rms = math.sqrt(sum_sq / len(samples)) if samples else 0
                rms_db = 20 * math.log10(rms / 32767) if rms > 0 else -100
                print(f"Signal Max Amplitude: {max_amp} / 32767 ({max_amp/32767:.4f})")
                print(f"Signal RMS: {rms:.2f} ({rms/32767:.4f}, {rms_db:.1f} dBFS)")
                return {
                    'max_amp': max_amp,
                    'rms': rms,
                    'rms_db': rms_db,
                    'duration': nframes / framerate,
                    'is_silent': max_amp < 100
                }
    else:
        # For container formats like mp4/webm, we can inspect byte entropy / non-zero byte distribution
        # Non-zero audio payload bytes vs zeroes
        non_zero_bytes = sum(1 for b in data if b != 0)
        entropy = non_zero_bytes / size if size > 0 else 0
        print(f"Container format: size={size}, non_zero_ratio={entropy:.4f}")
        return {
            'size': size,
            'non_zero_ratio': entropy,
            'is_empty_or_too_small': size < 5000
        }

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'temp_test/chrome_recorded_audio.m4a'
    res = analyze_raw_or_wav(path)
    print("Result:", json.dumps(res, indent=2))
