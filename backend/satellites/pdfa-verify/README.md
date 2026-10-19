# pdfa-verify: the PDF/A-2b checker (build-only)

The command that validates the renderer satellite's PDFs against PDF/A-2b (ISO 19005-2, level B) with
veraPDF, for the nightly `golden-image-print` step (`docs/specs/modules/platform-docs.md` §1, §7.5, §10;
the check `PdfaCheck:veraPDF-2b`). Gradle project `:satellites:pdfa-verify`, package
`hms.satellites.pdfaverify`.

**BUILD-ONLY. Never shipped.** This project is a build and CI tool. It is not packaged into any container
image, Helm chart, desktop or mobile build, web bundle or offline media delivered to a site, and nothing
that ships depends on it. Under `tools/licence/policy.yaml` it is in the `build-only` scope: it is checked
for use restrictions only (BUILD-PROMPT §4.3). veraPDF is dual-licensed (GPL-3.0-or-later or
MPL-2.0-or-later); we use it under **MPL-2.0**, unmodified.

## Use

```sh
# Through Gradle (the golden step); a relative path is taken from the directory Gradle was started in.
backend/gradlew -p backend :satellites:pdfa-verify:verifyPdfa -PpdfaInput=<file-or-directory>
```

- A directory stands for every `*.pdf` below it (any depth, sorted by path).
- One JSON line per file on standard output:
  - `{"file":"…","verdict":"compliant","flavour":"2b","checks":N}`
  - `{"file":"…","verdict":"non-compliant","flavour":"2b","failures":[{"specification":"ISO 19005-2:2011","clause":"6.6.2.1","test":1,"description":"…","failedChecks":1}]}`
  - `{"file":"…","verdict":"unreadable","reason":"…"}`
- Exit 0 only when every file is compliant. Exit 1 when any file is non-compliant or unreadable, a named
  path does not exist, or a directory holds no PDF (fail closed). Exit 2 on a usage error. The Gradle
  task fails on any non-zero exit.
- The flavour is forced to 2b whatever the file claims in its XMP metadata.

The library entry point is `PdfaVerifier.verify(Path): PdfaVerdict` (`Compliant`, `NonCompliant` with
every failed rule's clause, test number, description and failed-check count, or `Unreadable`).

## Dependencies (resolved 2026-10-19, Maven Central only)

The settings file allows Maven Central only (`FAIL_ON_PROJECT_REPOS`); the `vera-dev` repository named in
veraPDF's parent POM is ignored by Gradle, and every artefact below resolved from Maven Central. Version
rule (BUILD-PROMPT §4.1): veraPDF's newest release line with a patch release is 1.30 (1.30.1, 1.30.2,
1.30.3), pinned at 1.30.3 in `backend/gradle/libs.versions.toml`. Declared: `org.verapdf:validation-model`
(the PDFBox-free "greenfield" model) and `org.verapdf:core` (the API used directly). Not used:
`org.verapdf.apps:*`, the PDFBox model, `wcag-validation` (optional in the POM, not resolved).

The Spring Boot BOM, which `hms.kotlin-conventions` applies to every project, would move
`com.sun.xml.bind:jaxb-impl` and `jaxb-core` to the Jakarta-only 4.x line; veraPDF uses
`javax.xml.bind`, so this project pins both strictly to veraPDF's own versions. The BOM also raises
nothing else on this classpath that veraPDF does not already ask for (veraPDF 1.30.3 itself asks for
jackson-databind 2.22.3).

SHA-256 of each jar on the runtime classpath, computed from the Gradle cache
(`.tools/gradle-home/caches/modules-2/files-2.1/`); licences as declared in each POM or its parent POM:

