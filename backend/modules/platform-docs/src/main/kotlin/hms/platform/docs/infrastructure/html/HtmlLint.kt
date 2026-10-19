package hms.platform.docs.infrastructure.html

import java.net.URLDecoder
import java.util.Base64

/**
 * The HTML lint (docs/specs/modules/platform-docs.md §7.4, HAZ-0047, `UnitTest:html-has-no-external-urls`):
 * print HTML reaches no resource outside the document, takes no font but the pinned print fonts, and
 * carries nothing that reorders text or breaks the PDF's determinism. It refuses, case-insensitively,
 * anywhere in the document (text included: the check is deliberately blunt):
 *
 * - the URL schemes `http:`, `https:`, `file:`, `ftp:`, `ws:`, `wss:`, `blob:` and `javascript:`;
 * - a protocol-relative URL (`//host`) as an attribute value or a `url()` argument;
 * - the elements `<script`, `<link`, `<iframe`, `<object`, `<embed`, `<base`, `<frame`, `<img` (images are
 *   inline SVG) and `<bdo`, and the CSS `@import` rule;
 * - `url(` whose argument is not an `hms-font:` URL or an allowed `data:` URL; `local(` and `image-set(`
 *   (system fonts and image sources outside the document);
 * - a `data:` URL (in `url()` or a URL attribute) of any type but `image/png`, `image/jpeg` and
 *   `image/svg+xml`; an `image/svg+xml` one whose decoded content does not itself pass this lint;
 * - in an `@font-face` rule, any `url()` but `hms-font:` and any `data:` (a font in a `data:` URL would
 *   bypass the font pins of `fonts.json`, spec §7.5, §9);
 * - a URL-bearing attribute (`src`, `href`, `srcset`, `action`, `formaction`, `poster`, `background`,
 *   `ping`, `data`, `cite`, `longdesc`, `manifest`, `codebase`, `xlink:href`) whose value is not an
 *   allowed `data:` URL or a `#` fragment;
 * - a `rel` attribute naming `attachment` (WeasyPrint embeds attachments in the PDF, which breaks
 *   determinism and PDF/A-2b, spec §7.5);
 * - `bidi-override`, `isolate-override` and `unicode-bidi: plaintext`: CSS that reorders text or replaces
 *   the paragraph direction the layout chose (spec §3.2 R7, §4.1);
 * - a backslash inside a `<style>` element or a `style` attribute (a CSS escape could spell `url(` or a
 *   scheme the plain-text checks would not see), and an `&` inside a `style` attribute (a character
 *   reference is decoded before the CSS is read, so `u&#114;l(` would be `url(`).
 *
 * The satellite's offline fetcher refuses remote resources and unpinned fonts again at render time
 * (spec §7.5).
 */
object HtmlLint {
    private val SCHEMES = listOf("http", "https", "file", "ftp", "ws", "wss", "blob", "javascript")
    private val ELEMENTS = listOf("script", "link", "iframe", "object", "embed", "base", "frame", "img", "bdo")

    /** A scheme name not preceded by a character that could continue a word or a scheme (so "Reviews:" is no `ws:`). */
    private val SCHEME = Regex("""(?<![a-z0-9+.-])(${SCHEMES.joinToString("|")}):""", RegexOption.IGNORE_CASE)
    private val ELEMENT = Regex("""<(${ELEMENTS.joinToString("|")})""", RegexOption.IGNORE_CASE)
    private val CSS_TOKEN = Regex("""@import|(?<![a-z0-9-])(local|image-set)\(""", RegexOption.IGNORE_CASE)
    private val BIDI = Regex("""bidi-override|isolate-override|unicode-bidi\s*:\s*plaintext""", RegexOption.IGNORE_CASE)
    private val URL_ATTRIBUTES =
        listOf(
            "src",
            "href",
            "srcset",
            "action",
            "formaction",
            "poster",
            "background",
            "ping",
            "data",
            "cite",
            "longdesc",
            "manifest",
            "codebase",
            "xlink:href",
        )

