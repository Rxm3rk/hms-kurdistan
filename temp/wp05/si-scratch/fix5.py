p = "tests/invariants/src/propertyTest/kotlin/hms/tests/invariants/SiInvariantTests.kt"
s = open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert a in s, a
    s = s.replace(a, b)
rep("""        withClue("the register must list ${property.property} on ${property.machine} under ${entry.si}") { listed.shouldNotBeNull() }
        runCatching { property.run() }
            .onSuccess { recorder.property(PropertyResult(property.machine, property.property, passed = true, sequences = it, message = null)) }
            .onFailure { recorder.property(PropertyResult(property.machine, property.property, passed = false, sequences = 0, message = it.message)) }
            .getOrThrow()""", """        runCatching {
            withClue("the register must list ${property.property} on ${property.machine} under ${entry.si}") { listed.shouldNotBeNull() }
            property.run()
        }.onSuccess { sequences ->
            recorder.property(PropertyResult(property.machine, property.property, passed = true, sequences = sequences, message = null))
        }.onFailure { failure ->
            recorder.property(PropertyResult(property.machine, property.property, passed = false, sequences = 0, message = failure.message))
        }.getOrThrow()""")
rep("""    test("$si specification layer: the properties run are exactly the register's (${entry.plannedTest}; ${entry.hazards.joinToString()})") {""",
    """    val registerTest = "$si specification layer: the properties run are exactly the register's (${entry.plannedTest}; ${entry.hazards.joinToString()})"
    test(registerTest) {""")
open(p, "w", encoding="utf-8", newline="\n").write(s)
