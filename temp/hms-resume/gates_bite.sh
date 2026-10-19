#!/bin/sh
# Proves each backend fast-tier gate fails on a planted violation, then restores a clean tree.
set -u
REPO=/c/Users/Surface/.t3/projects/hospitalmanagementsystem
cd "$REPO" || exit 2
eval "$(sh tools/bootstrap env)"
T=backend/platform/testing/src
LOG=/c/Users/Surface/AppData/Local/Temp/hms-resume/gates
mkdir -p "$LOG"

run() { # name, expected failing task pattern
  backend/gradlew -p backend fastTier --console=plain > "$LOG/$1.log" 2>&1
  code=$?
  failed=$(grep -E "^> Task .* FAILED" "$LOG/$1.log" | tr '\n' ' ')
  if [ $code -ne 0 ] && echo "$failed" | grep -q "$2"; then echo "$1: fastTier exit=$code, failed as expected: $failed"; else echo "$1: UNEXPECTED exit=$code failed=[$failed]"; fi
}

# A. ktlint: formatting violation in compilable code.
printf 'package hms.kernel.testing\n\ninternal object ScratchKtlint {\n    fun value( ) : Int = 1\n}\n' > $T/main/kotlin/hms/kernel/testing/ScratchKtlint.kt
run A-ktlint "ktlintMainSourceSetCheck"
rm $T/main/kotlin/hms/kernel/testing/ScratchKtlint.kt

# B. detekt: an empty function block (default rule EmptyFunctionBlock), ktlint-clean.
printf 'package hms.kernel.testing\n\ninternal object ScratchDetekt {\n    fun noop() {}\n}\n' > $T/main/kotlin/hms/kernel/testing/ScratchDetekt.kt
run B-detekt ":detekt"
rm $T/main/kotlin/hms/kernel/testing/ScratchDetekt.kt

# C. a failing property in src/propertyTest.
cat > $T/propertyTest/kotlin/hms/kernel/testing/ScratchFailingPropertyTest.kt <<'KT'
package hms.kernel.testing

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll

class ScratchFailingPropertyTest :
    FunSpec({
        test("a false property fails the propertyTest task") {
            checkAll(PropertyTestBudget.sequences(), Arb.int()) { value ->
                (value xor value) shouldBe 1
            }
        }
    })
KT
run C-property ":propertyTest"
rm $T/propertyTest/kotlin/hms/kernel/testing/ScratchFailingPropertyTest.kt

# D. architecture: production domain code reading the system clock (§6.2).
mkdir -p $T/main/kotlin/hms/kernel/testing/domain
cat > $T/main/kotlin/hms/kernel/testing/domain/ScratchClock.kt <<'KT'
package hms.kernel.testing.domain

import java.time.Instant

internal object ScratchClock {
    fun current(): Instant = Instant.now()
}
KT
run D-architecture ":platform:testing:test"
rm -r $T/main/kotlin/hms/kernel/testing/domain

echo "--- clean tree"
git status --short -uall backend | grep -i scratch || echo "no scratch files left"
start=$(date +%s); backend/gradlew -p backend fastTier --console=plain > "$LOG/E-clean.log" 2>&1; echo "E-clean: exit=$? ($(( $(date +%s) - start )) s)"
start=$(date +%s); backend/gradlew -p backend fastTier --console=plain > "$LOG/F-warm.log" 2>&1; echo "F-warm (no changes): exit=$? ($(( $(date +%s) - start )) s)"
