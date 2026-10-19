package hms.platform.docs.golden

import java.nio.file.Files
import java.nio.file.Path

/**
 * Byte fixtures (docs/specs/modules/platform-docs.md §10): ZPL text bytes (`ByteFixture:zpl-text-*`,
 * `ByteFixture:zpl-reprint-*`) and HTML bytes (`ByteFixture:html-*`) compared byte for byte with an
 * approved file at `src/test/resources/fixtures/<name>`, listed with its SHA-256 in
 * `src/test/resources/fixtures/manifest.json` (see [ApprovedSets]; the identity is `byte-fixtures`, as these
 * bytes do not depend on the JDK or the fonts).
 *
 * On a missing or different file the harness writes the candidate, a short difference report
 * (`<name>.diff.txt`: the first differing byte offset and line) and the candidate manifest to
 * `<candidatesDir>/fixtures/`, and fails; it never writes into `src/test/resources`.
 */
class ByteFixtures(
    private val approved: (String) -> ByteArray? = ApprovedSets.classpath,
    private val candidatesDir: () -> Path = ApprovedSets::candidatesDirFromSystemProperty,
) {
    /** Asserts that [actual] equals the approved fixture [name]; throws [AssertionError] otherwise. */
    fun assertMatches(
        name: String,
        actual: ByteArray,
        provenance: Provenance,
    ) {
        ApprovedSets.requireSafeSegment("name", name)
        val manifest = approved("fixtures/manifest.json")
        val expected = approved("fixtures/$name")
        val entry = manifest?.let { ApprovedSets.approvedEntry(it, name) }
        val problem =
            when {
                manifest == null -> "no approved byte fixtures"

                entry == null || expected == null -> "no approved byte fixture $name"

                entry
                    .path(
                        "sha256",
                    ).asString() != ApprovedSets.sha256(expected) -> "approved fixture $name does not match its manifest SHA-256"

                !expected.contentEquals(actual) -> "fixture $name differs: ${firstDifference(expected, actual)}"

                else -> null
            }
        if (problem != null) {
            val dir = candidatesDir().resolve("fixtures")
            Files.createDirectories(dir)
            val file = dir.resolve(name)
            Files.write(file, actual)
            if (expected != null) Files.writeString(dir.resolve("$name.diff.txt"), firstDifference(expected, actual) + "\n")
            ApprovedSets.recordCandidate(dir, IDENTITY, name, ApprovedSets.sha256(actual), provenance)
            throw AssertionError("$problem; candidate written to $file")
        }
    }

    private fun firstDifference(
        expected: ByteArray,
        actual: ByteArray,
    ): String {
        val common = minOf(expected.size, actual.size)
        val at = (0 until common).firstOrNull { expected[it] != actual[it] } ?: common
        val line = 1 + (0 until at).count { actual[it] == LF }
        return "first difference at byte $at (line $line); approved ${expected.size} bytes, actual ${actual.size} bytes"
    }

    companion object {
        const val IDENTITY: String = "byte-fixtures"
        private const val LF: Byte = 0x0A
    }
}
