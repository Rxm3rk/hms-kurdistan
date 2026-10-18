package hms.buildlogic;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Starts detekt-cli in its own JVM for the fast tier (BUILD-PROMPT §6.8, §19.1).
 *
 * <p>detekt 1.23.8 embeds the Kotlin 2.0.21 compiler. Its IntelliJ {@code JavaVersion} parser rejects
 * four-part Java versions such as Temurin 25.0.4.1 and stops with {@code IllegalArgumentException:
 * 25.0.4.1}. The JVM fixes {@code java.version} at start-up (a {@code -D} flag cannot change it), so this
 * launcher shortens the value to its first three parts inside the forked detekt JVM, before detekt reads
 * it, and then calls detekt's own entry point. Nothing else runs in that JVM; the Gradle daemon and the
 * Kotlin compiler are not affected.
 *
 * <p>Remove this class, and run detekt directly, once the toolchain JDK has a three-part version or detekt
 * moves to a Kotlin compiler that parses four-part versions (the detekt 2.x line).
 */
public final class DetektLauncher {
    private static final String DETEKT_MAIN = "io.gitlab.arturbosch.detekt.cli.Main";

    private DetektLauncher() {
    }

    public static void main(String[] args) throws Throwable {
        String version = System.getProperty("java.version");
        String[] parts = version.split("\\.");
        if (parts.length > 3) {
            System.setProperty("java.version", parts[0] + "." + parts[1] + "." + parts[2]);
        }
        Method main = Class.forName(DETEKT_MAIN).getMethod("main", String[].class);
        try {
            main.invoke(null, (Object) args);
        } catch (InvocationTargetException failure) {
            throw failure.getCause();
        }
    }
}
