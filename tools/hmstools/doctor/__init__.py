"""tools/doctor: check the build host against BUILD-PROMPT.md "Before the first session" (WP-0.1).

Stdlib only, so it runs with the system Python before the project venv exists. It never installs
anything: for every missing item it prints the exact install command for Ubuntu 24.04 in WSL2 and,
on a Windows host, the Windows-side steps.
"""
