"""Rough coverage simulation of MedicationAdministrationArbs at the predicate level (scratch, not evidence).

Approximates the generator's aspects and perturbations as predicate-level breaks, runs the harness's sequence loop
(1..32 steps, 0.85 applicable bias) and counts firings per transition over 1,000 sequences, repeated.
"""
import random

W = lambda r, *ws: (lambda x: next(i for i, c in enumerate(__import__("itertools").accumulate(ws)) if x < c))(r.randrange(sum(ws)))

T = [  # (from, command, guard-key, to)
    ("S", "Give", "give", "C"),
    ("S", "StartInfusion", "start", "I"),
    ("S", "GiveWithOverride", "g_scan", "C"),
    ("S", "GiveWithOverride", "g_verif", "C"),
    ("S", "GiveWithOverride", "g_band", "C"),
    ("S", "StartInfusionWithOverride", "i_scan", "I"),
    ("S", "StartInfusionWithOverride", "i_verif", "I"),
    ("S", "StartInfusionWithOverride", "i_band", "I"),
    ("S", "RecordOfflineAdministration", "off_g", "C"),
    ("S", "RecordOfflineAdministration", "off_i", "I"),
    ("S", "BackEnterAdministration", "back", "C"),
    ("S", "NotDone", "notdone", "N"),
    ("I", "NotDone", "notdone", "N"),
    ("I", "Complete", "clin", "C"),
    ("I", "Stop", "clin", "X"),
    ("S", "OrderEnded", "ended", "N"),
    ("I", "OrderEnded", "ended", "I"),
    ("S", "LateDoseWindowElapsed", "late_admin", "S"),
    ("S", "LateDoseWindowElapsed", "late_hold", "N"),
    ("*", "MarkEnteredInError", "eie", "E"),
]
STATES = ["S", "I", "C", "N", "X", "E"]
COMMANDS = ["DoseFallsDue", "Give", "StartInfusion", "GiveWithOverride", "StartInfusionWithOverride", "RecordOfflineAdministration",
            "BackEnterAdministration", "NotDone", "Complete", "Stop", "OrderEnded", "LateDoseWindowElapsed", "MarkEnteredInError"]


def cands(state, cmd):
    return [i for i, t in enumerate(T) if t[1] == cmd and (t[0] == state or (t[0] == "*" and state != t[3]))]


def facts(r):
    inf = r.random() < 0.6
    scen = W(r, 32, 16, 17, 15, 8, 12)  # 0 normal 1 scanfail 2 verif 3 bandfail 4 hold 5 ended
    mode = W(r, 64, 6, 5, 13, 2, 2, 2, 2, 2, 1, 1)
    ha = W(r, 58, 28, 7, 7) != 0
    notdone = r.random() < 0.20
    cmdpriv = r.random() < 0.45
    err = r.random() < 0.55
    backdoc = W(r, 30, 20, 8, 8, 5, 10, 10, 5, 4) in (0, 4)
    late = W(r, 35, 50, 5, 10) == 1
    clinical = r.random() < 0.45
    level = W(r, 50, 32, 18)
    P = list(range(14))
    if level == 0:
        chosen = []
    elif level == 1:
        chosen = [r.choice(P)]
    else:
        chosen = [p for p in P if r.random() < 0.25]
    b = {k: False for k in ["order", "first", "emerg", "dose", "match", "unus", "manual", "ident", "notid", "supply", "amount",
                            "content", "ha", "priv", "clinx", "time", "reason_s", "reason_v", "reason_b"]}
    for p in chosen:
        v = r.random()
        if p == 0: b["order"] = True
        elif p == 1: b["first"] = v < 5 / 6
        elif p == 2: b["emerg"] = True
        elif p == 3: b["dose"] = v < 0.75
        elif p == 4:
            b["match"] = v < 8 / 12
            b["unus"] = v < 9 / 12
        elif p == 5: b["manual"] = v < 8 / 9
        elif p == 6:
            b["ident"] = v < 3.5 / 12
            b["notid"] = v < 10 / 12
        elif p == 7: b["supply"] = v < (4 / 9 if scen != 1 else 8 / 9)
        elif p == 8: b["amount"] = v < 0.8
        elif p == 9: b["content"] = v < 0.9
        elif p == 10:
            ha = True
            b["ha"] = v < 0.85
        elif p == 11:
            b["priv"] = True
            b["clinx"] = v < 0.6
        elif p == 12: b["time"] = v < 5 / 7
        elif p == 13:
            b["reason_s"] = v > 1 / 8 * 1 and not (v < 1 / 8)
            b["reason_v"] = not (1 / 8 <= v < 2 / 8)
            b["reason_b"] = not (2 / 8 <= v < 3 / 8)
    envelope = mode != 10
    active = scen in (0, 1, 3) and not b["order"]
    awaiting = scen == 2 and not b["order"]
    administrable = scen in (0, 1, 2, 3)
    onhold = scen == 4
    ended = scen == 5
    online = mode in (0, 1, 2)
    offline_ok = online or (mode == 3 and scen != 2)
    synced = mode in (3, 4, 5, 8)
    contemp = envelope and not b["time"]
    priv = not b["priv"]
    clin = clinical and not b["clinx"]
    match = scen != 3 and not b["match"]
    unus = scen == 3 and not b["unus"]
    manual = not b["manual"]
    ident = scen != 1 and not b["ident"]
    notid = scen == 1 and not b["notid"]
    supply = not b["supply"]
    amount = not b["dose"] and not b["amount"]
    content = not b["content"]
    hacheck = (not ha) or (not b["ha"] and envelope)
    first = not b["first"]
    emerg = not b["emerg"]
    common = priv and contemp and hacheck and supply and offline_ok
    g = {
        "give": common and active and not inf and match and ident and amount,
        "start": common and active and inf and match and ident and content,
        "g_scan": common and active and not inf and match and notid and amount and not b["reason_s"],
        "g_verif": common and awaiting and emerg and first and not inf and match and ident and amount and not b["reason_v"],
        "g_band": common and active and not inf and unus and manual and ident and amount and not b["reason_b"],
        "i_scan": common and active and inf and match and notid and content and not b["reason_s"],
        "i_verif": common and awaiting and emerg and first and inf and match and ident and content and not b["reason_v"],
        "i_band": common and active and inf and unus and manual and ident and content and not b["reason_b"],
        "off_g": synced and priv and not inf,
        "off_i": synced and priv and inf,
        "back": cmdpriv and backdoc and manual,
        "notdone": priv and notdone,
        "clin": clin,
        "ended": ended,
        "late_admin": late and administrable,
        "late_hold": late and onhold,
        "eie": cmdpriv and err,
    }
    return g


def run(seed):
    r = random.Random(seed)
    fired = [0] * len(T)
    applicable = {s: [c for c in COMMANDS if cands(s, c)] for s in STATES}
    for _ in range(1000):
        state = "S"
        for _ in range(r.randint(1, 32)):
            pool = applicable[state] if applicable[state] and r.random() < 0.85 else COMMANDS
            cmd = r.choice(pool)
            g = facts(r)
            hits = [i for i in cands(state, cmd) if g[T[i][2]]]
            assert len(hits) <= 1, (state, cmd, hits)
            if hits:
                fired[hits[0]] += 1
                state = T[hits[0]][3]
    return fired


if __name__ == "__main__":
    runs = [run(s) for s in range(20)]
    for i, t in enumerate(T):
        counts = [x[i] for x in runs]
        print(f"{i:2} {t[0]} {t[1]:28} {t[2]:10} min {min(counts):4} mean {sum(counts) / len(counts):7.1f}")
