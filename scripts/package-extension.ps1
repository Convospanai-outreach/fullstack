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
    "popup.css",
    "utils.js",
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

Write-Host "Copying extension icons..."
Copy-Item -Path (Join-Path $SourceDir "icons") -Destination $DistDir -Recurse

Write-Host "Creating extension archive..."
# Not Compress-Archive: on Windows PowerShell 5.1 it stores entry names with backslashes
# (icons\icon-16.png), which Chrome does not treat as folders, so the icons go missing.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$DistRoot = (Resolve-Path $DistDir).Path.TrimEnd("\") + "\"
$Zip = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $DistDir -Recurse -File | ForEach-Object {
        $EntryName = $_.FullName.Substring($DistRoot.Length).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($Zip, $_.FullName, $EntryName) | Out-Null
    }
} finally {
    $Zip.Dispose()
}

Write-Host "Extension packaged successfully at $ZipPath"
