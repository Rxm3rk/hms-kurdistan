package hms.archfixtures.locale.violating.domain;

/** Violating fixture for no-system-default-zone-or-locale: String.toLowerCase() uses the default locale. */
public final class JavaLowerCasesWithoutLocale {
    /** Lower-cases a code with the JVM default locale. */
    public String code(String raw) {
        return raw.toLowerCase();
    }
}
