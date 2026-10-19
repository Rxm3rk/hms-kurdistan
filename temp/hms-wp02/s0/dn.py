"""S0: DECISIONS-NEEDED.md entries (DN-005 update, DN-013 measured update, DN-015, DN-016)."""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)


rep(
    "1. **DN-005** The lite cell cannot show WP-0.2's single-node-loss criterion: choose how it will be met. WP-0.2 starts now on the default.",
    "1. **DN-005** The lite cell as §5.1 defines it (two PostgreSQL instances) cannot show WP-0.2's single-node-loss criterion: choose how it will be met. WP-0.2 runs on the default in use since 19 October 2026, three small PostgreSQL instances inside the lite cell (option 4), with every result labelled \"lite\".",
)
rep(
    "Next to block (not \"now\"): DN-013 when WP-0.2 pulls the cell's images;",
    "Next to block (not \"now\"): DN-013 if C: falls below 15 GiB free while WP-0.2 pulls the cell's images (29.3 GiB free on 19 October 2026); DN-015 and DN-016 if the cell's nightly runs prove unreliable on the defaults;",
)

# DN-005
rep(
    "- **Default in use:** the lite cell (§5.1: one Kafka broker, two PostgreSQL instances, no Argo CD), with every result from it labelled \"lite\".\n- **Update (18 October 2026, after DN-001):**",
    "- **Default in use:** until 19 October 2026, the lite cell as §5.1 defines it (one Kafka broker, two PostgreSQL instances, no Argo CD); since then option 4 below (three small PostgreSQL instances inside the lite cell; see the update of 19 October 2026). Every result from the lite cell is labelled \"lite\".\n- **Update (18 October 2026, after DN-001):**",
)
rep(
    "- **Who decides:** the human lead.\n- **Context:** the host has 15.6 GB RAM and 8 logical cores.",
    "- **Update (19 October 2026).** **Default in use until the human answers:** the lite cell runs three small PostgreSQL instances with quorum synchronous replication (option 4), with one Kafka broker and no Argo CD as §5.1 defines; every result from it is labelled \"lite\".\n"
    "  - **Why.** Two instances cannot show the single-node-loss criterion at all. Three are planned to fit the 10 GB VM: the WP-0.2 plan estimates about 5.4 GiB for the cell and 5.9 GiB for the whole VM, an estimate and not a measurement; the footprint test measures it (`docs/program/evidence/perf/`), and the figure is added here when a record exists. The change departs from §5.1's lite-cell definition by adding a PostgreSQL instance; it does not weaken any criterion.\n"
    "  - **Status of the criterion until you choose.** The node-kill evidence is recorded and labelled lite. WP-0.2's third exit criterion is reported as \"shown on the lite cell (three instances, DN-005 option 4, pending)\", not as met.\n"
    "  - **Your options.** Option 1: the records stay on file as indicative, and the criterion stays open (OQ-084). Options 2 and 3: the same commands run again on the larger host or on the reference cell. Option 4: you approve the three-instance lite cell and say whether its evidence meets the criterion.\n"
    "  - **What the lite evidence cannot show.** Hardware faults (the nodes share one kernel, disk and power supply), clock skew between nodes, real network latency, and RTO on reference hardware (KA-014).\n"
    "- **Who decides:** the human lead.\n- **Context:** the host has 15.6 GB RAM and 8 logical cores.",
)
rep(
    "  1. **Accept the lite cell** (default) and leave the three-instance failover evidence open",
    "  1. **Accept the lite cell** (the default until 19 October 2026) and leave the three-instance failover evidence open",
)
rep(
    "  4. Approve running three small PostgreSQL instances inside the lite cell. This departs from §5.1's lite-cell definition, so it needs the human's decision.",
    "  4. Approve running three small PostgreSQL instances inside the lite cell (the default in use since 19 October 2026, pending this decision). This departs from §5.1's lite-cell definition, so it needs the human's decision.",
)

