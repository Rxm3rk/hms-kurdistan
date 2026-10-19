p = "tests/invariants/src/propertyTest/kotlin/hms/tests/invariants/SiInvariantTests.kt"
s = open(p, encoding="utf-8").read()
a = """    val registerTest = "$si specification layer: the properties run are exactly the register's (${entry.plannedTest}; ${entry.hazards.joinToString()})"
"""
b = """    val registerTest =
        "$si specification layer: the properties run are exactly the register's (${entry.plannedTest}; ${entry.hazards.joinToString()})"
"""
assert a in s
s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
