#!/bin/sh
# Time-limited direct kotlinc compile (diagnosis only; outputs to scratch). Usage: kc.sh <out-dir> <sources...>
G=/c/Users/Surface/.t3/projects/hospitalmanagementsystem/.tools/gradle-home/caches/modules-2/files-2.1
J=/c/Users/Surface/.t3/projects/hospitalmanagementsystem/.tools/jdk-25.0.4.1+1
winjars() { find "$@" -name '*.jar' ! -name '*sources*' | while read -r f; do cygpath -w "$f"; done | tr '\n' ';'; }
CP=$(winjars $G/org.jetbrains.kotlin/kotlin-compiler-embeddable/2.3.21 $G/org.jetbrains.kotlin/kotlin-stdlib/2.3.21 $G/org.jetbrains.kotlin/kotlin-script-runtime/2.3.21 $G/org.jetbrains.kotlin/kotlin-reflect/2.3.21 $G/org.jetbrains.kotlin/kotlin-daemon-embeddable/2.3.21 $G/org.jetbrains.intellij.deps/trove4j $G/org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.10.2 $G/org.jetbrains/annotations/13.0)
LIBS=$(winjars $G/org.jetbrains.kotlin/kotlin-stdlib/2.3.21 $G/io.kotest/kotest-property-jvm/6.2.6 $G/io.kotest/kotest-common-jvm/6.2.6 $G/org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.10.2)
SM=$(cygpath -w /c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-5dcdaa39/backend/platform/state-machine/build/classes/kotlin/main)
OUT=$1; shift
mkdir -p "$OUT"
timeout ${KC_TIMEOUT:-240} "$J/bin/java" -Xmx1g -cp "$CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 21 -cp "$LIBS$SM${EXTRA_CP:+;$EXTRA_CP}" -d "$(cygpath -w "$OUT")" "$@"
echo "kc exit=$?"
