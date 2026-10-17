#!/usr/bin/env python3
"""Maintain exact local W6/W4/presentation factory embedding. Default is read-only --check.

Update shared sources and provenance after reviewing upstream changes, then use
--write to refresh the marked blocks. No network or package dependency.
"""
import argparse
import hashlib
import json
from pathlib import Path


def runtime(name, raw):
    if name == 'ha-tools-export.js':
        assert raw.count('export function createExportDialog(') == 1
        return raw.replace('export function createExportDialog(', 'function createExportDialog(', 1).rstrip()
    return raw.split('// Node tests use the canonical factory;')[0].rstrip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.write and args.check:
        parser.error('choose --write or --check')
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'shared/provenance.json').read_text())
    target = root / 'ha-data-exporter.js'
    text = target.read_text()
    problems = []
    for name, provenance in manifest['sources'].items():
        raw = (root / 'shared' / name).read_text()
        actual = hashlib.sha256((root / 'shared' / name).read_bytes()).hexdigest()
        if actual != provenance['sha256']:
            problems.append(f'{name}: source hash differs from reviewed provenance')
            continue
        begin, end = f'// BEGIN VENDORED {name}\n', f'\n// END VENDORED {name}'
        if text.count(begin) != 1 or text.count(end) != 1:
            problems.append(f'{name}: missing or duplicate boundary')
            continue
        first = text.index(begin) + len(begin)
        last = text.index(end, first)
        expected = runtime(name, raw)
        if text[first:last] != expected:
            if args.write:
                text = text[:first] + expected + text[last:]
            else:
                problems.append(f'{name}: embedded factory drift')
    if problems:
        raise SystemExit('\n'.join(problems))
    if args.write:
        target.write_text(text)
    print('Exact W6/W4/presentation factory bytes and provenance matched.')


if __name__ == '__main__':
    main()
