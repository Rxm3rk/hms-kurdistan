package hms.buildlogic

import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.FileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.IgnoreEmptyDirectories
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.SkipWhenEmpty
import org.gradle.process.CommandLineArgumentProvider
import java.io.File

/**
 * The detekt-cli command line, with its inputs and outputs declared so that the detekt task is
 * incremental and cacheable (BUILD-PROMPT §6.8, §19.1).
 */
abstract class DetektArguments : CommandLineArgumentProvider {
    /** The Kotlin and Java sources detekt analyses; an empty set skips the task. */
    @get:InputFiles
    @get:SkipWhenEmpty
    @get:IgnoreEmptyDirectories
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sources: ConfigurableFileCollection

    /** The source directories passed to detekt's --input option (tracked through [sources]). */
    @get:Internal
    abstract val sourceDirectories: ConfigurableFileCollection

    /** backend/config/detekt/detekt.yml, applied on top of detekt's default configuration. */
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val config: RegularFileProperty

    /** Where the HTML and XML reports are written. */
    @get:OutputDirectory
    abstract val reportsDirectory: DirectoryProperty

    /** The project directory, so report paths are relative. */
    @get:Internal
    abstract val basePath: DirectoryProperty

    override fun asArguments(): Iterable<String> {
        val reports = reportsDirectory.get().asFile
        return listOf(
            "--input",
            existing(sourceDirectories).joinToString(",") { it.absolutePath },
            "--config",
            config.get().asFile.absolutePath,
            "--build-upon-default-config",
            "--parallel",
            "--base-path",
            basePath.get().asFile.absolutePath,
            "--report",
            "html:" + File(reports, "detekt.html").absolutePath,
            "--report",
            "xml:" + File(reports, "detekt.xml").absolutePath,
        )
    }

    private fun existing(directories: FileCollection): List<File> = directories.files.filter { it.isDirectory }.sorted()
}
