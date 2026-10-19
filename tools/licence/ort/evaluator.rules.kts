/*
 * ORT evaluator rules for HMS Kurdistan (BUILD-PROMPT.md §4.3, ADR-022).
 *
 * Categories come from tools/licence/ort/license-classifications.yml, which mirrors
 * tools/licence/policy.yaml. Severity:
 *   - a denied licence is an ERROR, also for excluded (build-only) packages: build and CI tools
 *     are checked for use restrictions (§4.3);
 *   - a licence that no category covers (unmapped) is an ERROR;
 *   - a conditional licence or component is a WARNING that needs a licence-register entry
 *     (tools/licence/register.yaml), until the ORT step exists (WP-0.9). This is a decision of
 *     this build (review finding R-18): ORT has never run, these rules cannot yet read the
 *     register, so as ERRORs they would fail every conditional package, registered or not, and no
 *     gate reads their result today. The check that fails on an unregistered conditional component
 *     is 'tools/hms licence check', which reads the register. WP-0.9 makes CONDITIONAL_LICENSE and
 *     CONDITIONAL_COMPONENT ERRORs for any package the register does not record, and changes the
 *     README section "Conditional licences" and its unit test in the same change;
 *   - GPL/AGPL in a shipped package is an ERROR: they ship only as unmodified separate
 *     containers with a source offer, which the release pipeline checks (WP-0.9);
 *   - GPL-2.0 with the Classpath exception outside the OpenJDK runtime is an ERROR;
 *   - a package excluded by name (§4.1, §4.3) is an ERROR.
 *
 * NOT RUN YET. ORT runs in the merge tier from its official container image once a container
 * engine exists (WP-0.2 / WP-0.9). Pin the ORT image version when it first runs and fix any DSL
 * difference against that version; until then this file is unvalidated (tools/licence/README.md).
 */

val allowedLicenses = licenseClassifications.licensesByCategory["allowed"].orEmpty()
val conditionalLicenses = licenseClassifications.licensesByCategory["conditional"].orEmpty()
val openJdkOnlyLicenses = licenseClassifications.licensesByCategory["openjdk-runtime-only"].orEmpty()
val separateContainerLicenses = licenseClassifications.licensesByCategory["copyleft-separate-container"].orEmpty()
val deniedLicenses = licenseClassifications.licensesByCategory["denied"].orEmpty()
val buildOnlyLicenses = licenseClassifications.licensesByCategory["build-only-acceptable"].orEmpty()

val handledLicenses = (
    allowedLicenses + conditionalLicenses + openJdkOnlyLicenses + separateContainerLicenses +
        deniedLicenses + buildOnlyLicenses
    ).toSet()

/** Packages excluded by name (§4.1, §4.3), as regular expressions over ORT coordinates
 *  ("Type:namespace:name:version"), with an optional minimum version. */
data class NamedExclusion(val id: String, val coordinates: Regex, val minVersion: String?, val reason: String)

val namedExclusions = listOf(
    NamedExclusion("camunda-8.6-plus", Regex("^(Maven:io\\.camunda|NPM:@camunda):"), "8.6", "Camunda 8.6 and later"),
    NamedExclusion("redpanda", Regex("(?i)redpanda"), null, "Redpanda"),
    NamedExclusion("mirth-connect-4.6-plus", Regex("(?i)mirth"), "4.6", "Mirth Connect 4.6 and later"),
    NamedExclusion(
        "cloud-only-fhir",
        Regex("(?i)(google-cloud-healthcare|azure[-_.]health|healthdataservices|healthlake|healthapis)"),
        null,
        "a cloud-only FHIR service"
    ),
    NamedExclusion("medplum", Regex("(?i)^(NPM:@medplum|Maven:com\\.medplum):"), null, "Medplum components"),
    NamedExclusion("hashicorp-vault", Regex("^Go:github\\.com/hashicorp:vault:"), null, "HashiCorp Vault (BSL)"),
    NamedExclusion("minio", Regex("(?i)^(Go:github\\.com/minio:minio|Maven:io\\.minio|NPM::minio):"), null, "MinIO"),
    NamedExclusion("bitnami", Regex("(?i)bitnami"), null, "Bitnami images and charts")
)

/** Components that are conditional whatever their licence says (dcm4che's LGPL-2.1 option). */
val conditionalComponents = listOf(
    Regex("^Maven:org\\.dcm4che(\\.[^:]+)?:") to "the LGPL-2.1 option of dcm4che/dcm4chee, unmodified"
)

fun versionAtLeast(version: String, minimum: String): Boolean {
    val have = Regex("\\d+").findAll(version).map { it.value.toInt() }.toList()
    val need = Regex("\\d+").findAll(minimum).map { it.value.toInt() }.toList()
    for (i in 0 until maxOf(have.size, need.size)) {
        val a = have.getOrElse(i) { 0 }
        val b = need.getOrElse(i) { 0 }
        if (a != b) return a > b
    }
    return true
}

fun howToFix(rule: String) = """
    See tools/licence/README.md and BUILD-PROMPT.md §4.3. A dependency outside the allowlist is a
    stop-and-ask item (§3.4 item 2): record it in docs/program/DECISIONS-NEEDED.md. Do not edit
    the classifications to make this rule ($rule) pass.
""".trimIndent()

fun PackageRule.LicenseRule.isHandled() = object : RuleMatcher {
    override val description = "isHandled($license)"
    override fun matches() = license in handledLicenses
}

fun PackageRule.LicenseRule.isIn(category: Set<*>, name: String) = object : RuleMatcher {
    override val description = "isIn($name, $license)"
    override fun matches() = license in category
}

