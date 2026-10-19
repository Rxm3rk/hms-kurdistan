package hms.platform.docs.infrastructure.writers

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.golden.Provenance
import hms.platform.docs.infrastructure.raster.LayoutRasteriser
import hms.platform.docs.infrastructure.raster.PlacedRaster
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Hand-made layouts for the writer tests (synthetic: `SYN-` identifiers, NOT FOR CLINICAL USE). The writers
 * are tested against the layout contract only, independently of the layout engine and the real rasteriser.
 */
object WriterSamples {
    val ARABIC_BOLD = FontSpec(FontRole.ARABIC, FontWeight.BOLD)
    val ARABIC_REGULAR = FontSpec(FontRole.ARABIC, FontWeight.REGULAR)
    val LATIN_BOLD = FontSpec(FontRole.LATIN, FontWeight.BOLD)
    val LATIN_REGULAR = FontSpec(FontRole.LATIN, FontWeight.REGULAR)

    const val SORANI_NAME = "ئارام ڕێبوار"
    const val LATIN_NAME = "Aram Rebwar"
    const val MRN = "SYN-000123-7"
    const val WRISTBAND_PAYLOAD = "HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J0001"
    const val SPECIMEN_ID = "SYN-S-000077"
    const val CREATED_AT = "2026-10-19T09:00:00+03:00"
    const val TEMPLATE_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    /** One placed line with a single font: positional on purpose, so the sample layouts read as tables. */
    @Suppress("LongParameterList")
    fun line(
        text: String,
        font: FontSpec,
        sizePt: Double,
        rightToLeft: Boolean,
        align: Align,
        x: Double,
        width: Double,
        top: Double,
        baseline: Double,
        lineHeight: Double,
        measured: Double = width / 2,
    ) = PlacedLine(text, listOf(font), sizePt, rightToLeft, align, x, width, top, baseline, lineHeight, measured)

    /** A wristband read along its length: an 80 × 25 mm reading frame turned 90° onto 25 mm media. */
    fun wristband(): Layout =
        Layout(
            templateId = "SYN-WRISTBAND-ADULT",
            templateVersion = 1,
            templateHash = TEMPLATE_HASH,
            kind = TemplateKind.WRISTBAND,
            language = LabelLanguage.EN,
            synthetic = true,
            frameWidthMm = 80.0,
            frameHeightMm = 25.0,
            rotation = 90,
            lines =
                listOf(
                    line(SORANI_NAME, ARABIC_BOLD, 10.0, true, Align.START, 2.0, 50.0, 1.5, 6.0, 7.45, 24.0),
                    line(LATIN_NAME, LATIN_BOLD, 9.0, false, Align.START, 2.0, 50.0, 9.0, 12.5, 4.3, 21.0),
                    line("MRN", LATIN_REGULAR, 6.0, false, Align.START, 2.0, 10.0, 15.0, 17.0, 2.9, 4.5),
                    line(MRN, LATIN_REGULAR, 8.0, false, Align.START, 13.0, 30.0, 15.0, 17.8, 3.8, 19.0),
                    line("SYNTHETIC – NOT FOR CLINICAL USE", LATIN_REGULAR, 6.0, false, Align.CENTER, 2.0, 50.0, 20.0, 22.0, 2.9, 38.0),
                    line("SYN-J0001 2026-10-19 09:00", LATIN_REGULAR, 6.0, false, Align.END, 55.0, 23.0, 20.5, 22.5, 2.9, 20.0),
                ),
            barcodes = listOf(PlacedBarcode(Symbology.DATAMATRIX, WRISTBAND_PAYLOAD, 58.0, 1.5, 0.5, 18.0)),
            rules = listOf(PlacedRule(2.0, 14.0, 50.0, 0.3)),
        )

