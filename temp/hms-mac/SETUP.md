# Part 2: Mac setup (done once, by the first Mac thread)

Work in `~/src/hms-kurdistan`. Never edit the Windows machine's files; you can't reach them anyway. Everything you need is in this pack (`git show FETCH_HEAD:<file>` after `git fetch origin refs/hms/mac-handoff`).

1. **Identity and base branch.**
   ```
   cd ~/src/hms-kurdistan
   git config user.name "Ahmad"
   git config user.email "ahmad@digitalvision2.store"
   git switch wp/0.1-programme-bootstrap
   ```
   The `main` branch is older. Every stream branch is stacked on `wp/0.1-programme-bootstrap` at `09afa41`.
2. **Toolchain.** `sh tools/bootstrap all` fetches the pinned toolchain into `.tools/`: the JDK for mac aarch64, Gradle, gitleaks, the Python 3.12 venv and the pnpm install. Each download is checked against its pinned SHA-256. If a step fails, read its message, fix the host (for example a missing Homebrew package), and run it again. Never edit the pins to make it pass.
3. **Doctor.** Run `sh tools/doctor` and record its output. Docker, k3d and WSL items will be missing; that is expected, because the Mac doesn't run the server cell.
4. **Heavy-run limiter.** At most two heavy runs at once on this Mac.
   ```
   mkdir -p ~/hms-lock
   git show FETCH_HEAD:heavy.sh > ~/hms-lock/heavy.sh
   chmod +x ~/hms-lock/heavy.sh
   ```
   Run every full fast tier and every Gradle invocation through it:
   ```
   sh ~/hms-lock/heavy.sh <label> sh tools/ci/run fast --no-evidence
   ```
5. **Baseline fast tier** on the clean base branch:
   ```
   sh ~/hms-lock/heavy.sh mac-setup sh tools/ci/run fast --no-evidence 2>&1 | tee ~/.hms-snapshot/mac-baseline.log
   ```
   Create `~/.hms-snapshot` first. Label the result "Mac host, not evidence of record".
   - Some steps may fail on a clean checkout only because the host is macOS, for example a check that expects Linux or Windows. List each one, with its output, in `~/.hms-snapshot/mac-baseline.txt`.
   - The streams may then commit when every other step passes and the failing steps match this baseline exactly. They must say so in each commit message and in STATUS.md.
   - Never change repository code during setup to make a step pass. Note the fix the stream should propose instead.
6. **Auto-save, every 10 minutes.** It saves the uncommitted work of the stream worktrees under `refs/wip/<branch>`. It uploads the stream branches, never forced, and those saves as `refs/wip/mac/*` to GitHub, after a clean secret scan.
   ```
   git show FETCH_HEAD:snapshot-mac.sh > ~/.hms-snapshot/snapshot.sh
   : > ~/.hms-snapshot/branches
   git show FETCH_HEAD:com.hms.autosave.plist | sed "s#__HOME__#$HOME#g" > ~/Library/LaunchAgents/com.hms.autosave.plist
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hms.autosave.plist
   ```
   `~/.hms-snapshot/branches` lists the branches this Mac owns, one per line. It stays empty until a hand-over completes, so the Mac never uploads a branch the Windows laptop is still working on. Check that `~/.hms-snapshot/snapshot.log` gets an entry, or a quiet run, within 10 minutes.
7. **Report setup.** Write a short setup report to `~/.hms-snapshot/report-setup.md`: bootstrap results, the doctor output summary, the baseline fast-tier result with counts and duration, and the baseline failures. Push it as described under "Reports" in COMMON.md, with the ref name `refs/hms/report/mac-setup/<UTC time as YYYYMMDDTHHMM>`.
