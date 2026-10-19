p = "tests/invariants/build.gradle.kts"
s = open(p, encoding="utf-8").read()
old = """dependencies {
    // The specification layer drives each machine's generated model with its Guards and its facts generator (Arbs,
    // the module's test fixtures), through the sequence harness of platform/testing (spec §3.3, §4).
    propertyTestImplementation(project(":platform:testing"))
}

"""
assert old in s
s = s.replace(old, "")
open(p, "w", encoding="utf-8", newline="\n").write(s)
