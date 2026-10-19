package hms.satellites.pdfaverify

import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path

/** Test PDFs for the checker; all content is synthetic (SYN- identifiers, NOT FOR CLINICAL USE). */
object TestPdfs {
    /** The WeasyPrint 70.0 PDF/A-2b spike output (synthetic Sorani test text; README.md "Test data"). */
    const val WEASYPRINT_SAMPLE = "weasyprint-pdfa-2b-sample.pdf"

    /**
     * A minimal, valid PDF 1.4 that is deliberately not PDF/A: no XMP metadata, no output intent, no
     * file identifier, no binary header comment and a non-embedded standard font (Helvetica). Written byte
     * by byte with a correct cross-reference table, so a parse failure cannot explain the verdict.
     */
    fun plainPdf14(): ByteArray {
        val content = "BT /F1 12 Tf 72 770 Td (SYN-000001 NOT FOR CLINICAL USE) Tj ET"
        val objects =
            listOf(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
                    "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
                "<< /Length ${content.length} >>\nstream\n$content\nendstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            )
        val out = ByteArrayOutputStream()

        fun write(text: String) = out.write(text.toByteArray(Charsets.ISO_8859_1))
        write("%PDF-1.4\n")
        val offsets =
            objects.mapIndexed { index, body ->
                val offset = out.size()
                write("${index + 1} 0 obj\n$body\nendobj\n")
                offset
            }
        val xrefOffset = out.size()
        write("xref\n0 ${objects.size + 1}\n")
        write("0000000000 65535 f \n")
        offsets.forEach { write("${it.toString().padStart(XREF_OFFSET_DIGITS, '0')} 00000 n \n") }
        write("trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n$xrefOffset\n%%EOF\n")
        return out.toByteArray()
    }

    /** Writes the classpath resource [name] to [directory] and returns the copy. */
    fun copyResource(
        name: String,
        directory: Path,
    ): Path {
        val bytes =
            checkNotNull(TestPdfs::class.java.getResourceAsStream("/$name")) { "test resource $name is missing" }
                .use { it.readAllBytes() }
        return Files.write(directory.resolve(name), bytes)
    }

    private const val XREF_OFFSET_DIGITS = 10
}
