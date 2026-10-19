import sys
def edit(p, pairs):
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert a in s, (p, a)
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="\n").write(s)
edit("register/DomainMarkersTest.kt", [
    ("import io.kotest.engine.spec.tempdir\n", ""),
    ("""            val root = tempdir().toPath()
            directories.forEach""", """            val root = Files.createTempDirectory("si-markers").also { roots += it }
            directories.forEach"""),
    ("""        val domain = "backend/modules/fix/src/main/kotlin/hms/fix/domain"
""", """        val domain = "backend/modules/fix/src/main/kotlin/hms/fix/domain"

        afterSpec { roots.forEach { it.toFile().deleteRecursively() } }
"""),
    ("""        fun repository(vararg directories: String): Path {""", """        val roots = mutableListOf<Path>()

        fun repository(vararg directories: String): Path {"""),
])
edit("DomainLayerCheckTest.kt", [
    ("import io.kotest.engine.spec.tempdir\n", ""),
    ("""            val root = tempdir().toPath()
            Files.createDirectories(root.resolve(si02.domainMarker).resolve("mar"))
            val failure = shouldThrow<AssertionError> { DomainLayerCheck.verify(si02, sources, root, budget = 10) }
""", """            val root = Files.createTempDirectory("si-domain")
            Files.createDirectories(root.resolve(si02.domainMarker).resolve("mar"))
            val failure =
                try {
                    shouldThrow<AssertionError> { DomainLayerCheck.verify(si02, sources, root, budget = 10) }
                } finally {
                    root.toFile().deleteRecursively()
                }
"""),
    ("""            object : DomainProperty {
                val seeds = mutableListOf<Long>()
                override val si = si""", """            object : DomainProperty {
                override val si = si"""),
    ("""                override fun runSequence(seed: Long) {
                    seeds += seed
                    if""", """                override fun runSequence(seed: Long) {
                    if"""),
])
