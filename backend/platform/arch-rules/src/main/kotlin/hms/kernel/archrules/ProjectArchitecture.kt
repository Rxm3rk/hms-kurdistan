package hms.kernel.archrules

import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.core.importer.ClassFileImporter
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

/**
 * Runs the HMS rules against the production classes of the project under test.
 *
 * The hms.test-conventions plugin passes the project's main class directories to every test JVM in
 * the system property [CLASSES_DIRS_PROPERTY]. Every backend project with production code has an
 * `ArchitectureTest` that calls [importProductionClasses] and checks [HmsArchitectureRules.all]; the
 * fast tier fails when that test did not run (§6.8 #3, §19.1).
 */
object ProjectArchitecture {
    /** Set by hms.test-conventions; must match HmsBuild.ARCH_CLASSES_DIRS_PROPERTY in build-logic. */
    const val CLASSES_DIRS_PROPERTY: String = "hms.arch.classesDirs"

    /** Imports this project's production classes; fails when none can be found, so a check is never vacuous. */
    fun importProductionClasses(): JavaClasses {
        val raw =
            checkNotNull(System.getProperty(CLASSES_DIRS_PROPERTY)) {
                "$CLASSES_DIRS_PROPERTY is not set: run the architecture tests through Gradle (hms.test-conventions sets it)"
            }
        val directories =
            raw
                .split(File.pathSeparatorChar)
                .filter { it.isNotBlank() }
                .map { Path.of(it) }
                .filter { Files.isDirectory(it) }
        val classes = ClassFileImporter().importPaths(directories)
        check(classes.isNotEmpty()) { "no production classes found in '$raw'" }
        return classes
    }
}
