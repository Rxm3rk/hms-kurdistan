"""Structural lint for the assembled BUILD-PROMPT markdown.

Checks: table column counts, heading level jumps, duplicate headings,
relative links to files that do not exist, unbalanced code fences,
and stray placeholder markers (TODO, TBD, XXX, ???).

Usage: python -I lint_md.py <assembled.md> <repo-root>
"""
import os
import re
import sys


def split_row(line):
    # Drop code spans first so pipes inside `...` do not count as cells.
    s = re.sub(r"`[^`]*`", "C", line.strip())
    s = s.replace("\\|", "P")
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return s.split("|")


def main(path, repo):
    lines = open(path, encoding="utf-8").read().split("\n")
    problems = []
    in_fence = False
    fence_open_line = 0
    prev_level = 0
    seen = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            fence_open_line = i + 1
            i += 1
            continue
        if in_fence:
            i += 1
            continue
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            if prev_level and level > prev_level + 1:
                problems.append(f"L{i+1}: heading jumps from h{prev_level} to h{level}: {line[:80]}")
            prev_level = level
            key = m.group(2).strip().lower()
            if key in seen:
                problems.append(f"L{i+1}: duplicate heading (first at L{seen[key]}): {line[:80]}")
            else:
                seen[key] = i + 1
        # Tables: header row followed by a separator row.
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{3,}", lines[i + 1]):
            ncols = len(split_row(line))
            nsep = len(split_row(lines[i + 1]))
            if nsep != ncols:
                problems.append(f"L{i+2}: separator has {nsep} cells, header has {ncols}")
            j = i + 2
            while j < len(lines) and lines[j].strip().startswith("|"):
                n = len(split_row(lines[j]))
                if n != ncols:
                    problems.append(f"L{j+1}: row has {n} cells, header has {ncols}: {lines[j][:70]}")
                j += 1
            i = j
            continue
        for lm in re.finditer(r"\]\(([^)#\s]+)(#[^)]*)?\)", line):
            target = lm.group(1)
            if re.match(r"^[a-z]+:", target):
                continue
            if not os.path.exists(os.path.join(repo, target)):
                problems.append(f"L{i+1}: link target missing in repo: {target}")
        if re.search(r"\b(TODO|TBD|XXX|FIXME)\b|\?\?\?", line):
            problems.append(f"L{i+1}: placeholder marker: {line.strip()[:80]}")
        i += 1
    if in_fence:
        problems.append(f"L{fence_open_line}: code fence never closed")
    for p in problems:
        print(p)
    print(f"{len(problems)} problem(s); {len(lines)} lines; {len(seen)} headings")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
