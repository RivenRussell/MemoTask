param(
    [switch]$Release
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android"
$initScript = Join-Path $androidDir "gradle-mirrors.init.gradle"
$task = if ($Release) { "assembleRelease" } else { "assembleDebug" }

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (Test-Path $sdk) {
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    $env:PATH = "$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;$env:PATH"
}

function Ensure-ReleaseKeystore {
    $keystoreProperties = Join-Path $androidDir "keystore.properties"
    $keystoreFile = Join-Path $androidDir "memotask-release-local.jks"

    if ((Test-Path $keystoreFile) -and -not (Test-Path $keystoreProperties)) {
        @"
storeFile=memotask-release-local.jks
storePassword=MemoTaskLocalRelease2026
keyAlias=memotask-release
keyPassword=MemoTaskLocalRelease2026
"@ | Set-Content -LiteralPath $keystoreProperties -Encoding ascii
    }

    if ((Test-Path $keystoreProperties) -and (Test-Path $keystoreFile)) {
        return
    }

    $storePassword = "MemoTaskLocalRelease2026"
    $keyAlias = "memotask-release"
    $keyPassword = "MemoTaskLocalRelease2026"

    $keytool = Get-Command keytool -ErrorAction Stop
    & $keytool.Source `
        -genkeypair `
        -v `
        -keystore $keystoreFile `
        -storepass $storePassword `
        -alias $keyAlias `
        -keypass $keyPassword `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname "CN=MemoTask, OU=Local Release, O=RRWKS, L=Local, S=Local, C=CN"

    @"
storeFile=memotask-release-local.jks
storePassword=$storePassword
keyAlias=$keyAlias
keyPassword=$keyPassword
"@ | Set-Content -LiteralPath $keystoreProperties -Encoding ascii
}

if ($Release) {
    Ensure-ReleaseKeystore
}

Push-Location $androidDir
try {
    $cachedGradle = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.14.3-all" -Recurse -Filter gradle.bat -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($cachedGradle) {
        & $cachedGradle.FullName --offline --no-daemon --init-script $initScript $task
        exit $LASTEXITCODE
    }

    & .\gradlew.bat --no-daemon --init-script $initScript $task
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
