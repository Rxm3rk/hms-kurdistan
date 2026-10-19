"""Copy the build's working notes, briefs and helper scripts (outside any repo) into a staging folder for backup.

Skips copies of the repository, toolchains, virtualenvs, node_modules, binaries, big files and anything that
looks like a key or password. The staging folder is then committed and secret-scanned before upload.
"""
import fnmatch, os, shutil, sys

HOME = r'C:\Users\Surface'
TEMP = HOME + r'\AppData\Local\Temp'
DEST = TEMP + r'\hms-backup-ws\files'
PROJ = 'C--Users-Surface--t3-projects-hospitalmanagementsystem'

SKIP_TOP = ['hms-pdfcheck-venv', 'hms-wsl-src', 'hms-preview', 'hms-shallow-*', 'hms-safety-test-*', 'hms-signed-*',
            'hms-sigexp-*', 'hms-backup-ws']
SKIP_DIRS = {'node_modules', '.tools', '.git', 'venv', '.venv', '__pycache__', 'dist', '.gradle', 'fastclone', 'ft',
             '.pytest_cache', '.mypy_cache', 'scan'}
SKIP_EXT = {'.exe', '.msi', '.wsl', '.tar', '.gz', '.tgz', '.zip', '.jar', '.class', '.dll', '.so', '.pyc', '.whl',
            '.appx', '.vhdx', '.iso', '.7z', '.bin', '.lock'}
SECRETISH = ['*.key', '*.pem', '*.p12', '*.pfx', '*password*', '*passphrase*', '*cosign*', '*token*', '*credential*',
             '.env', '*.env', 'id_rsa*', 'id_ed25519*', '*.kubeconfig', 'kubeconfig*']
MAX = 5 * 1024 * 1024

copied = skipped = 0
def copy_tree(src, dst):
    global copied, skipped
    for root, dirs, files in os.walk(src):
        if os.path.exists(os.path.join(root, '.git')) and root != src:
            dirs[:] = []; skipped += 1; continue          # a nested clone of a repository
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            p = os.path.join(root, f); low = f.lower()
            if os.path.splitext(low)[1] in SKIP_EXT or any(fnmatch.fnmatch(low, g) for g in SECRETISH):
                skipped += 1; continue
            try:
                if os.path.getsize(p) > MAX: skipped += 1; continue
                out = os.path.join(dst, os.path.relpath(p, src)); os.makedirs(os.path.dirname(out), exist_ok=True)
                shutil.copy2(p, out); copied += 1
            except OSError:
                skipped += 1

if os.path.exists(DEST): shutil.rmtree(DEST)
for name in sorted(os.listdir(TEMP)):
    full = os.path.join(TEMP, name)
    if not os.path.isdir(full): continue
    if not (name.startswith(('hms-', 'hms_', 'wp0', 'wp1'))): continue
    if any(fnmatch.fnmatch(name, g) for g in SKIP_TOP): continue
    copy_tree(full, os.path.join(DEST, 'temp', name))
copy_tree(HOME + r'\AppData\Local\hms-snapshot', os.path.join(DEST, 'hms-snapshot'))
for prof in ('.claude-waybaba', '.claude-a7a', '.claude-sub', '.claude'):
    base = os.path.join(HOME, prof, 'projects', PROJ)
    if not os.path.isdir(base): continue
    if os.path.isdir(os.path.join(base, 'memory')):
        copy_tree(os.path.join(base, 'memory'), os.path.join(DEST, 'memory', prof))
    for sess in os.listdir(base):
        sc = os.path.join(base, sess, 'workflows', 'scripts')
        if os.path.isdir(sc):
            copy_tree(sc, os.path.join(DEST, 'workflow-scripts', prof, sess))
print('copied', copied, 'skipped', skipped)
