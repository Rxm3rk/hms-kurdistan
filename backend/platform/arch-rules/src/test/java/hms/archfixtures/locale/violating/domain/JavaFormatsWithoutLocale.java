package hms.archfixtures.locale.violating.domain;

/** Violating fixture for no-system-default-zone-or-locale: String.format and String.formatted without a Locale. */
public final class JavaFormatsWithoutLocale {
    /** Formats with the JVM default locale. */
    public String format(int count) {
        return String.format("%d doses", count);
    }

    /** Formats with the JVM default locale, Java 15 style. */
    public String formatted(int count) {
        return "%d doses".formatted(count);
    }
}
