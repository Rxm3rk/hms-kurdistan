package hms.platform.docs.infrastructure.template

import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Overflow
import hms.platform.docs.domain.template.Provenance
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.template.TextDirection
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files
import java.nio.file.Path

/** The template loader (docs/specs/modules/platform-docs.md §4.1 to §4.3) and the templates in `content/print-templates`. */
class YamlTemplateLoaderTest :
    FunSpec({
        val loader = YamlTemplateLoader()
        val templatesDir = Path.of(System.getProperty("hms.docs.templatesDir"))

        val minimal =
            """
            id: SYN-TOKEN-TEST
            version: 1
            provenance: synthetic
            kind: token
            media:
              width_mm: 80
              length_mm: 40
              rotation: 0
              printable: {x_mm: 4, y_mm: 2, w_mm: 72, h_mm: 36}
            captions: {}
            elements:
              - type: text
                bind: notice.synthetic
                font: latin
                box: {x_mm: 4, y_mm: 0, w_mm: 72, h_mm: 6.5}
                size_pt: {max: 8, min: 6}
                max_lines: 2
              - type: text
                bind: token.number
                font: latin
                box: {x_mm: 4, y_mm: 2, w_mm: 72, h_mm: 20}
                size_pt: {max: 40, min: 24}
            """.trimIndent() + "\n"

        fun load(
            yaml: String,
            name: String = "test.yaml",
        ): TemplateLoad = loader.parse(yaml.toByteArray(), name)

        fun refused(yaml: String): TemplateLoad.Refused = load(yaml).shouldBeInstanceOf<TemplateLoad.Refused>()

        fun loaded(yaml: String) = load(yaml).shouldBeInstanceOf<TemplateLoad.Loaded>().template

        test("TemplateLint:content-print-templates: every template in content/print-templates loads with no problem and no lint finding") {
            val directory = loader.loadDirectory(templatesDir)
            withClue(directory.refusals.joinToString("\n")) { directory.refusals.shouldBeEmpty() }
            directory.templates.map { it.id } shouldContainExactlyInAnyOrder
                listOf(
                    "SYN-WRISTBAND-ADULT",
                    "SYN-WRISTBAND-NEWBORN",
                    "SYN-SPECIMEN-LABEL",
                    "SYN-SPECIMEN-LABEL-CODE128",
                    "SYN-RECEIPT-80",
                    "SYN-TOKEN-80",
                    "SYN-DOCUMENT-A4",
                )
            directory.templates.forEach { template ->
                template.provenance shouldBe Provenance.SYNTHETIC
                Files.exists(templatesDir.resolve("${template.id}.yaml")) shouldBe true
            }
        }

        test("the YAML is read into the model with its defaults: regular weight, one line, start, refuse, auto") {
            val template = loader.parse(minimal.toByteArray(), "t.yaml").shouldBeInstanceOf<TemplateLoad.Loaded>().template
            template.kind shouldBe TemplateKind.TOKEN
            template.media.minDotsPerMm shouldBe 8.0
            val number = template.elements[1].shouldBeInstanceOf<Element.Text>()
            number.bind shouldBe Binding.TOKEN_NUMBER
            number.weight shouldBe FontWeight.REGULAR
            number.maxLines shouldBe 1
            number.overflow shouldBe Overflow.REFUSE
            number.direction shouldBe TextDirection.AUTO
        }

        test("the content hash is the SHA-256 of the file with CRLF normalised to LF") {
            val lf = loader.parse(minimal.toByteArray(), "lf.yaml").shouldBeInstanceOf<TemplateLoad.Loaded>().template
            val crlf = loaded(minimal.replace("\n", "\r\n"))
            crlf.contentHash shouldBe lf.contentHash
            lf.contentHash shouldBe YamlTemplateLoader.contentHash(minimal.toByteArray())
            lf.contentHash.length shouldBe 64
            loaded(minimal.replace("max: 40", "max: 39")).contentHash shouldNotBe lf.contentHash
        }

        test("an unknown key is refused at any level, never ignored") {
            refused(minimal.replace("kind: token", "kind: token\ncolour: red")).problems.single() shouldContain "colour: unknown key"
            refused(minimal.replace("rotation: 0", "rotation: 0\n  dpi: 203")).problems.single() shouldContain "media.dpi: unknown key"
            refused(minimal.replace("    max_lines: 2\n", "    max_lines: 2\n    overflo: wrap-grow\n")).problems.single() shouldContain
                "elements[0].overflo: unknown key"
        }

        test("a duplicate key, a wrong type, a name outside a closed vocabulary or a missing key is refused") {
            refused(minimal.replace("version: 1", "version: 1\nversion: 2")).problems.single() shouldContain "not valid YAML"
            refused(minimal.replace("version: 1", "version: one")).problems.single() shouldContain "version: must be an integer"
            refused(minimal.replace("bind: token.number", "bind: patient.bed")).problems.single() shouldContain
                "bind: 'patient.bed' is not one of"
            refused(minimal.replace("  length_mm: 40\n", "")).problems.single() shouldContain "media.length_mm: required"
            refused("- not a mapping\n").problems.single() shouldContain "must be a mapping"
        }

        test("a synthetic template's id starts with SYN-") {
            refused(minimal.replace("id: SYN-TOKEN-TEST", "id: TOKEN-TEST")).problems.single() shouldContain "starts with SYN-"
        }

        test("a lint finding refuses the template (spec §4.3)") {
            val noNotice = minimal.replace("bind: notice.synthetic", "bind: token.issuedAt")
            refused(noNotice).problems.single() shouldContain "lint rule 9"
        }

        test("a second file claiming an existing id and version with another hash is refused and blocks the id") {
            val first = loader.parse(minimal.toByteArray(), "a.yaml")
            val same = loader.parse(minimal.toByteArray(), "b.yaml")
            val other = loader.parse(minimal.replace("max: 40", "max: 38").toByteArray(), "c.yaml")
            loader.combine(listOf("a.yaml" to first, "b.yaml" to same)).let {
                it.refusals.shouldBeEmpty()
                it.templates.size shouldBe 1
            }
            val conflict = loader.combine(listOf("a.yaml" to first, "c.yaml" to other))
            conflict.refusals.single().source shouldBe "c.yaml"
            conflict.refusals.single().problems.single() shouldContain "already loaded with another content hash"
            conflict.blockedIds shouldBe setOf("SYN-TOKEN-TEST")
            conflict.templates.shouldBeEmpty()
            YamlTemplateRepository(conflict).find("SYN-TOKEN-TEST").shouldBeNull()
        }

        test("the repository returns the highest version of an id; a refused file blocks its id in every version") {
            val v1 = loader.parse(minimal.toByteArray(), "v1.yaml")
            val v2 = loader.parse(minimal.replace("version: 1", "version: 2").toByteArray(), "v2.yaml")
            val both = YamlTemplateRepository(loader.combine(listOf("v1.yaml" to v1, "v2.yaml" to v2)))
            both.find("SYN-TOKEN-TEST").shouldNotBeNull().version shouldBe 2
            val broken = load(minimal.replace("version: 1", "version: 3").replace("kind: token", "kind: tokn"), "v3.yaml")
            broken.shouldBeInstanceOf<TemplateLoad.Refused>().templateId shouldBe "SYN-TOKEN-TEST"
            val repository = YamlTemplateRepository(loader.combine(listOf("v1.yaml" to v1, "v3.yaml" to broken)))
            repository.find("SYN-TOKEN-TEST").shouldBeNull()
        }

        test("the worst-case corpus file shares the directory and is not loaded as a template") {
            Files.exists(templatesDir.resolve(WorstCaseCorpusLoader.FILE_NAME)) shouldBe true
            YamlTemplateLoader.NON_TEMPLATE_FILES shouldBe setOf(WorstCaseCorpusLoader.FILE_NAME)
        }

        test("the worst-case corpus loads strictly: unknown keys and empty lists are refused") {
            val bytes = Files.readAllBytes(templatesDir.resolve(WorstCaseCorpusLoader.FILE_NAME))
            val corpus = WorstCaseCorpusLoader.parse(bytes).shouldBeInstanceOf<CorpusLoad.Loaded>().corpus
            corpus.identities.size shouldBe 11
            corpus.mrns shouldBe listOf("SYN-00001234567-8")
            val text = String(bytes, Charsets.UTF_8)
            val extra = WorstCaseCorpusLoader.parse((text + "extra: 1\n").toByteArray()).shouldBeInstanceOf<CorpusLoad.Refused>()
            extra.problems.single() shouldContain "extra: unknown key"
            WorstCaseCorpusLoader
                .parse(text.replace("mrns: [\"SYN-00001234567-8\"]", "mrns: []").toByteArray())
                .shouldBeInstanceOf<CorpusLoad.Refused>()
                .problems
                .single() shouldContain "mrns: must not be empty"
        }
    })
