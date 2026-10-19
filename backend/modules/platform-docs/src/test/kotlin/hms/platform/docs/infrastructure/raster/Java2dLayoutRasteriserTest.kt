package hms.platform.docs.infrastructure.raster

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.PrintFont
import hms.platform.docs.infrastructure.text.Java2dTextShaper
import hms.platform.docs.infrastructure.text.SoraniLetters
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.awt.RenderingHints
import java.awt.Shape
import java.awt.geom.AffineTransform
import java.awt.geom.FlatteningPathIterator
import java.awt.geom.Line2D
import java.awt.geom.Path2D
import java.awt.geom.PathIterator
import java.awt.image.BufferedImage

/**
 * The 1-bit rasteriser (docs/specs/modules/platform-docs.md §5.4, §7.2, §7.3, §10). Text is synthetic
 * (§19.4).
 */
class Java2dLayoutRasteriserTest :
    FunSpec({
        val registry = FontRegistry.fromClasspath()
        val shaper = Java2dTextShaper(registry)
        val rasteriser = Java2dLayoutRasteriser(shaper)
        val mmPerPt = Java2dLayoutRasteriser.MM_PER_PT

        fun layout(
            widthMm: Double,
            heightMm: Double,
            rotation: Int = 0,
            lines: List<PlacedLine> = emptyList(),
            rules: List<PlacedRule> = emptyList(),
        ) = Layout(
            templateId = "SYN-RASTER-TEST",
            templateVersion = 1,
            templateHash = "0".repeat(64),
            kind = TemplateKind.WRISTBAND,
            language = LabelLanguage.EN,
            synthetic = true,
            frameWidthMm = widthMm,
            frameHeightMm = heightMm,
            rotation = rotation,
            lines = lines,
            barcodes = emptyList(),
            rules = rules,
        )

        /** A start-aligned line placed the way the fit rule places it: baseline at the hhea ascent, box 1/0.95 of the width. */
        fun line(
            text: String,
            fonts: List<FontSpec>,
            sizePt: Double,
            xMm: Double,
            topMm: Double,
        ): PlacedLine {
            val shaped = shaper.shape(text, fonts, sizePt, Direction.AUTO)
            val width = shaped.advancePt * mmPerPt
            return PlacedLine(
                text = text,
                fonts = fonts,
                sizePt = sizePt,
                rightToLeft = shaped.rightToLeft,
                align = Align.START,
                boxXMm = xMm,
                boxWidthMm = width / 0.95,
                topMm = topMm,
                baselineMm = topMm + shaped.ascentPt * mmPerPt,
                lineHeightMm = shaped.lineHeightPt * mmPerPt,
                measuredWidthMm = width,
            )
        }

        data class Ink(
            val minX: Int,
            val minY: Int,
            val maxX: Int,
            val maxY: Int,
        )

        fun ink(bitmap: MonoBitmap): Ink? {
            var minX = Int.MAX_VALUE
            var minY = Int.MAX_VALUE
            var maxX = -1
            var maxY = -1
            for (y in 0 until bitmap.height) {
                for (x in 0 until bitmap.width) {
                    if (bitmap.get(x, y)) {
                        minX = minOf(minX, x)
                        minY = minOf(minY, y)
                        maxX = maxOf(maxX, x)
                        maxY = maxOf(maxY, y)
                    }
                }
            }
            return if (maxX < 0) null else Ink(minX, minY, maxX, maxY)
        }

        val arabic = listOf(PrintFont.ARABIC_REGULAR.spec)
        val arabicBold = listOf(PrintFont.ARABIC_BOLD.spec)
        val latin = listOf(PrintFont.LATIN_REGULAR.spec)
        val soraniName = "ئاراس کەریم"

        test("a known line gives the same bitmap twice, also from a new rasteriser") {
            val l = layout(60.0, 15.0, lines = listOf(line("$soraniName SYN-0012345", arabic + latin, 10.0, 2.0, 2.0)))
            val first = rasteriser.rasterise(l, 8.0)
            first.bitmap.blackCount() shouldBeGreaterThan 100
            rasteriser.rasterise(l, 8.0) shouldBe first
            Java2dLayoutRasteriser(Java2dTextShaper(registry)).rasterise(l, 8.0) shouldBe first
        }

        test("the raster is the whole reading frame at the media's home") {
            val r = rasteriser.rasterise(layout(25.4, 10.0), 8.0)
            r.xDots shouldBe 0
            r.yDots shouldBe 0
            r.bitmap.width shouldBe 203 // 25.4 × 8 = 203.2
            r.bitmap.height shouldBe 80
            rasteriser.rasterise(layout(25.4, 10.0), 12.0).bitmap.width shouldBe 305 // 304.8
            rasteriser.rasterise(layout(25.4, 10.0), 7.087).bitmap.width shouldBe 180 // 180.0098
        }

        test("rotation 90: an asymmetric mark at the frame's top-left lands at the media's right edge, start of the feed") {
            // Frame 20 × 10 mm at 8 dots/mm = 160 × 80 dots; a 2 × 1 mm rule at the top-left corner.
            val rule = PlacedRule(0.0, 0.0, 2.0, 1.0)
            val upright = rasteriser.rasterise(layout(20.0, 10.0, rotation = 0, rules = listOf(rule)), 8.0).bitmap
            ink(upright) shouldBe Ink(0, 0, 15, 7)
            val turned = rasteriser.rasterise(layout(20.0, 10.0, rotation = 90, rules = listOf(rule)), 8.0).bitmap
            turned.width shouldBe 80 // across the head: the frame's height
            turned.height shouldBe 160 // along the feed: the frame's width
            // The frame's x axis (16 dots of the rule) runs along the feed; its top edge lies on the right.
            ink(turned) shouldBe Ink(72, 0, 79, 15)
        }

        test("rotation 90: every dot of a text line maps by (x, y) → (H − 1 − y, x)") {
            val lines = listOf(line("$soraniName SYN-0012345", arabic + latin, 9.0, 1.0, 1.0))
            val upright = rasteriser.rasterise(layout(70.0, 12.0, 0, lines), 12.0).bitmap
            val turned = rasteriser.rasterise(layout(70.0, 12.0, 90, lines), 12.0).bitmap
            turned.width shouldBe upright.height
            turned.height shouldBe upright.width
            for (y in 0 until upright.height) {
                for (x in 0 until upright.width) {
                    if (turned.get(upright.height - 1 - y, x) != upright.get(x, y)) error("dot ($x, $y) differs")
                }
            }
            turned.blackCount() shouldBe upright.blackCount()
        }

        test("mm to dots rounds half up once per coordinate, never accumulated") {
            // x = 0.3125 mm × 8 = 2.5 → 3 (half up, not half even); right edge 0.3125 + 0.375 = 0.6875 mm → 5.5 → 6.
            val r1 = rasteriser.rasterise(layout(5.0, 5.0, rules = listOf(PlacedRule(0.3125, 0.0, 0.375, 1.0))), 8.0).bitmap
            ink(r1) shouldBe Ink(3, 0, 5, 7)
            // x = 0.06 mm → 0.48 → 0; right edge 0.12 mm → 0.96 → 1: one dot wide. Rounding the width
            // separately (0.48 → 0) would accumulate and lose the rule.
            val r2 = rasteriser.rasterise(layout(5.0, 5.0, rules = listOf(PlacedRule(0.06, 0.06, 0.06, 0.06))), 8.0).bitmap
            ink(r2) shouldBe Ink(0, 0, 0, 0)
            // 180 dpi: 7.087 dots/mm; x = 1 mm → 7.087 → 7; right edge 3 mm → 21.261 → 21.
            val r3 = rasteriser.rasterise(layout(5.0, 5.0, rules = listOf(PlacedRule(1.0, 1.0, 2.0, 2.0))), 7.087).bitmap
            ink(r3) shouldBe Ink(7, 7, 20, 20)
        }

        test("rules are filled exactly: every dot of the rectangle and nothing else") {
            val rules = listOf(PlacedRule(2.0, 3.0, 10.0, 0.5), PlacedRule(1.0, 8.0, 0.25, 4.0))
            val bitmap = rasteriser.rasterise(layout(20.0, 15.0, rules = rules), 8.0).bitmap
            bitmap.blackCount() shouldBe 80 * 4 + 2 * 32
            for (y in 24 until 28) for (x in 16 until 96) bitmap.get(x, y) shouldBe true
            for (y in 64 until 96) for (x in 8 until 10) bitmap.get(x, y) shouldBe true
        }

        test("barcodes are not drawn") {
            val barcode = PlacedBarcode(Symbology.DATAMATRIX, "HMS1|M:SYN-0012345|E:SYN-E1|B:SYN-J1", 2.0, 2.0, 0.5, 10.0)
            rasteriser.rasterise(layout(20.0, 15.0).copy(barcodes = listOf(barcode)), 8.0).bitmap.blackCount() shouldBe 0
        }

        test("ink stays inside its line box (± 1 dot) for Sorani, Arabic and Latin lines") {
            val cases =
                buildList {
                    SoraniLetters.ALL.forEach { l ->
                        val b = SoraniLetters.PARTNER
                        add("${l.char} $b${l.char} $b${l.char}$b ${l.char}$b" to arabicBold)
                        add("${l.char} $b${l.char} $b${l.char}$b ${l.char}$b" to arabic)
                    }
                    add(soraniName to arabicBold)
                    add("إِسْمَاعِيل آمِنَة ئۆمێد" to arabic) // marks above and below
                    add("Ágjpqy|ÇŞ SYN-0012345" to latin)
                    add("$soraniName SYN-0012345" to arabic + latin)
                }
            for (dpmm in listOf(8.0, 12.0)) {
                cases.forEach { (text, fonts) ->
                    val l = line(text, fonts, 12.0, 3.0, 2.0)
                    val bitmap = rasteriser.rasterise(layout(80.0, 14.0, lines = listOf(l)), dpmm).bitmap
                    val box = ink(bitmap)!!
                    withClue("$text at $dpmm dots/mm: ink $box") {
                        box.minX shouldBeGreaterThanOrEqual Dots.of(l.boxXMm, dpmm) - 1
                        box.maxX shouldBeLessThanOrEqual Dots.of(l.boxXMm + l.boxWidthMm, dpmm) + 1
                        box.minY shouldBeGreaterThanOrEqual Dots.of(l.topMm, dpmm) - 1
                        box.maxY shouldBeLessThanOrEqual Dots.of(l.topMm + l.lineHeightMm, dpmm) + 1
                    }
                }
            }
        }

        test("alignment: start is the left edge for left-to-right and the right edge for right-to-left lines") {
            val dpmm = 8.0
            val ltr = line("SYN-0012345", latin, 10.0, 5.0, 1.0).copy(boxWidthMm = 50.0)
            val rtl = line(soraniName, arabic, 10.0, 5.0, 1.0).copy(boxWidthMm = 50.0)
            val ltrInk = ink(rasteriser.rasterise(layout(70.0, 10.0, lines = listOf(ltr)), dpmm).bitmap)!!
            val rtlInk = ink(rasteriser.rasterise(layout(70.0, 10.0, lines = listOf(rtl)), dpmm).bitmap)!!
            (ltrInk.minX - 40) shouldBeLessThanOrEqual 3 // the left side bearing of "S"
            (440 - 1 - rtlInk.maxX) shouldBeLessThanOrEqual 3 // box right edge 55 mm = 440 dots
            val rtlEnd = rtl.copy(align = Align.END)
            val endInk = ink(rasteriser.rasterise(layout(70.0, 10.0, lines = listOf(rtlEnd)), dpmm).bitmap)!!
            (endInk.minX - 40) shouldBeLessThanOrEqual 3
            val centred = ltr.copy(align = Align.CENTER)
            val centreInk = ink(rasteriser.rasterise(layout(70.0, 10.0, lines = listOf(centred)), dpmm).bitmap)!!
            val mid = (centreInk.minX + centreInk.maxX) / 2
            (mid - 240) shouldBeLessThanOrEqual 3 // box centre 30 mm = 240 dots
            (240 - mid) shouldBeLessThanOrEqual 3
        }

        /** The glyph outlines of a mixed Sorani and Latin line in dots, one shape per segment, and their frame. */
        fun sampleOutlines(): Pair<List<Shape>, Pair<Int, Int>> {
            val dotsPerPt = 12.0 * mmPerPt
            val shaped = shaper.layout("$soraniName SYN-0012345", arabic + latin, 14.0, Direction.AUTO)
            val shapes =
                shaped.segments.map { segment ->
                    AffineTransform(dotsPerPt, 0.0, 0.0, dotsPerPt, 20.3 + segment.xPt * dotsPerPt, 80.4)
                        .createTransformedShape(segment.glyphs.outline)
                }
            return shapes to (900 to 120)
        }

        /** The polyline [ScanlineFill] fills for [shape]: the same flattening, as a closed path. */
        fun flattened(shape: Shape): Path2D.Double =
            Path2D.Double(Path2D.WIND_NON_ZERO).apply {
                append(FlatteningPathIterator(shape.getPathIterator(null), ScanlineFill.FLATNESS, 16), false)
            }

        fun distanceToEdge(
            path: Path2D,
            px: Double,
            py: Double,
        ): Double {
            var best = Double.MAX_VALUE
            val it = path.getPathIterator(null)
            val c = DoubleArray(6)
            var sx = 0.0
            var sy = 0.0
            var lx = 0.0
            var ly = 0.0
            while (!it.isDone) {
                when (it.currentSegment(c)) {
                    PathIterator.SEG_MOVETO -> {
                        sx = c[0]
                        sy = c[1]
                        lx = sx
                        ly = sy
                    }

                    PathIterator.SEG_LINETO -> {
                        best = minOf(best, Line2D.ptSegDist(lx, ly, c[0], c[1], px, py))
                        lx = c[0]
                        ly = c[1]
                    }

                    PathIterator.SEG_CLOSE -> {
                        best = minOf(best, Line2D.ptSegDist(lx, ly, sx, sy, px, py))
                    }
                }
                it.next()
            }
            return best
        }

        test("ScanlineFill blackens exactly the dots whose centre is inside the outline (spec §7.2)") {
            // Oracle: Path2D.contains on the same flattened polygon, with Java's insideness rule (a point on
            // the boundary is inside when the interior is immediately right or below, the half-open rule).
            val (shapes, size) = sampleOutlines()
            val (width, height) = size
            val ours = FrameBuffer(width, height)
            shapes.forEach { ScanlineFill.fill(it, AffineTransform(), ours) }
            val polygons = shapes.map(::flattened)
            var black = 0
            for (y in 0 until height) {
                for (x in 0 until width) {
                    val inside = polygons.any { it.contains(x + 0.5, y + 0.5) }
                    if (inside) black++
                    if (inside != ours.isBlack(x, y)) error("dot ($x, $y): centre inside = $inside, filled = ${ours.isBlack(x, y)}")
                }
            }
            black shouldBeGreaterThan 1000
        }

        test("ScanlineFill agrees with Java2D's non-anti-aliased fill except at dots within an eighth of a dot of an edge") {
            // Graphics2D with antialiasing off and pure strokes on a TYPE_BYTE_BINARY image also fills by
            // pixel centres, but Marlin snaps coordinates to a sub-pixel grid, so a centre within that grid
            // step of an edge may land on the other side. Every differing dot must have its centre within
            // an eighth of a dot of the polygon's boundary (the counts and the farthest distance
            // are printed).
            val (shapes, size) = sampleOutlines()
            val (width, height) = size
            val ours = FrameBuffer(width, height)
            val image = BufferedImage(width, height, BufferedImage.TYPE_BYTE_BINARY)
            val g = image.createGraphics()
            g.color = java.awt.Color.WHITE
            g.fillRect(0, 0, width, height)
            g.color = java.awt.Color.BLACK
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF)
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE)
            shapes.forEach {
                ScanlineFill.fill(it, AffineTransform(), ours)
                g.fill(it)
            }
            g.dispose()
            val polygons = shapes.map(::flattened)
            var black = 0
            var oursOnly = 0
            var java2dOnly = 0
            var farthest = 0.0
            for (y in 0 until height) {
                for (x in 0 until width) {
                    val java2d = image.getRGB(x, y) and 0xFFFFFF == 0
                    val filled = ours.isBlack(x, y)
                    if (filled) black++
                    if (java2d != filled) {
                        if (filled) oursOnly++ else java2dOnly++
                        farthest = maxOf(farthest, polygons.minOf { distanceToEdge(it, x + 0.5, y + 0.5) })
                    }
                }
            }
            println(
                "ScanlineFill vs Java2D non-AA fill: $black black dots; $oursOnly only ours, $java2dOnly only Java2D; " +
                    "farthest centre from an edge $farthest dots",
            )
            black shouldBeGreaterThan 1000
            (farthest <= 0.125) shouldBe true
        }

        test("an unsupported rotation or resolution is a programming error") {
            runCatching { rasteriser.rasterise(layout(10.0, 10.0, rotation = 180), 8.0) }.isFailure shouldBe true
            runCatching { rasteriser.rasterise(layout(10.0, 10.0), 0.0) }.isFailure shouldBe true
        }

        test("a line with a missing glyph is never drawn: the rasteriser fails closed") {
            // Sorani text in the latin font: R7 refuses it before layout; the rasteriser refuses it again.
            val placed = line("SYN-0012345", latin, 10.0, 1.0, 1.0).copy(text = soraniName)
            val failure = runCatching { rasteriser.rasterise(layout(40.0, 10.0, lines = listOf(placed)), 8.0) }.exceptionOrNull()
            (failure is IllegalStateException) shouldBe true
        }

        test("a line drawn at 12 dots/mm differs from the same line at 8 (the resolution is part of the image)") {
            val l = layout(40.0, 10.0, lines = listOf(line(soraniName, arabic, 10.0, 1.0, 1.0)))
            rasteriser.rasterise(l, 12.0).bitmap shouldNotBe rasteriser.rasterise(l, 8.0).bitmap
        }
    })
