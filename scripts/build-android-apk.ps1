$ErrorActionPreference = "Stop"

function Get-JavaMajorVersion {
  param([string]$JavaHome)

  $releaseFile = Join-Path $JavaHome "release"
  if (Test-Path $releaseFile) {
    $releaseText = Get-Content -Raw $releaseFile
    if ($releaseText -match 'JAVA_VERSION="(?<first>\d+)(?:\.(?<second>\d+))?') {
      if ($Matches.first -eq "1" -and $Matches.second) {
        return [int]$Matches.second
      }

      return [int]$Matches.first
    }
  }

  $javaExe = Join-Path $JavaHome "bin\java.exe"
  $versionText = & $javaExe -version 2>&1 | Out-String
  if ($versionText -match 'version "(?<first>\d+)(?:\.(?<second>\d+))?') {
    if ($Matches.first -eq "1" -and $Matches.second) {
      return [int]$Matches.second
    }

    return [int]$Matches.first
  }

  return 0
}

function Add-JavaCandidate {
  param(
    [string[]]$Candidates,
    [string]$Path
  )

  if ($Path -and -not ($Candidates -contains $Path)) {
    return $Candidates + $Path
  }

  return $Candidates
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot "android"
$candidates = @()

$candidates = Add-JavaCandidate $candidates $env:JAVA_HOME
$candidates = Add-JavaCandidate $candidates "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$candidates = Add-JavaCandidate $candidates "C:\Program Files\Android\Android Studio\jbr"

Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -Filter "jdk-*" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  ForEach-Object { $candidates = Add-JavaCandidate $candidates $_.FullName }

Get-ChildItem "C:\Program Files\Java" -Directory -Filter "jdk-*" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  ForEach-Object { $candidates = Add-JavaCandidate $candidates $_.FullName }

$selectedJavaHome = $null
foreach ($candidate in $candidates) {
  $javaExe = Join-Path $candidate "bin\java.exe"
  if ((Test-Path $javaExe) -and (Get-JavaMajorVersion $candidate) -ge 11) {
    $selectedJavaHome = $candidate
    break
  }
}

if (-not $selectedJavaHome) {
  throw "Android APK build requires a JDK 11 or newer. Install JDK 21 or set JAVA_HOME to a compatible JDK."
}

$env:JAVA_HOME = $selectedJavaHome
$env:Path = "$(Join-Path $selectedJavaHome 'bin');$env:Path"

Push-Location $androidDir
try {
  & .\gradlew.bat --init-script mirror-repositories.gradle assembleRelease
} finally {
  Pop-Location
}
