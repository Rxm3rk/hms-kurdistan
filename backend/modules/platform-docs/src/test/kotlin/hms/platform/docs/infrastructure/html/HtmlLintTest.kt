package hms.platform.docs.infrastructure.html

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.util.Base64

/** `UnitTest:html-has-no-external-urls` (docs/specs/modules/platform-docs.md §7.4, HAZ-0047). */
class HtmlLintTest :
    FunSpec({
        fun page(inner: String) = "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"></head><body>$inner</body></html>\n"

        fun violations(html: String) =
            HtmlLint
                .check(html)
                .shouldBeInstanceOf<HtmlLintResult.Violations>()
                .findings
                .map { it.pattern }

        test("UnitTest:html-has-no-external-urls: each forbidden pattern is refused") {
            mapOf(
                "http:" to "<p>see http://example.org</p>",
                "https:" to "<p>HTTPS://example.org</p>",
                "file:" to "<p>file:///etc/passwd</p>",
                "ftp:" to "<p>ftp://x</p>",
                "javascript:" to "<p>javascript:alert(1)</p>",
                "<script" to "<script>1</script>",
                "<link" to "<link rel=\"stylesheet\" href=\"x.css\">",
                "<iframe" to "<iframe srcdoc=\"x\"></iframe>",
                "<object" to "<object></object>",
                "<embed" to "<embed>",
                "<img" to "<img alt=\"x\">",
                "<base" to "<base target=\"_self\">",
                "@import" to "<style>@import 'x.css';</style>",
                "url() target" to "<style>@font-face { src: url(fonts/x.ttf); }</style>",
                "protocol-relative URL" to "<style>p { background: url(//cdn.example/x.png); }</style>",
                "local(" to "<style>@font-face { src: local(Arial); }</style>",
                "href attribute" to "<svg><image href=\"x.png\"/></svg>",
                "src attribute" to "<audio src=\"x.ogg\"></audio>",
                "backslash in CSS" to "<p style=\"background: u\\72l(x)\">x</p>",
            ).forEach { (pattern, inner) ->
                violations(page(inner)).contains(pattern) shouldBe true
            }
        }

        fun base64(text: String) = Base64.getEncoder().encodeToString(text.toByteArray(Charsets.UTF_8))

        test("UnitTest:html-has-no-external-urls: a data: URL is allowed only for image/png, image/jpeg and image/svg+xml") {
            violations(page("<style>p { background: url(data:font/ttf;base64,AAAA); }</style>")) shouldContain "data: URL type"
            violations(page("<style>p { background: url('data:text/html,x'); }</style>")) shouldContain "data: URL type"
            violations(page("<svg><image href=\"data:application/octet-stream;base64,AAAA\"/></svg>")) shouldContain "data: URL type"
            violations(page("<svg><image href=\"data:,plain\"/></svg>")) shouldContain "data: URL type"
            listOf("image/png", "image/jpeg", "IMAGE/PNG").forEach { type ->
                HtmlLint.check(page("<svg><image href=\"data:$type;base64,AAAA\"/></svg>")) shouldBe HtmlLintResult.Clean
            }
        }

        test("UnitTest:html-has-no-external-urls: no data: URL and no url() but hms-font: in an @font-face rule") {
            val pngFont = "<style>@font-face { font-family: \"f\"; src: url(data:image/png;base64,AAAA); }</style>"
            violations(page(pngFont)).let {
                it shouldContain "data: in @font-face"
                it shouldContain "url() in @font-face"
            }
            violations(page("<style>@font-face { font-family: \"f\"; src: url(data:font/woff2;base64,AAAA); }</style>")) shouldContain
                "data: in @font-face"
            violations(page("<style>@font-face { font-family: \"f\"; src: url(hms-font:a), url(other.ttf); }</style>")) shouldContain
                "url() in @font-face"
            HtmlLint.check(page("<style>@font-face { font-family: \"f\"; src: url(hms-font:noto-sans-regular); }</style>")) shouldBe
                HtmlLintResult.Clean
        }

        test("UnitTest:html-has-no-external-urls: an SVG data: URL must itself pass the lint, base64 or percent-encoded") {
            val external = "<svg><image href=\"https://cdn.example/x.png\"/></svg>"
            violations(page("<svg><image href=\"data:image/svg+xml;base64,${base64(external)}\"/></svg>")) shouldContain "data: SVG content"
            // Percent-encoded, so the outer document holds no "http:" for the plain-text check to see.
            val percent = "data:image/svg+xml,%3Csvg%3E%3Cimage%20href=%22http%3A//x%22/%3E%3C/svg%3E"
            violations(page("<style>p { background: url($percent); }</style>")) shouldContain "data: SVG content"
            violations(page("<svg><image href=\"data:image/svg+xml;base64,@@not-base64@@\"/></svg>")) shouldContain "data: SVG content"
            val clean = "<svg viewBox=\"0 0 1 1\"><rect width=\"1\" height=\"1\"/></svg>"
            HtmlLint.check(page("<svg><image href=\"data:image/svg+xml;base64,${base64(clean)}\"/></svg>")) shouldBe HtmlLintResult.Clean
            // An SVG data: URL inside one inside another is refused at the depth limit.
            val level2 = "<svg><image href=\"data:image/svg+xml;base64,${base64(clean)}\"/></svg>"
            val level1 = "<svg><image href=\"data:image/svg+xml;base64,${base64(level2)}\"/></svg>"
            violations(page("<svg><image href=\"data:image/svg+xml;base64,${base64(level1)}\"/></svg>")) shouldContain "data: SVG content"
        }

        test("UnitTest:html-has-no-external-urls: rel naming attachment is refused on any element") {
            violations(page("<a rel=\"attachment\" href=\"#x\">x</a>")) shouldContain "rel attachment"
            violations(page("<div rel='Attachment noopener'>x</div>")) shouldContain "rel attachment"
            violations(page("<span rel=attachment>x</span>")) shouldContain "rel attachment"
            HtmlLint.check(page("<a rel=\"noopener\" href=\"#x\">x</a>")) shouldBe HtmlLintResult.Clean
        }

        test("UnitTest:html-has-no-external-urls: <bdo>, bidi-override, isolate-override and unicode-bidi: plaintext are refused") {
            violations(page("<bdo dir=\"rtl\">SYN-000123-7</bdo>")) shouldContain "<bdo"
            violations(page("<p style=\"unicode-bidi: bidi-override\">x</p>")) shouldContain "bidi-override"
            violations(page("<style>p { unicode-bidi: isolate-override; }</style>")) shouldContain "isolate-override"
            violations(page("<p style=\"unicode-bidi:  PLAINTEXT\">x</p>")).any { it.startsWith("unicode-bidi") } shouldBe true
            HtmlLint.check(page("<p style=\"unicode-bidi: isolate\">x</p>")) shouldBe HtmlLintResult.Clean
        }

        test("UnitTest:html-has-no-external-urls: a character reference in a style attribute is refused") {
            violations(page("<p style=\"background: u&#114;l(x)\">x</p>")) shouldContain "character reference in style attribute"
            violations(page("<p style='font-family: &quot;x&quot;'>x</p>")) shouldContain "character reference in style attribute"
        }

        test("a protocol-relative attribute value is refused") {
            violations(page("<a href=\"//cdn.example/x\">x</a>")).contains("protocol-relative URL") shouldBe true
        }

        test("hms-font: and data: URLs, # fragments and ordinary text pass") {
            HtmlLint.check(
                page(
                    "<style>@font-face { font-family: \"f\"; src: url(hms-font:noto-sans-regular); } " +
                        "p { background: url('data:image/png;base64,AAAA'); }</style>" +
                        "<a href=\"#top\">Reviews: 3; profile: SYN-1; MRN: SYN-000123-7 // note</a>" +
                        "<svg viewBox=\"0 0 2 2\"><rect x=\"0\" y=\"0\" width=\"1\" height=\"1\"/></svg>",
                ),
            ) shouldBe HtmlLintResult.Clean
        }

        test("findings carry their offset") {
            val html = page("<script></script>")
            HtmlLint
                .check(html)
                .shouldBeInstanceOf<HtmlLintResult.Violations>()
                .findings
                .single()
                .offset shouldBe html.indexOf("<script")
        }
    })