    /** A specimen label with the Code 128 option: a 50 × 25 mm frame, not turned. */
    fun specimenCode128(): Layout =
        Layout(
            templateId = "SYN-SPECIMEN-CODE128",
            templateVersion = 1,
            templateHash = TEMPLATE_HASH,
            kind = TemplateKind.SPECIMEN_LABEL,
            language = LabelLanguage.CKB,
            synthetic = true,
            frameWidthMm = 50.0,
            frameHeightMm = 25.0,
            rotation = 0,
            lines =
                listOf(
                    line(SORANI_NAME, ARABIC_BOLD, 9.0, true, Align.START, 2.0, 46.0, 1.0, 5.0, 6.7, 22.0),
                    line(LATIN_NAME, LATIN_BOLD, 8.0, false, Align.START, 2.0, 30.0, 6.5, 9.5, 3.8, 18.0),
                    line(MRN, LATIN_REGULAR, 7.0, false, Align.END, 32.0, 16.0, 6.5, 9.5, 3.3, 15.0),
                    line(SPECIMEN_ID, LATIN_REGULAR, 7.0, false, Align.START, 3.0, 40.0, 20.0, 22.5, 3.3, 16.0),
                    line("SYNTHETIC – NOT FOR CLINICAL USE", LATIN_REGULAR, 5.0, false, Align.CENTER, 2.0, 46.0, 23.0, 24.5, 2.4, 30.0),
                ),
            barcodes = listOf(PlacedBarcode(Symbology.CODE128, SPECIMEN_ID, 3.0, 12.0, 0.25, 7.0)),
            rules = emptyList(),
        )

    /** A 72 mm receipt laid out 40 mm long. */
    fun receipt(): Layout =
        Layout(
            templateId = "SYN-RECEIPT",
            templateVersion = 1,
            templateHash = TEMPLATE_HASH,
            kind = TemplateKind.RECEIPT,
            language = LabelLanguage.AR,
            synthetic = true,
            frameWidthMm = 72.0,
            frameHeightMm = 40.0,
            rotation = 0,
            lines =
                listOf(
                    line(SORANI_NAME, ARABIC_REGULAR, 10.0, true, Align.START, 0.0, 72.0, 0.0, 5.0, 7.45, 25.0),
                    line("SYN-R-000901", LATIN_REGULAR, 8.0, false, Align.START, 0.0, 72.0, 8.0, 11.0, 3.8, 20.0),
                    line("Total 25,000 IQD", LATIN_BOLD, 9.0, false, Align.END, 0.0, 72.0, 13.0, 16.5, 4.3, 30.0),
                ),
            barcodes = emptyList(),
            rules = listOf(PlacedRule(0.0, 12.5, 72.0, 0.25)),
        )

    fun provenance(layout: Layout) = Provenance(layout.templateId, layout.templateVersion, layout.templateHash)

    fun dots(
        mm: Double,
        dotsPerMm: Double,
    ): Int =
        BigDecimal
            .valueOf(mm)
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .setScale(0, RoundingMode.HALF_UP)
            .toInt()
}

/**
 * A FAKE rasteriser for the writer tests: it draws a filled box for each line (the measured width at the
 * line's alignment, 80% of the line height) and each rule, in the reading frame, then turns a 90° frame
 * clockwise onto the media (x = media width − v, y = u), over the whole media at (0, 0). It shapes nothing:
 * the writers only carry its image, and the decoded image must equal it.
 */
class FakeRasteriser : LayoutRasteriser {
    override fun rasterise(
        layout: Layout,
        dotsPerMm: Double,
    ): PlacedRaster {
        val frameW = WriterSamples.dots(layout.frameWidthMm, dotsPerMm)
        val frameH = WriterSamples.dots(layout.frameHeightMm, dotsPerMm)
        val turned = layout.rotation == TURNED
        val bitmap = if (turned) MonoBitmap(frameH, frameW) else MonoBitmap(frameW, frameH)

        fun fill(
            u: Double,
            v: Double,
            w: Double,
            h: Double,
        ) {
            val u0 = WriterSamples.dots(u, dotsPerMm)
            val v0 = WriterSamples.dots(v, dotsPerMm)
            val u1 = WriterSamples.dots(u + w, dotsPerMm).coerceAtMost(frameW)
            val v1 = WriterSamples.dots(v + h, dotsPerMm).coerceAtMost(frameH)
            for (vv in v0 until v1) {
                for (uu in u0 until u1) if (turned) bitmap.set(frameH - 1 - vv, uu, true) else bitmap.set(uu, vv, true)
            }
        }
        for (line in layout.lines) {
            val left =
                when {
                    line.align == Align.CENTER -> line.boxXMm + (line.boxWidthMm - line.measuredWidthMm) / 2
                    (line.align == Align.START) == line.rightToLeft -> line.boxXMm + line.boxWidthMm - line.measuredWidthMm
                    else -> line.boxXMm
                }
            fill(left, line.topMm, line.measuredWidthMm, line.lineHeightMm * BOX_SHARE)
        }
        layout.rules.forEach { fill(it.xMm, it.yMm, it.wMm, it.hMm) }
        return PlacedRaster(bitmap, 0, 0)
    }

    private companion object {
        const val TURNED = 90
        const val BOX_SHARE = 0.8
    }
}