fun PackageRule.isNamedExclusion(exclusion: NamedExclusion) = object : RuleMatcher {
    override val description = "isNamedExclusion(${exclusion.id})"
    override fun matches(): Boolean {
        val id = pkg.metadata.id
        if (!exclusion.coordinates.containsMatchIn(id.toCoordinates())) return false
        return exclusion.minVersion?.let { versionAtLeast(id.version, it) } ?: true
    }
}

fun PackageRule.isConditionalComponent(pattern: Regex) = object : RuleMatcher {
    override val description = "isConditionalComponent($pattern)"
    override fun matches() = pattern.containsMatchIn(pkg.metadata.id.toCoordinates())
}

fun RuleSet.deniedLicenseRule() = packageRule("DENIED_LICENSE") {
    // No -isExcluded() here: use restrictions matter for build-only tools too.
    licenseRule("DENIED_LICENSE", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require { +isIn(deniedLicenses, "denied") }
        error(
            "Package ${pkg.metadata.id.toCoordinates()} uses the denied licence $license " +
                "(${licenseSource.name.lowercase()}).",
            howToFix("DENIED_LICENSE")
        )
    }
}

fun RuleSet.unmappedLicenseRule() = packageRule("UNMAPPED_LICENSE") {
    licenseRule("UNMAPPED_LICENSE", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require { -isHandled() }
        error(
            "The licence $license of ${pkg.metadata.id.toCoordinates()} is not classified " +
                "(${licenseSource.name.lowercase()}).",
            howToFix("UNMAPPED_LICENSE")
        )
    }
}

fun RuleSet.buildOnlyLicenseRule() = packageRule("BUILD_ONLY_NOT_ACCEPTABLE") {
    require { +isExcluded() }
    licenseRule("BUILD_ONLY_NOT_ACCEPTABLE", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require {
            +isHandled()
            -isIn(deniedLicenses, "denied")
            -isIn(allowedLicenses + conditionalLicenses + buildOnlyLicenses, "build-only")
        }
        error(
            "Build-only package ${pkg.metadata.id.toCoordinates()} has licence $license, which is not " +
                "classified as acceptable for build-only use.",
            howToFix("BUILD_ONLY_NOT_ACCEPTABLE")
        )
    }
}

// WARNING until the ORT step exists (WP-0.9), then an ERROR unless the register records the package (header).
fun RuleSet.conditionalLicenseRule() = packageRule("CONDITIONAL_LICENSE") {
    require { -isExcluded() }
    licenseRule("CONDITIONAL_LICENSE", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require { +isIn(conditionalLicenses, "conditional") }
        warning(
            "Package ${pkg.metadata.id.toCoordinates()} uses the conditional licence $license: allowed only " +
                "unmodified and recorded in tools/licence/register.yaml.",
            howToFix("CONDITIONAL_LICENSE")
        )
    }
}

// WARNING until the ORT step exists (WP-0.9), then an ERROR unless the register records the package (header).
fun RuleSet.conditionalComponentRule() = packageRule("CONDITIONAL_COMPONENT") {
    require { -isExcluded() }
    conditionalComponents.forEach { (pattern, condition) ->
        if (isConditionalComponent(pattern).matches()) {
            warning(
                "Package ${pkg.metadata.id.toCoordinates()} is conditional: $condition; it needs an entry in " +
                    "tools/licence/register.yaml.",
                howToFix("CONDITIONAL_COMPONENT")
            )
        }
    }
}

fun RuleSet.copyleftInShippedRule() = packageRule("COPYLEFT_IN_SHIPPED") {
    require { -isExcluded() }
    licenseRule("COPYLEFT_IN_SHIPPED", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require { +isIn(separateContainerLicenses, "copyleft-separate-container") }
        error(
            "Shipped package ${pkg.metadata.id.toCoordinates()} has the copyleft licence $license. GPL and AGPL " +
                "ship only as unmodified separate containers with a source offer (§4.3).",
            howToFix("COPYLEFT_IN_SHIPPED")
        )
    }
}

fun RuleSet.openJdkOnlyRule() = packageRule("CLASSPATH_EXCEPTION_OUTSIDE_OPENJDK") {
    require { -isExcluded() }
    licenseRule("CLASSPATH_EXCEPTION_OUTSIDE_OPENJDK", LicenseView.CONCLUDED_OR_DECLARED_AND_DETECTED) {
        require { +isIn(openJdkOnlyLicenses, "openjdk-runtime-only") }
        error(
            "Package ${pkg.metadata.id.toCoordinates()} has $license, which §4.3 allows only for the OpenJDK runtime.",
            howToFix("CLASSPATH_EXCEPTION_OUTSIDE_OPENJDK")
        )
    }
}

fun RuleSet.namedExclusionRules() = namedExclusions.forEach { exclusion ->
    packageRule("EXCLUDED_BY_NAME_${exclusion.id.uppercase().replace('-', '_').replace('.', '_')}") {
        require { +isNamedExclusion(exclusion) }
        error(
            "Package ${pkg.metadata.id.toCoordinates()} is excluded by name: ${exclusion.reason} (§4.1, §4.3).",
            howToFix("EXCLUDED_BY_NAME")
        )
    }
}

val ruleSet = ruleSet(ortResult, licenseInfoResolver, resolutionProvider) {
    deniedLicenseRule()
    unmappedLicenseRule()
    buildOnlyLicenseRule()
    conditionalLicenseRule()
    conditionalComponentRule()
    copyleftInShippedRule()
    openJdkOnlyRule()
    namedExclusionRules()
}

ruleViolations += ruleSet.violations