| Artefact | Version | Licence (POM) | SPDX, policy scope `build-only` | SHA-256 of the jar |
|---|---|---|---|---|
| org.verapdf:validation-model | 1.30.3 | GPL-3.0; MPL-2.0 (parent `verapdf-parent`) | MPL-2.0 (our option) | `368de78a2143f62b871e2f5eb0bb27d26a04eff2883a44d426f840d87b7fc55c` |
| org.verapdf:core | 1.30.3 | GPL-3.0; MPL-2.0 (parent) | MPL-2.0 (our option) | `c8b461a8542de34cb99a26496dfdc3b5a97a5deceb41fd417c7914aeffbede42` |
| org.verapdf:parser | 1.30.3 | GPL-3.0; MPL-2.0 (parent) | MPL-2.0 (our option) | `f6318245ddd4aeb7ceebb4a946f226c2d4e0f7ee129517c265048398186ac354` |
| org.verapdf:pdf-model | 1.30.3 | GPL-3.0; MPL-2.0 (parent) | MPL-2.0 (our option) | `5678ba09f16d7c9f8e8c764f1706efb9f875ee066a0a9fe8d6b3fb5dceb691a5` |
| org.verapdf:feature-reporting | 1.30.3 | GPL-3.0; MPL-2.0 (parent) | MPL-2.0 (our option) | `bf94dc85aec1c464344e2238866eb29927da277749c946095575a5654d0dde01` |
| org.verapdf:metadata-fixer | 1.30.3 | GPL-3.0; MPL-2.0 (parent) | MPL-2.0 (our option) | `89a9ed3757b8c9bb4091bf37d591f8fce3dbd9c26b454f6ac1f2268eeeaa2988` |
| org.verapdf:verapdf-xmp-core | 1.30.3 | BSD 3-Clause License | BSD-3-Clause | `0568b92f256526c5eaab36f0112f3098fbffd67d7174e256f694ade955880d0a` |
| net.sf.saxon:Saxon-HE | 12.8 | Mozilla Public License Version 2.0 | MPL-2.0 | `58220adcb289dbebe0053e7a73ee70c97545c88f4886943d64241bf24701b72a` |
| org.xmlresolver:xmlresolver | 5.3.3 | Apache License version 2.0 | Apache-2.0 | `1fe4d5b92f708dcdb82dbce12919e0171e6b5ca62c6dca6220483625098feb5f` |
| org.xmlresolver:xmlresolver (classifier `data`) | 5.3.3 | Apache License version 2.0 | Apache-2.0 | `b0c487ad2f3e558be8d829c916d2458d10aca6a5bafa7a4d0524b70845e48a5c` |
| org.mozilla:rhino | 1.7.15.1 | Mozilla Public License, Version 2.0 | MPL-2.0 | `f3520a0e2e22d550f1216a456be233eb5385bf08e3219407dece7a16369eb38f` |
| javax.xml.bind:jaxb-api | 2.4.0-b180830.0359 | CDDL 1.1; GPL2 w/ CPE (parent) | CDDL-1.1 | `56b9e9702753763007435162ea788055efcfefc86ab920f032c0411dc547b836` |
| javax.activation:javax.activation-api | 1.2.0 | CDDL/GPLv2+CE (parent) | CDDL-1.1 | `43fdef0b5b6ceb31b0424b208b930c74ab58fac2ceeb7b3f6fd3aeb8b5ca4393` |
| com.sun.xml.bind:jaxb-impl | 2.3.2 (strict) | Eclipse Distribution License - v 1.0 (parent) | BSD-3-Clause | `b3a3d3aeaa5503cadc24dca9539b87efcd7bc3bd8c48018887a1489f2a77bdc0` |
| com.sun.xml.bind:jaxb-core | 2.3.0.1 (strict) | CDDL+GPL License (parent) | CDDL-1.1 | `d2ecba63615f317a11fb55c6468f6a9480f6411c10951d9881bafd9a9a8d0467` |
| net.java.dev.stax-utils:stax-utils | 20070216 | BSD (variant not stated) | BSD (unmapped; no use restriction) | `7c7fd0892cb3362ed2e43ce2f76c8f18f2d7ff1d371ed7490775b7368f3fee9a` |
| com.fasterxml.jackson.core:jackson-databind | 2.22.3 | The Apache Software License, Version 2.0 | Apache-2.0 | `556db5439e206114346043f68d200497dc96a0bca62a360a81784092ebd0e0a9` |
| com.fasterxml.jackson.core:jackson-core | 2.22.3 | The Apache Software License, Version 2.0 | Apache-2.0 | `8a501126a385b25841915d839508f8a66e2a0dbc8a6709d055ef3b3e852b094c` |
| com.fasterxml.jackson.core:jackson-annotations | 2.22 | The Apache Software License, Version 2.0 | Apache-2.0 | `21ddb598807d3a51a876704eb979d9296e1c6a6f47ab1826ff88c6d6a127a2d0` |

