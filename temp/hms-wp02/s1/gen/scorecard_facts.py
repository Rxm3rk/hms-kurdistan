"""Scratch: dependency-scorecard facts from the GitHub REST API (same method as the ADR-029 rows), 3 calls a repo."""
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

REPOS = sys.argv[1:]
NOW = datetime(2026, 10, 19, tzinfo=timezone.utc)


def get(path):
    req = urllib.request.Request("https://api.github.com" + path, headers={"Accept": "application/vnd.github+json",
                                                                          "User-Agent": "hms-scorecard"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


for repo in REPOS:
    try:
        meta = get(f"/repos/{repo}")
        rels = get(f"/repos/{repo}/releases?per_page=100")
        contrib = get(f"/repos/{repo}/contributors?per_page=100")
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"repo": repo, "error": str(exc)}))
        continue
    year = [r for r in rels if not r["draft"] and not r["prerelease"] and r.get("published_at")
            and datetime.fromisoformat(r["published_at"].replace("Z", "+00:00")) >= NOW - timedelta(days=365)]
    ga = [r for r in rels if not r["draft"] and not r["prerelease"] and r.get("published_at")]
    latest = max((r["published_at"][:10] for r in ga), default=None)
    counts = sorted((c["contributions"] for c in contrib), reverse=True)
    total = sum(counts) or 1
    acc, half = 0, 0
    for c in counts:
        acc += c
        half += 1
        if acc * 2 >= total:
            break
    print(json.dumps({
        "repo": repo, "license": (meta.get("license") or {}).get("spdx_id"), "owner_type": meta["owner"]["type"],
        "created": meta["created_at"][:10], "pushed": meta["pushed_at"][:10], "stars": meta["stargazers_count"],
        "releases_last_365d": len(year), "releases_page_full": len(rels) == 100, "latest_release": latest,
        "contributors_listed": len(counts), "top1_share_pct": round(100 * counts[0] / total, 1) if counts else None,
        "top3_share_pct": round(100 * sum(counts[:3]) / total, 1) if counts else None, "authors_for_50pct": half,
    }))
