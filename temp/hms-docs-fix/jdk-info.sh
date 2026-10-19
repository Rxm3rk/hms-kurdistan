#!/bin/bash
# Read-only: report the WSL clone's project-local JDK and the system JDK.
cd ~/src/hospitalmanagementsystem || exit 1
echo "== HEAD: $(git rev-parse --short HEAD) $(git rev-parse --abbrev-ref HEAD)"
echo "== status lines: $(git status --short | wc -l)"
echo "== .tools:"; ls -1 .tools/
for f in .tools/jdk-*/release; do
  echo "== $f"
  grep -E '^(IMPLEMENTOR|IMPLEMENTOR_VERSION|JAVA_RUNTIME_VERSION|SEMANTIC_VERSION|OS_NAME)=' "$f"
done
echo "== system java: $(readlink -f "$(command -v java)")"
java -version 2>&1 | head -3
echo "== dpkg JDK packages:"
dpkg-query -W -f='${Package} ${Version}\n' 'openjdk-25*' 'temurin*' 2>/dev/null
echo "== bootstrap env JAVA_HOME:"
sh tools/bootstrap env 2>&1 | grep JAVA_HOME
