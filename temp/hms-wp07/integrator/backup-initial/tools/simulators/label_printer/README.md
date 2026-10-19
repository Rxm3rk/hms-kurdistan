# Label-printer simulator (capture endpoint)

A raw-port print endpoint that stands in for a wristband or label printer (BUILD-PROMPT.md §3.7: simulators
before partners; §12.8; `docs/specs/hal/README.md`, `hal.print.label`). It listens on TCP port 9100, the
port of raw ("JetDirect") printing, and stores every job it receives. It prints nothing, renders nothing and
answers nothing. WP-0.7 slice S8 built it, as the endpoint that the shell's simulated label printer
(slice S9) and WP-0.8's label tests can send their ZPL or PDF to. Python standard library only.

All data sent to it in this build is synthetic, NOT FOR CLINICAL USE (§18.10). It is not a store for real
labels: it keeps every job in plain files with no access control.

## Run

```sh
.tools/venv/bin/python -I tools/simulators/label_printer/capture.py --out build/label-printer
```

On the Windows checkout use `.tools/venv/Scripts/python.exe`. Options:

- `--host` (default `127.0.0.1`): a loopback address (`127.0.0.0/8`, `::1` or a name that resolves only to
  loopback addresses). Any other address, `0.0.0.0` and the empty string included, is refused with exit
  code 2, because the simulator stores whatever it receives with no access control. `--allow-non-loopback`
  lifts that check, with a warning on standard error; use it only on a closed test network;
- `--port` (default 9100);
- `--idle-timeout`: seconds of silence that end a job (default 10);
- `--max-job-bytes`: the largest job (default 32 MiB, the largest `hal.print.document` content);
- `--max-connections`: connections served at once (default 8); a connection beyond it is closed unread;
- `--max-jobs` and `--max-stored-bytes`: the jobs (default 10,000) and bytes (default 1 GiB) one run stores;
  a job beyond either is rejected whole.

It prints one line per job and stops on Ctrl-C. It exits with 2 when it cannot listen, for example when the
port is taken or the host is not a loopback address.

## What it stores

One TCP connection is one job, as on a raw-port printer. A job ends when the sender closes the connection or
sends nothing for the idle timeout. Each job becomes two files in the output directory:

| File | Content |
|---|---|
| `job-NNNNNN.zpl`, `job-NNNNNN.pdf` or `job-NNNNNN.bin` | The bytes exactly as received. `.zpl` when the job holds a ZPL label format (`^XA` … `^XZ`), `.pdf` when it starts with `%PDF-`, `.bin` for anything else (an ESC/POS job, for example) |
| `job-NNNNNN.json` | `job`, `file`, `format` (`zpl`, `pdf` or `unknown`), `byteLength`, `sha256`, `receivedAt` (UTC) and `provenance: simulator` |

The sidecar is written after the job file, and each file is written to a temporary name and then renamed, so
a sidecar always means a complete job. A job's number is reserved by creating `job-NNNNNN.part` exclusively,
and a number is never used while any file of it exists: a job file, a sidecar, or a `.part` or `.json.tmp`
file that an interrupted run left behind (delete those by hand when no simulator is running). So neither a
restart nor a second simulator on the same directory overwrites a job, although one output directory is
meant for one simulator. A connection that sends nothing stores nothing; a job larger than `--max-job-bytes`,
or beyond `--max-jobs` or `--max-stored-bytes`, is dropped whole and counted, never stored in part.

## Limits

- It does not answer printer status queries (`~HS` and the like) and does not check that the ZPL is valid.
  Shaping of Sorani and Arabic text on real printers is S7-K; no physical printer has been tested (KA-035).
- It is not the site print service that §12.8 names as the fallback without the shell (KA-028).

## Tests

`tests/test_printer_capture.py` (`test_printer_capture` in `docs/specs/modules/design-system.md` §9) runs with
the other tool tests: `.tools/venv/bin/python -I -m unittest discover -s tools -t tools -p "test_*.py"`. The
tests listen on an ephemeral loopback port, never on 9100, and send the ZPL of the contract fixture
`docs/specs/hal/fixtures/hal.print.label.ok.json`.