# DN-013
rep(
    "- **Who decides:** the host owner.\n- **Context:** the WSL2 virtual disk (`ext4.vhdx`, 8.9 GB on 18 October 2026)",
    "- **Update (19 October 2026, measured on the WSL build host and the Windows host):**\n"
    "  - C: had 29.33 GiB free (31,488,036,864 bytes, `df -B1 /mnt/c` in WSL; Windows reported the same), and the WSL virtual disk `ext4.vhdx` had grown to 20.67 GiB (22,191,013,888 bytes; 8.9 GB on 18 October).\n"
    "  - Clearing the WP-0.2 prototype (the k3d cluster `hms-proto` and the five images no pin uses: RustFS 1.0.3, versitygw v1.4.1, CloudNativePG 1.27.1, the Strimzi 0.48.0 operator and Valkey 8.1) reduced Docker's images from 2.533 GB to 1.134 GB and its volumes from 3.766 GB (13 volumes) to none (`docker system df`). It freed nothing on C: (`df -h /mnt/c`: 30G available before and after), because the virtual disk does not shrink when files inside it are deleted.\n"
    "  - The 15 GiB stop line [P] is to be enforced by the cell tooling: `cell images mirror` and `cell up` will refuse to pull or create volumes below it (WP-0.2 slices S1 and S7; not built yet). Until then the cell owner checks `df -h /mnt/c` before every pull.\n"
    "- **Who decides:** the host owner.\n- **Context:** the WSL2 virtual disk (`ext4.vhdx`, 8.9 GB on 18 October 2026)",
)

s = s.rstrip("\n") + "\n" + """
## DN-015: WSL stops the distribution when it is idle, which powers off the whole cell [HUMAN]

- **Status:** open
- **Blocks:** nothing now; later, how reliable the cell's nightly runs are (WP-0.2's nightly chaos and cell steps, §18.7, §19.1)
- **Default in use:** during a cell session the cell owner keeps a detached keeper process running from Windows, and stops it at the end of the session: `Start-Process -WindowStyle Hidden wsl.exe -ArgumentList '-d','Ubuntu-24.04','--exec','sleep','infinity'`. The cell is created with fixed node addresses (OQ-122), so that a termination is survivable: the cell then restarts as after a power cut (KA-022), which the restart test R1 checks. The build agent changes no WSL setting (§3.4 item 9).
- **Who decides:** the host owner.
- **Context:** the planning session's read-only inspection of the systemd journal found that WSL stopped the distribution five times on 18 October 2026 between 17:47 and 21:40 (`InitTerminateInstanceInternal … calling reboot(RB_POWER_OFF)`); two boots lasted only 27 s and 25 s, which fits idle termination after the last `wsl.exe` exits. Each stop kills all three k3d nodes at once. The WP-0.2 prototype cluster then came back with its node addresses swapped, and its embedded etcd lost quorum; the prototype is not evidence and was deleted on 19 October 2026. Microsoft's WSL settings page (`learn.microsoft.com/windows/wsl/wsl-config`, updated 16 October 2026) documents two idle timers in `%UserProfile%\\.wslconfig`: `instanceIdleTimeout` in `[general]`, the milliseconds a distribution may be idle before it is shut down (default 15000; -1 disables it), and `vmIdleTimeout` in `[wsl2]`, the milliseconds the VM may be idle before it is shut down (default 60000; Windows 11 only).
- **Options:**
  1. **Keep the default** (the keeper process during cell sessions, fixed node addresses). Every termination outside a session is still a whole-cell power cut.
  2. **Turn off idle shutdown of the distribution** in `%UserProfile%\\.wslconfig`, then run `wsl --shutdown`:

     ```ini
     [general]
     instanceIdleTimeout=-1
     ```

     The VM then keeps its memory (up to the 10 GB limit) until `wsl --shutdown` or a Windows restart. Check with `wsl --version` that the installed WSL (2.6.3 on 18 October 2026) supports the key, and Microsoft's page for its current name.
  3. Option 2, and run the nightly tier only while the keeper process is up.

## DN-016: `fs.inotify.max_user_instances` is 128 in WSL [HUMAN]

- **Status:** open
- **Blocks:** nothing now; the cell, if k3s or a pod fails with "too many open files"
- **Default in use:** continue with 128. If k3s or a pod logs "too many open files", work on the cell stops and this item moves to "Blocking now". The build agent changes no system setting (§3.4 item 9).
- **Who decides:** the host owner.
- **Context:** read in WSL on 19 October 2026: `fs.inotify.max_user_instances = 128`, `fs.inotify.max_user_watches = 524288`. The three k3s nodes run as containers on the VM's one kernel, so their kubelets, containerd instances and pods share the per-user inotify instance limit; clusters of several nodes on one host are known to exhaust 128.
- **Options:**
  1. **Raise the limit to 512 and keep it across restarts** (in Ubuntu):

     ```sh
     sudo sysctl -w fs.inotify.max_user_instances=512
     echo 'fs.inotify.max_user_instances = 512' | sudo tee /etc/sysctl.d/90-hms-inotify.conf
     ```

  2. **Keep 128** (default) and act only if the error appears.
"""
open(p, "w", encoding="utf-8", newline="\n").write(s)
