package hms.platform.docs.domain.barcode

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.rules.TextChecks
import hms.platform.docs.domain.template.Binding

/** A barcode payload, or the refusal of a field that cannot be carried. */
sealed interface PayloadOutcome {
    data class Built(
        val payload: String,
    ) : PayloadOutcome

    data class Refused(
        val refusal: Refusal,
    ) : PayloadOutcome
}

/**
 * The barcode payloads [P] (docs/specs/modules/platform-docs.md §6.1, OQ-233; §12.8 "DataMatrix with MRN and
 * encounter"; HAZ-0046). Printable ASCII only, no FNC1 or GS. Every field must be in R4's alphabet
 * `[A-Za-z0-9-]+`, so no field can hold the separator `|`, the prefix's `:`, a ZPL `^`, `~` or `\`, or a space;
 * a field outside it is refused (`print.refused.identifierInvalid`), never escaped or dropped. R9: the layout
 * builds the payload from the same resolved content the text is printed from.
 */
object BarcodePayload {
    /** The payload format's version prefix. */
    const val PREFIX: String = "HMS1"

    private const val SEPARATOR: String = "|"

    /**
     * Wristband DataMatrix: `HMS1|M:<MRN>|E:<encounter>|B:<band serial>`; the band serial is the print job id, so a
     * later scan can reject a superseded band (spec §8.6).
     */
    fun wristband(
        mrn: String?,
        encounterId: String?,
        bandSerial: String?,
    ): PayloadOutcome =
        build(
            listOf(
                Field("M", mrn, Binding.IDENTITY_MRN.yamlName),
                Field("E", encounterId, Binding.ENCOUNTER_ID.yamlName),
                Field("B", bandSerial, "${Binding.BARCODE_WRISTBAND.yamlName}.serial"),
            ),
        )

    /** Specimen DataMatrix, the default (two identifiers): `HMS1|S:<specimen id>|M:<MRN>`. */
    fun specimenDataMatrix(
        specimenId: String?,
        mrn: String?,
    ): PayloadOutcome =
        build(
            listOf(
                Field("S", specimenId, Binding.SPECIMEN_ID.yamlName),
                Field("M", mrn, Binding.IDENTITY_MRN.yamlName),
            ),
        )

    /** Specimen Code 128, the template option analyser tube readers commonly read: the specimen id alone. */
    fun specimenCode128(specimenId: String?): PayloadOutcome =
        refusal(Field("", specimenId, Binding.SPECIMEN_ID.yamlName))?.let { PayloadOutcome.Refused(it) }
            ?: PayloadOutcome.Built(specimenId.orEmpty())

    private fun build(fields: List<Field>): PayloadOutcome =
        fields.firstNotNullOfOrNull(::refusal)?.let { PayloadOutcome.Refused(it) }
            ?: PayloadOutcome.Built((listOf(PREFIX) + fields.map { "${it.tag}:${it.value}" }).joinToString(SEPARATOR))

    private fun refusal(field: Field): Refusal? =
        if (field.value == null) {
            Refusal(RefusalReason.IDENTIFIER_MISSING, field.subject, "not recorded")
        } else {
            TextChecks.outsideIdentifierAlphabet(field.value)?.let { Refusal(RefusalReason.IDENTIFIER_INVALID, field.subject, it) }
        }

    private data class Field(
        val tag: String,
        val value: String?,
        val subject: String,
    )
}
