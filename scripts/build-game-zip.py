#!/usr/bin/env python3
"""Build the game-only update package: release/out/slide-game-<version>.zip + .sha256 + manifest.json.
Usage: build-game-zip.py [--launcher-json release/launcher.json] [--notes-file F]
Only the web game files are packaged (no Electron, no launcher, no docs/screenshots)."""
import argparse, hashlib, json, os, sys, zipfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_FILES = ['index.html', 'version.json']
INCLUDE_DIRS = ['css', 'js', 'fonts', 'assets']
SKIP_EXT = ('.md', '.map', '.DS_Store')

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--launcher-json', default=os.path.join(ROOT, 'release', 'launcher.json'))
    ap.add_argument('--notes-file')
    ap.add_argument('--out', default=os.path.join(ROOT, 'release', 'out'))
    a = ap.parse_args()
    version = json.load(open(os.path.join(ROOT, 'version.json')))['version']
    os.makedirs(a.out, exist_ok=True)
    name = f'slide-game-{version}.zip'
    zpath = os.path.join(a.out, name)
    files = list(INCLUDE_FILES)
    for d in INCLUDE_DIRS:
        for dp, _, fs in os.walk(os.path.join(ROOT, d)):
            for f in fs:
                if not f.endswith(SKIP_EXT):
                    files.append(os.path.relpath(os.path.join(dp, f), ROOT))
    files.sort()
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            zi = zipfile.ZipInfo(rel.replace(os.sep, '/'), date_time=(2026, 1, 1, 0, 0, 0))  # reproducible
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            with open(os.path.join(ROOT, rel), 'rb') as f:
                z.writestr(zi, f.read(), compresslevel=9)
    digest, size = sha256(zpath), os.path.getsize(zpath)
    open(zpath + '.sha256', 'w').write(f'{digest}  {name}\n')
    manifest = {'version': version, 'released': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'minLauncher': '1.0.0',
                'game': {'file': name, 'sha256': digest, 'size': size}}
    if a.notes_file and os.path.exists(a.notes_file):
        manifest['notes'] = open(a.notes_file, encoding='utf-8').read().strip()
    if os.path.exists(a.launcher_json):
        manifest['launcher'] = json.load(open(a.launcher_json))
    json.dump(manifest, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=2)
    print(f'{name}: {size/1048576:.2f} MB, {len(files)} files, sha256 {digest}')

if __name__ == '__main__':
    sys.exit(main())
