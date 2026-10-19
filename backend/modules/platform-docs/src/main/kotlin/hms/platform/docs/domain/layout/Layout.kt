package hms.platform.docs.domain.layout

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.TemplateKind

/*
 * The layout result: the one geometry every writer draws (docs/specs/modules/platform-docs.md §2, §5.3).
 * Coordinates are millimetres on the reading frame, origin at the frame's top-left corner, y down.
 * Writers convert to dots (rounding half up once per coordinate, spec §5.4) or to points.
 */

/** A font as the shaper uses it: a role and a weight resolve to one TrueType file (spec §9). */
data class FontSpec(
    val role: FontRole,
    val weight: FontWeight,
)

/**
 * One placed line of text, already broken by the fit rule. The writers never re-break or re-size it.
 *
 * @property text the line in logical order (writers that shape themselves, such as ZPL text mode and
 *   the satellite, receive it unchanged; the rasteriser shapes it with the same shaper that measured it)
 * @property rightToLeft the paragraph direction of the line (true for Arabic-script text)
 * @property fonts the font chain (identity text: exactly one font; spec §4.1, §9)
 * @property boxXMm left edge of the element's box; the line is aligned inside [boxWidthMm]
 * @property topMm top of the line box
 * @property baselineMm the baseline, from the font's ascent at [sizePt]
 * @property lineHeightMm the fonts' `hhea` ascender + descender + line gap at the size (spec §5.3)
 * @property measuredWidthMm the shaped advance width at [sizePt]
 */
data class PlacedLine(
    val text: String,
    val fonts: List<FontSpec>,
    val sizePt: Double,
    val rightToLeft: Boolean,
    val align: Align,
    val boxXMm: Double,
    val boxWidthMm: Double,
    val topMm: Double,
    val baselineMm: Double,
    val lineHeightMm: Double,
    val measuredWidthMm: Double,
)

/** A placed barcode: the writer encodes [payload] (spec §6). The top-left of the symbol, quiet zone excluded. */
data class PlacedBarcode(
    val symbology: Symbology,
    val payload: String,
    val xMm: Double,
    val yMm: Double,
    val moduleMm: Double,
    val maxSizeMm: Double,
)

/** A filled rectangle. */
data class PlacedRule(
    val xMm: Double,
    val yMm: Double,
    val wMm: Double,
    val hMm: Double,
)

/** The full layout of one print. */
data class Layout(
    val templateId: String,
    val templateVersion: Int,
    val templateHash: String,
    val kind: TemplateKind,
    val language: LabelLanguage,
    val synthetic: Boolean,
    val frameWidthMm: Double,
    /** For flow kinds, the laid-out length. */
    val frameHeightMm: Double,
    /** 0, or 90 to turn the frame onto the printer's media. */
    val rotation: Int,
    val lines: List<PlacedLine>,
    val barcodes: List<PlacedBarcode>,
    val rules: List<PlacedRule>,
)
