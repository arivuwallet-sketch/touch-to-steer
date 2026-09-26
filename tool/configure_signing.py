import pathlib, sys
path = pathlib.Path(sys.argv[1])
source = path.read_text()
marker = '// NativeForge release signing'
if marker not in source:
    source += """
// NativeForge release signing
android {
    signingConfigs {
        maybeCreate("release").apply {
            val keyPath = System.getenv("CM_KEYSTORE_PATH")
            if (!keyPath.isNullOrBlank()) {
                storeFile = file(keyPath)
                storePassword = System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CM_KEY_ALIAS")
                keyPassword = System.getenv("CM_KEY_PASSWORD")
            }
        }
    }
    buildTypes.getByName("release") {
        signingConfig = signingConfigs.getByName("release")
    }
}
"""
    path.write_text(source)
