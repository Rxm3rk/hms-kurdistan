package hms.archfixtures.locale.violating.domain;

/** Violating fixture for no-system-default-zone-or-locale: String.toUpperCase() uses the default locale. */
public final class JavaUpperCasesWithoutLocale {
    /** Upper-cases a code with the JVM default locale (the Turkish dotless i problem). */
    public String code(String raw) {
        return raw.toUpperCase();
    }
}
