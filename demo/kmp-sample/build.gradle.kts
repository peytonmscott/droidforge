plugins {
    kotlin("multiplatform") version "2.1.0"
    id("com.android.application") version "8.7.0"
}

kotlin {
    androidTarget()
    iosX64()
    iosArm64()
    iosSimulatorArm64()
    wasmJs { browser() }
    jvm()
}

android {
    namespace = "com.example.kmpsample"
    defaultConfig {
        applicationId = "com.example.kmpsample"
    }
}
