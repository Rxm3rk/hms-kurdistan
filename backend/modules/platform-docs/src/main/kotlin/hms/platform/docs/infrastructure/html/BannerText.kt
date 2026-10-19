package hms.platform.docs.infrastructure.html

import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintBanner

/**
 * The text of the print banner's clinical fields (docs/specs/modules/platform-docs.md §3.1, §7.4; the
 * screen banner's fields and states, `docs/specs/modules/design-system.md` §2.1 on
 * `wp/0.7-design-system`). The print service lays these lines out with the fit rule at the page width
 * (the banner layout that [DocumentHtmlWriter] writes); identity lines come from the identity rules.
 *
 * - Allergies print exactly one state: NKA, not assessed, the list, or "Allergy status unavailable".
 *   Missing, empty or contradictory data is never printed as NKA: an empty list, or a list with an entry
 *   that has no substance, prints as unavailable (the same rule as the domain's `ContentRules` banner rows).
 * - Code status, isolation and weight print their display text, or "<field> unavailable"; never a default.
 * - The photo prints as text only (photos on prints: OQ-239): "No photo", or "Photo on record (not printed)".
 * - [LabelledText][hms.platform.docs.api.LabelledText] fields print their `text`; the redaction the policy
 *   asks for is applied before this point (spec §8.4).
 */
object BannerText {
    /** The banner's clinical field lines, in banner order: allergies, code status, isolation, weight, photo. */
    fun fields(
        banner: PrintBanner,
        captions: BannerCaptions,
    ): List<BannerField> =
        listOf(
            BannerField("allergies", allergies(banner.allergies, captions)),
            BannerField("codeStatus", banner.codeStatus?.let { "${captions.codeStatus}: ${it.text}" } ?: captions.codeStatusUnavailable),
            BannerField("isolation", banner.isolation?.let { "${captions.isolation}: ${it.text}" } ?: captions.isolationUnavailable),
            BannerField("weight", banner.weight?.let { "${captions.weight}: $it" } ?: captions.weightUnavailable),
            BannerField("photo", if (banner.photoOnRecord) captions.photoNotPrinted else captions.noPhoto),
        )

    private fun allergies(
        allergies: PrintAllergies,
        captions: BannerCaptions,
    ): String =
        when (allergies) {
            PrintAllergies.NoKnownAllergies -> {
                "${captions.allergies}: ${captions.noKnownAllergies}"
            }

            PrintAllergies.NotAssessed -> {
                "${captions.allergies}: ${captions.allergiesNotAssessed}"
            }

            PrintAllergies.Unavailable -> {
                captions.allergyStatusUnavailable
            }

            is PrintAllergies.Listed -> {
                if (allergies.items.isEmpty() || allergies.items.any { it.substance.isBlank() }) {
                    captions.allergyStatusUnavailable
                } else {
                    val items =
                        allergies.items.joinToString(captions.listSeparator) { item ->
                            val detail = listOfNotNull(item.reaction, item.severity)
                            if (detail.isEmpty()) item.substance else "${item.substance} (${detail.joinToString(", ")})"
                        }
                    "${captions.allergies}: $items"
                }
            }
        }
}

/** One banner line: the field's key and its text. */
data class BannerField(
    val key: String,
    val text: String,
)

/**
 * The banner and document captions in one label language. They come from the template's captions map in
 * the print's language (spec §3.3); [ENGLISH] holds the English texts for tests and samples.
 */
data class BannerCaptions(
    val allergies: String,
    val noKnownAllergies: String,
    val allergiesNotAssessed: String,
    val allergyStatusUnavailable: String,
    val codeStatus: String,
    val codeStatusUnavailable: String,
    val isolation: String,
    val isolationUnavailable: String,
    val weight: String,
    val weightUnavailable: String,
    val noPhoto: String,
    val photoNotPrinted: String,
    val listSeparator: String,
    /** The diagonal mark of a reprint (spec §7.4). */
    val reprint: String,
) {
    companion object {
        val ENGLISH: BannerCaptions =
            BannerCaptions(
                allergies = "Allergies",
                noKnownAllergies = "No known allergies (NKA)",
                allergiesNotAssessed = "Not assessed",
                allergyStatusUnavailable = "Allergy status unavailable",
                codeStatus = "Code status",
                codeStatusUnavailable = "Code status unavailable",
                isolation = "Isolation",
                isolationUnavailable = "Isolation unavailable",
                weight = "Weight",
                weightUnavailable = "Weight unavailable",
                noPhoto = "No photo",
                photoNotPrinted = "Photo on record (not printed)",
                listSeparator = "; ",
                reprint = "REPRINT",
            )
    }
}
