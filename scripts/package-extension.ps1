$ErrorActionPreference = "Stop"

$SourceDir = "$PSScriptRoot\..\apps\api\src\extension"
$DistDir = "$PSScriptRoot\..\dist\chrome-extension"
$ZipPath = "$PSScriptRoot\..\dist\CraftMyFunnel-extension.zip"

Write-Host "Cleaning dist directory..."
if (Test-Path $DistDir) {
    Remove-Item -Recurse -Force $DistDir
}
if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

Write-Host "Copying extension files..."
$Files = @(
    "manifest.json",
    "popup.html",
    "background.js",
    "content.js",
    "popup.js"
)

foreach ($File in $Files) {
    $FilePath = Join-Path $SourceDir $File
    if (Test-Path $FilePath) {
        Copy-Item -Path $FilePath -Destination $DistDir
    } else {
        Write-Warning "File not found: $File"
    }
}

Write-Host "Creating extension archive..."
Compress-Archive -Path "$DistDir\*" -DestinationPath $ZipPath -Force

Write-Host "Extension packaged successfully at $ZipPath"
