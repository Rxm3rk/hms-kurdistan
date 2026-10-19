"""Scratch generator for the WP-0.7 S2 catalogues (not part of the repository)."""
import io
import json
import re
import sys
import unicodedata

rows_path, messages_dir = sys.argv[1], sys.argv[2]
rows = {}
for line in io.open(rows_path, encoding="utf-8").read().splitlines():
    if not line.strip():
        continue
    parts = line.split("\t")
    assert len(parts) == 4, (len(parts), line[:60])
    key, en, ckb, ar = parts
    assert key not in rows, key
    rows[key] = {"en": en, "ckb": ckb, "ar": ar}

catalogues = {}
for locale in ("en", "ckb", "ar"):
    path = f"{messages_dir}/{locale}.json"
    catalogues[locale] = json.load(io.open(path, encoding="utf-8"))
    for key, texts in rows.items():
        assert key not in catalogues[locale], (locale, key)
        text = unicodedata.normalize("NFC", texts[locale])
        catalogues[locale][key] = text

bad = {"ckb": re.compile("[يكةى٠-٩۰-۹]"),
       "ar": re.compile("[یکە٠-٩۰-۹]")}
for locale, pattern in bad.items():
    for key, text in catalogues[locale].items():
        if key.startswith("language."):
            continue
        m = pattern.search(text)
        assert m is None, (locale, key, hex(ord(m.group(0))))


def dump(obj):
    return json.dumps(dict(sorted(obj.items())), ensure_ascii=False, indent=2) + "\n"


for locale, catalogue in catalogues.items():
    io.open(f"{messages_dir}/{locale}.json", "w", encoding="utf-8", newline="\n").write(dump(catalogue))
for locale in ("ckb", "ar"):
    io.open(f"{messages_dir}/review/{locale}.json", "w", encoding="utf-8", newline="\n").write(
        dump({key: "unreviewed" for key in catalogues[locale]})
    )
print(len(rows), "rows;", {k: len(v) for k, v in catalogues.items()})
