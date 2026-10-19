package hms.platform.docs.golden

import hms.platform.docs.domain.raster.MonoBitmap
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import tools.jackson.databind.json.JsonMapper
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO

/** Self-tests of the golden-image and byte-fixture harnesses and of the test decoders (docs/specs/modules/platform-docs.md §10). */
class GoldenHarnessTest :
    FunSpec({
        val provenance = Provenance("SYN-TEST", 1, "ab".repeat(32))

        fun sample(): MonoBitmap {
            val bitmap = MonoBitmap(13, 7)
            for (i in 0 until 7) bitmap.set(i, i, true)
            bitmap.set(12, 0, true)
            return bitmap
        }

        fun fromDir(root: Path): (String) -> ByteArray? =
            { path -> root.resolve(path).takeIf { Files.exists(it) }?.let(Files::readAllBytes) }

        fun treeOf(root: Path): List<String> =
            Files.walk(root).use { s ->
                s
                    .filter(Files::isRegularFile)
                    .map {
                        root.relativize(it).toString()
                    }.toList()
            }

        test("GoldenImages: no approved set fails closed and writes the candidate and its manifest, never into the approved tree") {
            val approved = Files.createTempDirectory("approved")
            val candidates = Files.createTempDirectory("candidates")
            val golden = GoldenImages(fromDir(approved)) { candidates }
            val error = shouldThrow<AssertionError> { golden.assertMatches("test-identity", "case-1", sample(), provenance) }
            error.message shouldContain "no approved golden images for test-identity"
            treeOf(approved) shouldBe emptyList()
            val dir = candidates.resolve("golden/test-identity")
            PngBitmaps.read(Files.readAllBytes(dir.resolve("case-1.png"))) shouldBe sample()
            val manifest = JsonMapper.builder().build().readTree(Files.readAllBytes(dir.resolve("manifest.json")))
            manifest.path("identity").asString() shouldBe "test-identity"
            manifest.path("human_script_review").asString() shouldBe "requested"
            manifest.path("approved_by_agent_commit").isNull shouldBe true
            val file = manifest.path("files").single()
            file.path("name").asString() shouldBe "case-1.png"
            file.path("sha256").asString() shouldBe ApprovedSets.sha256(Files.readAllBytes(dir.resolve("case-1.png")))
            file.path("template_id").asString() shouldBe "SYN-TEST"
            file.path("template_version").asInt() shouldBe 1
            file.path("template_hash").asString() shouldBe "ab".repeat(32)
        }

        test("GoldenImages: an approved set equal to the image passes; a different image fails with a difference image") {
            val approved = Files.createTempDirectory("approved")
            val candidates = Files.createTempDirectory("candidates")
            shouldThrow<AssertionError> {
                GoldenImages(
                    fromDir(approved),
                ) { candidates }.assertMatches("id-1", "case-1", sample(), provenance)
            }
            // Approve: copy the reviewed candidate set into the approved tree (what a human does).
            val target = approved.resolve("golden/id-1")
            Files.createDirectories(target)
            Files.copy(candidates.resolve("golden/id-1/case-1.png"), target.resolve("case-1.png"))
            Files.copy(candidates.resolve("golden/id-1/manifest.json"), target.resolve("manifest.json"))
            val fresh = Files.createTempDirectory("candidates2")
            val golden = GoldenImages(fromDir(approved)) { fresh }
            golden.assertMatches("id-1", "case-1", sample(), provenance)
            treeOf(fresh) shouldBe emptyList()

            val changed = sample().also { it.set(12, 6, true) }
            shouldThrow<AssertionError> { golden.assertMatches("id-1", "case-1", changed, provenance) }.message shouldContain
                "1 pixels differ"
            Files.exists(fresh.resolve("golden/id-1/case-1.diff.png")) shouldBe true
            shouldThrow<AssertionError> { golden.assertMatches("id-1", "case-1", MonoBitmap(5, 5), provenance) }.message shouldContain
                "size 5x5"
            shouldThrow<AssertionError> { golden.assertMatches("id-1", "case-2", sample(), provenance) }.message shouldContain
                "no approved golden image case-2"
        }

        test("GoldenImages: an approved PNG that does not match its manifest SHA-256 fails") {
            val approved = Files.createTempDirectory("approved")
            val candidates = Files.createTempDirectory("candidates")
            shouldThrow<AssertionError> { GoldenImages(fromDir(approved)) { candidates }.assertMatches("id-2", "c", sample(), provenance) }
            val target = Files.createDirectories(approved.resolve("golden/id-2"))
            Files.write(target.resolve("c.png"), PngBitmaps.write(MonoBitmap(13, 7)))
            Files.copy(candidates.resolve("golden/id-2/manifest.json"), target.resolve("manifest.json"))
            shouldThrow<AssertionError> { GoldenImages(fromDir(approved)) { candidates }.assertMatches("id-2", "c", sample(), provenance) }
                .message shouldContain "does not match its manifest"
        }

        test("identity keys and names are path segments only") {
            val golden = GoldenImages({ null }) { Files.createTempDirectory("c") }
            shouldThrow<IllegalArgumentException> { golden.assertMatches("../x", "c", sample(), provenance) }
            shouldThrow<IllegalArgumentException> { golden.assertMatches("id", "a/b", sample(), provenance) }
        }

        test("PngBitmaps reads pure black and white only") {
            val image = BufferedImage(2, 1, BufferedImage.TYPE_INT_RGB)
            image.setRGB(0, 0, 0x808080)
            val out = ByteArrayOutputStream()
            ImageIO.write(image, "png", out)
            shouldThrow<AssertionError> { PngBitmaps.read(out.toByteArray()) }
            PngBitmaps.read(PngBitmaps.write(sample())) shouldBe sample()
        }

        test("ByteFixtures: missing fails and writes the candidate; equal passes; different fails with a difference report") {
            val approved = Files.createTempDirectory("approved")
            val candidates = Files.createTempDirectory("candidates")
            val bytes = "^XA\n^PQ1\n^XZ\n".toByteArray()
            shouldThrow<AssertionError> { ByteFixtures(fromDir(approved)) { candidates }.assertMatches("x.zpl", bytes, provenance) }
                .message shouldContain "no approved byte fixtures"
            treeOf(approved) shouldBe emptyList()
            Files.readAllBytes(candidates.resolve("fixtures/x.zpl")).contentEquals(bytes) shouldBe true
            val target = Files.createDirectories(approved.resolve("fixtures"))
            Files.copy(candidates.resolve("fixtures/x.zpl"), target.resolve("x.zpl"))
            Files.copy(candidates.resolve("fixtures/manifest.json"), target.resolve("manifest.json"))
            val fresh = Files.createTempDirectory("candidates2")
            val fixtures = ByteFixtures(fromDir(approved)) { fresh }
            fixtures.assertMatches("x.zpl", bytes, provenance)
            treeOf(fresh) shouldBe emptyList()
            shouldThrow<AssertionError> { fixtures.assertMatches("x.zpl", "^XA\n^PQ2\n^XZ\n".toByteArray(), provenance) }
                .message shouldContain "first difference at byte 7 (line 2)"
            Files.readString(fresh.resolve("fixtures/x.zpl.diff.txt")) shouldContain "byte 7"
            shouldThrow<AssertionError> { fixtures.assertMatches("y.zpl", bytes, provenance) }.message shouldContain
                "no approved byte fixture y.zpl"
        }

        test("ZplGraphicDecoder: places bands at their ^FO, most significant bit first; rejects malformed fields") {
            val zpl = "^XA\n^PW16\n^LL4\n^FO0,0^GFA,4,4,2,8001^FS\n^FO8,2^GFA,2,2,1,FF01^FS\n^XZ\n"
            val bad = "^XA\n^PW16\n^LL4\n^FO0,0^GFA,4,4,2,80^FS\n^XZ\n"
            val decoded = ZplGraphicDecoder.decode(zpl.replace("8001", "80000001").toByteArray())
            decoded.image.get(0, 0) shouldBe true
            decoded.image.get(15, 1) shouldBe true
            (8 until 16).all { decoded.image.get(it, 2) } shouldBe true
            decoded.image.get(15, 3) shouldBe true
            decoded.image.blackCount() shouldBe 11
            decoded.bands shouldBe listOf(GraphicBand(0, 0, 4, 2), GraphicBand(8, 2, 2, 1))
            shouldThrow<AssertionError> { ZplGraphicDecoder.decode(bad.toByteArray()) }
            shouldThrow<AssertionError> {
                ZplGraphicDecoder.decode(
                    zpl.replace("80000001", "8000000a").replace("8001", "8000000a").toByteArray(),
                )
            }
        }

        test("EscPosDecoder: stacks GS v 0 bands; rejects any other command") {
            val bytes =
                byteArrayOf(
                    0x1B,
                    0x40,
                    0x1D,
                    0x76,
                    0x30,
                    0x00,
                    1,
                    0,
                    2,
                    0,
                    0x80.toByte(),
                    0x01,
                    0x1D,
                    0x76,
                    0x30,
                    0x00,
                    1,
                    0,
                    1,
                    0,
                    0xFF.toByte(),
                ) +
                    byteArrayOf(0x1D, 0x56, 0x42, 0x00)
            val decoded = EscPosDecoder.decode(bytes)
            decoded.bandRows shouldBe listOf(2, 1)
            decoded.image.get(0, 0) shouldBe true
            decoded.image.get(7, 1) shouldBe true
            decoded.image.blackCount() shouldBe 10
            val withFeed = bytes.copyOfRange(0, bytes.size - 4) + byteArrayOf(0x1B, 0x64, 3) + byteArrayOf(0x1D, 0x56, 0x42, 0x00)
            shouldThrow<AssertionError> { EscPosDecoder.decode(withFeed) }
            shouldThrow<AssertionError> { EscPosDecoder.decode(bytes.copyOfRange(0, bytes.size - 1)) }
        }
    })