The runtime classpath also holds kotlin-stdlib 2.3.21 and org.jetbrains:annotations 13.0 (Apache-2.0), as
every backend project does. Two platforms (POM only, no jar) take part in resolution:
`com.fasterxml.jackson:jackson-bom` 2.22.3 (Apache License, Version 2.0; brought by jackson-core) and
`org.springframework.boot:spring-boot-dependencies` 4.1.1 (Apache-2.0; applied by `hms.kotlin-conventions`
to every project). None is on the policy's denylist or among its named exclusions, and none declares a use
restriction, so all are acceptable for the build-only scope. Several (MPL-2.0, CDDL-1.1, the GPL options)
would need the shipped-scope review if anyone ever proposed shipping this tool; nobody does.

Four POM licence names above are not among the aliases of `tools/licence/policy.yaml` ("CDDL 1.1; GPL2 w/
CPE", "CDDL/GPLv2+CE", "CDDL+GPL License", "BSD"), so a mechanical licence check of this classpath would
report them as unmapped until aliases or ORT curations are recorded for them; the SPDX column gives the
reading above. The licence scan must treat this project as build-only: its sources and runtime classpath
are never in a shipped artefact (the repository's `.ort.yml` excludes `backend/satellites/pdfa-verify/**`
as `BUILD_TOOL_OF`).

## veraPDF's verdict on the WeasyPrint spike output (2026-10-19, veraPDF 1.30.3, flavour forced to 2b)

| File (`build/docrender-spike/out/`) | Verdict | Rule checks or failed rules |
|---|---|---|
| `pdfa-2b-run1.pdf` (= the committed sample) | compliant | 8,054 checks |
| `pdfa-2b-dated-run1.pdf` | compliant | 8,074 checks |
| `pdfa-2u-run1.pdf` | compliant (judged as 2b) | 8,054 checks |
| `plain-run1.pdf` (no PDF/A variant) | non-compliant | 6.1.3 test 1 (no trailer `ID`, 1 check); 6.2.4.3 test 2 (DeviceRGB without an output intent, 484 checks); 6.6.2.1 test 1 (no XMP metadata, 1 check) |

## Test data

- `src/test/resources/weasyprint-pdfa-2b-sample.pdf` (SHA-256
  `5f0cf723aed02b949cd4667beb408e69abd145cc3b28742714e02ddeda90f36a`): a copy of the WP-0.8 renderer
  spike's output `build/docrender-spike/out/pdfa-2b-run1.pdf`, made by WeasyPrint 70.0 (pydyf 0.13.0) with
  `pdf_variant="pdf/a-2b"`. Content checked before committing (pypdfium2 text extraction): only synthetic
  test text: the synthetic name شیلان ئەحمەد, the Arabic word مستشفى, the identifier `SYN-000123-7` with the
  date 1990-01-01, and a table of Sorani letters in their contextual forms. Title "WP-0.8 spike: Sorani
  shaping", author "HMS spike". No local file path is embedded. It carries no "NOT FOR CLINICAL USE"
  marking because it predates the templates; it holds no patient data.
- The non-compliant PDF is written by the test itself (`TestPdfs.plainPdf14`): a valid PDF 1.4 with no
  XMP metadata, no output intent, no file identifier and a non-embedded Helvetica.
