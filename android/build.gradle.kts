buildscript {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }

    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.20")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val sharedBuildDir = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(sharedBuildDir)

subprojects {
    project.layout.buildDirectory.value(sharedBuildDir.dir(project.name))
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
