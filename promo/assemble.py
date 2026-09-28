"""Turn the recorded frame sequences into the final 1080p30 promo with audio."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FF = os.environ.get('FFMPEG', 'ffmpeg')
FPS = 30
XF = 0.5  # crossfade length
BED_START = 110.0  # where c_player's audio was set to start in Scarlet Begonias
SILENT = '--silent' in sys.argv

def seg(name):
    return json.load(open(os.path.join(ROOT, 'seg', name, 'frames.json')))

# (name, trim_in, trim_out) relative to the segment's own start, None = full
d_c = seg('c_player')
cuts = [
    ('a_title', 0.0, 3.9),
    ('b_home', 0.0, None),
    ('c_player', d_c['marks']['audio'] - 0.4, d_c['marks']['audio'] + 11.2),
    ('d_video', 0.0, None),
    ('e_load', 0.2, seg('e_load')['marks']['click'] + 0.35),
    ('e_load', seg('e_load')['marks']['loaded'] - 0.6, seg('e_load')['marks']['loaded'] + 2.2),
    ('f_end', 0.0, None),
]

def run(args):
    subprocess.run([FF, '-loglevel', 'error', '-y', *args], check=True)

clips, lens = [], []
for n, (name, tin, tout) in enumerate(cuts):
    d = seg(name)
    fr, start, end = d['frames'], d['start'], d['end']
    lst = os.path.join(ROOT, 'seg', name, 'list.txt')
    with open(lst, 'w') as f:
        for i, x in enumerate(fr):
            t0 = start if i == 0 else x['t']
            t1 = fr[i + 1]['t'] if i + 1 < len(fr) else end
            f.write(f"file '{x['f']}'\nduration {max(t1 - t0, 0.001):.4f}\n")
        f.write(f"file '{fr[-1]['f']}'\n")
    tout = tout if tout is not None else end - start
    out = os.path.join(ROOT, 'seg', f'{n}_{name}.mp4')
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-ss', f'{tin:.3f}', '-t', f'{tout - tin:.3f}',
         '-vf', f'fps={FPS},scale=1920:1080,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', out])
    clips.append(out)
    lens.append(tout - tin)
    print(f'{name}: {tout - tin:.2f}s')

# Timeline start of each clip after crossfades.
starts = [0.0]
for L in lens[:-1]:
    starts.append(starts[-1] + L - XF)
total = starts[-1] + lens[-1]
print(f'total {total:.2f}s')

inputs = sum((['-i', c] for c in clips), [])
fc, prev = [], '[0:v]'
for i in range(1, len(clips)):
    lab = f'[v{i}]'
    fc.append(f'{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={starts[i]:.3f}{lab}')
    prev = lab

video_only = os.path.join(ROOT, 'video_only.mp4')
run([*inputs, '-filter_complex', ';'.join(fc), '-map', prev, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
     '-pix_fmt', 'yuv420p', '-r', str(FPS), '-movflags', '+faststart', video_only])

out = os.path.join(ROOT, 'playdead-promo' + ('-silent' if SILENT else '') + '.mp4')
if SILENT:
    os.replace(video_only, out)
    print(out); sys.exit()

# Music bed: Scarlet Begonias, aligned so the player's clock in c_player matches what you hear.
c_i = [c[0] for c in cuts].index('c_player')
d_i = [c[0] for c in cuts].index('d_video')
bed_offset = BED_START - (starts[c_i] + 0.4)
d0, d1 = starts[d_i], starts[d_i] + lens[d_i]
duck = (f"volume='if(between(t,{d0 - 0.4:.3f},{d1 - 0.1:.3f}),"
        f"max(0.08,1-min(t-{d0 - 0.4:.3f},{d1 - 0.1:.3f}-t)/0.5*0.92),1)':eval=frame")
afc = (f"[0:a]atrim=start={bed_offset:.3f}:duration={total:.3f},asetpts=PTS-STARTPTS,{duck},"
       f"afade=t=in:d=0.8,afade=t=out:st={total - 1.8:.3f}:d=1.8[bed];"
       f"[1:a]atrim=0:{lens[d_i]:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.35,afade=t=out:st={lens[d_i] - 0.45:.3f}:d=0.45,"
       f"adelay={int(d0 * 1000)}|{int(d0 * 1000)},apad[clip];"
       f"[bed][clip]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
run(['-i', os.path.join(ROOT, 'scarlet.mp3'), '-i', os.path.join(ROOT, 'clip1976.wav'), '-i', video_only,
     '-filter_complex', afc, '-map', '2:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
     '-shortest', '-movflags', '+faststart', out])
print(out)
