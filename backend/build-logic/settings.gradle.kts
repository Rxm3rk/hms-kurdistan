// Included build holding the HMS convention plugins (BUILD-PROMPT §6.1).

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    // Official registries only (§3.7).
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    versionCatalogs {
        // The one version catalogue of the backend (§4.1), shared with the main build.
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "build-logic"