    private val URL_FUNCTION = Regex("""url\(\s*(['"]?)\s*([^)'"\s]*)""", RegexOption.IGNORE_CASE)
    private val PROTOCOL_RELATIVE = Regex("""(=\s*['"]?\s*//)|(url\(\s*['"]?\s*//)""", RegexOption.IGNORE_CASE)
    private val ATTRIBUTE =
        Regex(
            """[\s"'](${URL_ATTRIBUTES.joinToString("|") { Regex.escape(it) }})\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))""",
            RegexOption.IGNORE_CASE,
        )
    private val REL = Regex("""[\s"']rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))""", RegexOption.IGNORE_CASE)
    private val STYLE_ELEMENT = Regex("""<style[^>]*>(.*?)</style>""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    private val STYLE_ATTRIBUTE = Regex("""\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')""", RegexOption.IGNORE_CASE)
    private val FONT_FACE = Regex("""@font-face\s*\{([^}]*)}""", RegexOption.IGNORE_CASE)

    /** The only `data:` URLs allowed: inline images (spec §7.4: images and barcodes inline). */
    private val ALLOWED_DATA = Regex("""^data:(image/png|image/jpeg|image/svg\+xml)(;[^,]*)?,""", RegexOption.IGNORE_CASE)
    private const val SVG_DATA = "data:image/svg+xml"
    private const val BASE64_PARAMETER = ";base64"

    /** How deep an SVG `data:` URL may nest another one before the lint refuses it. */
    private const val MAX_DATA_DEPTH = 2

    /** Lints [html]; the findings are in document order of their check, each with its offset. */
    fun check(html: String): HtmlLintResult = check(html, depth = 0)

    private fun check(
        html: String,
        depth: Int,
    ): HtmlLintResult {
        val findings = mutableListOf<HtmlLintFinding>()
        for (pattern in listOf(SCHEME, ELEMENT, CSS_TOKEN, BIDI)) {
            pattern.findAll(html).forEach { findings += HtmlLintFinding(it.value.lowercase(), it.range.first) }
        }
        PROTOCOL_RELATIVE.findAll(html).forEach { findings += HtmlLintFinding("protocol-relative URL", it.range.first) }
        findings += urlFunctions(html, depth)
        findings += urlAttributes(html, depth)
        findings += fontFaces(html)
        findings += attachments(html)
        findings += styles(html)
        return if (findings.isEmpty()) HtmlLintResult.Clean else HtmlLintResult.Violations(findings.sortedBy { it.offset })
    }

    private fun urlFunctions(
        html: String,
        depth: Int,
    ): List<HtmlLintFinding> =
        URL_FUNCTION.findAll(html).toList().mapNotNull { match ->
            val target = match.groupValues[2]
            when {
                target.startsWith("hms-font:", ignoreCase = true) -> null
                target.startsWith("data:", ignoreCase = true) -> dataUrl(target, match.range.first, depth)
                else -> HtmlLintFinding("url() target", match.range.first)
            }
        }

    private fun urlAttributes(
        html: String,
        depth: Int,
    ): List<HtmlLintFinding> =
        ATTRIBUTE.findAll(html).toList().mapNotNull { match ->
            val value = attributeValue(match)
            when {
                value.startsWith("#") -> null
                value.startsWith("data:", ignoreCase = true) -> dataUrl(value, match.range.first, depth)
                else -> HtmlLintFinding("${match.groupValues[1].lowercase()} attribute", match.range.first)
            }
        }

    /** A finding for a `data:` URL that is not an allowed image, or an SVG image whose content fails the lint. */
    private fun dataUrl(
        url: String,
        offset: Int,
        depth: Int,
    ): HtmlLintFinding? =
        when {
            !ALLOWED_DATA.containsMatchIn(url) -> {
                HtmlLintFinding("data: URL type", offset)
            }

            !url.startsWith(SVG_DATA, ignoreCase = true) -> {
                null
            }

            depth >= MAX_DATA_DEPTH -> {
                HtmlLintFinding("data: SVG nested too deep", offset)
            }

            else -> {
                val content = decodeData(url)
                val clean = content != null && check(content, depth + 1) == HtmlLintResult.Clean
                if (clean) null else HtmlLintFinding("data: SVG content", offset)
            }
        }

    /** The decoded content of a `data:` URL (base64 or percent-encoded), or null when it does not decode. */
    private fun decodeData(url: String): String? {
        val comma = url.indexOf(',')
        val header = url.substring(0, comma)
        val payload = url.substring(comma + 1)
        return runCatching {
            if (header.endsWith(BASE64_PARAMETER, ignoreCase = true)) {
                String(Base64.getDecoder().decode(payload), Charsets.UTF_8)
            } else {
                URLDecoder.decode(payload, Charsets.UTF_8)
            }
        }.getOrNull()
    }

    /** In an `@font-face` rule only `hms-font:` URLs: no other `url()` and no `data:` at all. */
    private fun fontFaces(html: String): List<HtmlLintFinding> =
        FONT_FACE.findAll(html).toList().flatMap { rule ->
            val body = rule.groups[1] ?: return@flatMap emptyList()
            val urls =
                URL_FUNCTION
                    .findAll(body.value)
                    .filterNot { it.groupValues[2].startsWith("hms-font:", ignoreCase = true) }
                    .map { HtmlLintFinding("url() in @font-face", body.range.first + it.range.first) }
                    .toList()
            val data =
                if (body.value.contains("data:", ignoreCase = true)) {
                    listOf(HtmlLintFinding("data: in @font-face", rule.range.first))
                } else {
                    emptyList()
                }
            urls + data
        }

    /** `rel` naming `attachment` on any element. */
    private fun attachments(html: String): List<HtmlLintFinding> =
        REL.findAll(html).toList().mapNotNull { match ->
            HtmlLintFinding("rel attachment", match.range.first).takeIf { attributeValue(match).contains("attachment", ignoreCase = true) }
        }

    /** Backslashes in CSS, and character references in `style` attributes. */
    private fun styles(html: String): List<HtmlLintFinding> {
        val elements = STYLE_ELEMENT.findAll(html).mapNotNull { it.groups[1] }.toList()
        val attributes = STYLE_ATTRIBUTE.findAll(html).mapNotNull { it.groups[1] ?: it.groups[2] }.toList()
        val backslashes = (elements + attributes).filter { '\\' in it.value }.map { HtmlLintFinding("backslash in CSS", it.range.first) }
        val references =
            attributes.filter { '&' in it.value }.map { HtmlLintFinding("character reference in style attribute", it.range.first) }
        return backslashes + references
    }

    /**
     * The trimmed value of an attribute match, case kept (a base64 payload is case-sensitive): the first
     * non-empty of the double-quoted, single-quoted and unquoted groups, which are the last three groups
     * of both [ATTRIBUTE] and [REL].
     */
    private fun attributeValue(match: MatchResult): String =
        match.groupValues
            .takeLast(VALUE_FORMS)
            .firstOrNull { it.isNotEmpty() }
            .orEmpty()
            .trim()

    private const val VALUE_FORMS = 3
}

/** One lint finding: what was found and where (a UTF-16 offset into the HTML). */
data class HtmlLintFinding(
    val pattern: String,
    val offset: Int,
)

/** The result of [HtmlLint.check]. */
sealed interface HtmlLintResult {
    data object Clean : HtmlLintResult

    data class Violations(
        val findings: List<HtmlLintFinding>,
    ) : HtmlLintResult
}
