#!/usr/bin/env python3
"""Fetch unmodified, OFL-licensed logo fonts from the official Google Fonts repo."""
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent.parent / 'public' / 'fonts'
root.mkdir(parents=True, exist_ok=True)
base = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
files = {
    'manrope/Manrope%5Bwght%5D.ttf': 'manrope-variable.ttf',
    'manrope/OFL.txt': 'Manrope-OFL.txt',
    'sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf': 'source-serif-4-variable.ttf',
    'sourceserif4/OFL.txt': 'Source-Serif-4-OFL.txt',
}
for source, name in files.items():
    with urlopen(base + source, timeout=45) as response:
        data = response.read()
    if name.endswith('.txt') and b'SIL OPEN FONT LICENSE' not in data:
        raise ValueError('Unexpected licence response: ' + name)
    if name.endswith('.ttf') and data[:4] not in (b'\x00\x01\x00\x00', b'OTTO'):
        raise ValueError('Unexpected font response: ' + name)
    (root / name).write_bytes(data)
    print('Saved', name, len(data), 'bytes')
