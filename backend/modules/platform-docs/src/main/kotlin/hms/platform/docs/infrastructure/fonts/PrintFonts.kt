package hms.platform.docs.infrastructure.fonts

import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight

/**
 * The four print fonts and their names in each output (docs/specs/modules/platform-docs.md §7.1, §7.4,
 * §9). The files live in `src/main/resources/hms/platform/docs/fonts/`; `fonts.json` there pins each by
 * SHA-256 and font version, and the renderer satellite reads the same directory.
 */
enum class PrintFont(
    val role: FontRole,
    val weight: FontWeight,
    /** The TrueType file name in the fonts resource directory. */
    val fileName: String,
    /** The name HTML uses in `src: url(hms-font:<name>)`; the satellite resolves it from the fonts directory. */
    val hmsFontName: String,
    /** The resident file name on a Zebra printer for ZPL text mode (8.3 names). */
    val zplName: String,
) {
    ARABIC_REGULAR(FontRole.ARABIC, FontWeight.REGULAR, "NotoSansArabic-Regular.ttf", "noto-sans-arabic-regular", "E:NSARAB.TTF"),
    ARABIC_BOLD(FontRole.ARABIC, FontWeight.BOLD, "NotoSansArabic-Bold.ttf", "noto-sans-arabic-bold", "E:NSARABB.TTF"),
    LATIN_REGULAR(FontRole.LATIN, FontWeight.REGULAR, "NotoSans-Regular.ttf", "noto-sans-regular", "E:NSLATN.TTF"),
    LATIN_BOLD(FontRole.LATIN, FontWeight.BOLD, "NotoSans-Bold.ttf", "noto-sans-bold", "E:NSLATNB.TTF"),
    ;

    val spec: FontSpec get() = FontSpec(role, weight)

    companion object {
        /** The classpath directory holding the font files, `fonts.json` and `OFL.txt`. */
        const val RESOURCE_DIR: String = "/hms/platform/docs/fonts/"

        fun of(spec: FontSpec): PrintFont = entries.first { it.role == spec.role && it.weight == spec.weight }
    }
}
