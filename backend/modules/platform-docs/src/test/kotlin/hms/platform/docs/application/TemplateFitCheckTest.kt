package hms.platform.docs.application

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.application.testing.PrintFixtures
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.infrastructure.template.CorpusLoad
import hms.platform.docs.infrastructure.template.WorstCaseCorpusLoader
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files

/**
 * The worst-case fit check (docs/specs/modules/platform-docs.md §4.3; DN-069, OQ-244; HAZ-0045): every patient template
 * in `content/print-templates` fits the governed corpus at its minimum sizes, with the real shaper and fonts.
 */
class TemplateFitCheckTest :
    FunSpec({
        val corpus =
            WorstCaseCorpusLoader
                .parse(Files.readAllBytes(PrintFixtures.templatesDir.resolve(WorstCaseCorpusLoader.FILE_NAME)))
                .shouldBeInstanceOf<CorpusLoad.Loaded>()
                .corpus
        val check = TemplateFitCheck(PrintFixtures.shaper)
        val templates = PrintFixtures.templates.all()

        test("TemplateFitCheck:worst-case-identity-corpus: every patient template fits every corpus identity in en, ckb and ar") {
            val patientTemplates = templates.filter { it.kind.patientPrint }
            patientTemplates.size shouldBe 6
            patientTemplates.forEach { template ->
                val findings = check.check(template, corpus)
                withClue("${template.id}:\n" + findings.joinToString("\n")) { findings.shouldBeEmpty() }
            }
        }

        test("the corpus covers every script, newborns with twin markers, aliases and the longest identifiers") {
            corpus.identities.map { it.label.substringBefore('-') }.toSet() shouldBe setOf("ckb", "ar", "latin")
            corpus.identities.count { it.newborn } shouldBe 3
            corpus.identities.count { it.alias } shouldBe 3
            corpus.birthDates.single().approximate shouldBe true
        }

        test("a template that cannot fit the corpus is refused with identityDoesNotFit, naming the element") {
            val adult = templates.single { it.id == "SYN-WRISTBAND-ADULT" }
            val narrow =
                adult.copy(
                    elements =
                        adult.elements.map { element ->
                            if (element is Element.Text && element.bind == Binding.IDENTITY_NAME_OWN) {
                                element.copy(box = element.box.copy(wMm = 40.0))
                            } else {
                                element
                            }
                        },
                )
            val findings = check.check(narrow, corpus)
            findings.shouldNotBeEmpty()
            findings.all { it.refusal.reason == RefusalReason.IDENTITY_DOES_NOT_FIT } shouldBe true
            findings.map { it.refusal.subject }.toSet() shouldBe setOf(Binding.IDENTITY_NAME_OWN.yamlName)
        }

        test("tokens carry no patient and are not checked") {
            check.check(templates.single { it.id == "SYN-TOKEN-80" }, corpus).shouldBeEmpty()
        }
    })
