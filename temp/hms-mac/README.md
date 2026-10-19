# MacBook build host: setup and hand-over

Written by the build lead (the Windows laptop thread) on 19 Oct 2026, after the human lead decided:
- Split the remaining work between this MacBook and the Windows laptop, and exchange work through the private GitHub repo `Rxm3rk/hms-kurdistan`. Chosen: "Private GitHub repo (Recommended)".
- The MacBook (M-series, 24–36 GB) takes two streams: the **core libraries** (`wp/0.3-platform-kernel`) and the **clinical state machines** (`wp/0.5-state-machines`).
- Those two streams run on the Claude accounts **A7a** (core libraries) and **Ahmad@** (state machines). Chosen: "A7a and Ahmad@ (Recommended)".

The Windows laptop keeps the server environment, the design system and printing. It also does all merges and runs the official test runs ("records of record") in its Linux copy.

This pack lives on the GitHub ref `refs/hms/mac-handoff`, not on a branch. To read it:
`git fetch origin refs/hms/mac-handoff && git show FETCH_HEAD:README.md`

## Part 1: for you, the human (about 15 minutes)

1. Open Terminal and run:
   ```
   xcode-select --install
   ```
   Accept the dialog. This installs git.
2. Install Homebrew from https://brew.sh (paste the one-line installer shown there). Then run:
   ```
   brew install python@3.12 node@24 gh
   echo 'export PATH="/opt/homebrew/opt/node@24/bin:$PATH"' >> ~/.zprofile
   source ~/.zprofile
   ```
3. Sign in to GitHub as **Rxm3rk**:
   ```
   gh auth login
   ```
   Choose GitHub.com, then HTTPS, then "Login with a web browser". Then run:
   ```
   gh auth setup-git
   ```
4. Get the code:
   ```
   mkdir -p ~/src && git clone https://github.com/Rxm3rk/hms-kurdistan.git ~/src/hms-kurdistan
   ```
5. Install T3 Code (or Claude Code) on the Mac. Add the Claude accounts **A7a** and **Ahmad@**.
6. In T3 Code, add the project folder `~/src/hms-kurdistan`. Then:
   - Start a thread on account **A7a** (Opus, high effort, full access) and paste **Prompt 1** below.
   - When that thread says the Mac is set up, start a second thread on account **Ahmad@** with the same settings and paste **Prompt 2**.
7. Leave the Mac awake and plugged in: System Settings, then Battery or Energy, then "Prevent automatic sleeping when the display is off".

You don't need to do anything else. The two machines exchange work through GitHub by themselves, and every 10 minutes each machine also uploads its unsaved work.

### Prompt 1 (thread on A7a)
```
You are the build lead for the core libraries stream of HMS Kurdistan on this MacBook. The repository is ~/src/hms-kurdistan. Run: cd ~/src/hms-kurdistan && git fetch origin refs/hms/mac-handoff && git show FETCH_HEAD:README.md. Read it, then do "Part 2: Mac setup" from FETCH_HEAD:SETUP.md, then follow FETCH_HEAD:COMMON.md and FETCH_HEAD:WP-0.3.md exactly. Nobody will answer questions in this thread; follow the files' rules for anything that needs a human.
```

### Prompt 2 (thread on Ahmad@)
```
You are the build lead for the clinical state machines stream of HMS Kurdistan on this MacBook. The repository is ~/src/hms-kurdistan and the Mac setup is already done by the other thread (check ~/hms-lock/heavy.sh and ~/.hms-snapshot/snapshot.sh exist; if not, do "Part 2: Mac setup" yourself). Run: cd ~/src/hms-kurdistan && git fetch origin refs/hms/mac-handoff && git show FETCH_HEAD:README.md, then follow FETCH_HEAD:COMMON.md and FETCH_HEAD:WP-0.5.md exactly. Nobody will answer questions in this thread; follow the files' rules for anything that needs a human.
```
