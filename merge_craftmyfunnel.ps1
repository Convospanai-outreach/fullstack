Write-Host "=== FIXED CraftMyFunnel Merge System ===" -ForegroundColor Cyan

$root = (Get-Location).Path
$main = $root
$pack1 = Join-Path $root "CraftMyFunnel-postgres-pack"
$pack2 = Join-Path $root "CraftMyFunnel-full-pack"
$merged = Join-Path $root "CraftMyFunnel-merged-final"

# Verify folders exist
foreach ($dir in @($pack1, $pack2)) {
    if (!(Test-Path -LiteralPath $dir)) {
        Write-Host "ERROR: Missing folder $dir" -ForegroundColor Red
        exit
    }
}

# Clean previous output
if (Test-Path -LiteralPath $merged) {
    Write-Host "Removing existing merged folder..."
    cmd /c "rmdir /s /q `"$merged`""
    Start-Sleep -Milliseconds 500
}
[System.IO.Directory]::CreateDirectory($merged) | Out-Null

# Report
$report = Join-Path $merged "merge-report.txt"
[System.IO.File]::WriteAllText($report, "CraftMyFunnel Merge Report`r`n=======================`r`nMAIN:      $main`r`nPOSTGRES:  $pack1`r`nFULLPACK:  $pack2`r`n`r`n")

function Safe-RelPath {
    param (
        [string]$filePath,
        [string]$baseFolder
    )

    $filePath = $filePath.Replace('/', '\')
    $baseFolder = $baseFolder.Replace('/', '\')

    if ($filePath.StartsWith($baseFolder)) {
        $rel = $filePath.Substring($baseFolder.Length)
        $rel = $rel.TrimStart('\')
        return $rel
    }

    # fallback
    return [System.IO.Path]::GetFileName($filePath)
}

function Copy-With-Report {
    param(
        [string]$Source,
        [string]$Dest,
        [string]$ReportPath
    )

    if (!(Test-Path -LiteralPath $Source)) { return }

    $destDir = [System.IO.Path]::GetDirectoryName($Dest)
    if (!(Test-Path -LiteralPath $destDir)) {
        [System.IO.Directory]::CreateDirectory($destDir) | Out-Null
    }

    if (Test-Path -LiteralPath $Dest) {
        $srcHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
        $dstHash = (Get-FileHash -LiteralPath $Dest -Algorithm SHA256).Hash

        if ($srcHash -eq $dstHash) {
            [System.IO.File]::AppendAllText($ReportPath, "UNCHANGED: $Dest`r`n")
            return
        }

        [System.IO.File]::AppendAllText($ReportPath, "CHANGED: $Dest`r`n")
        # code --diff $Dest $Source  <-- Disabled for headless execution
    }
    else {
        [System.IO.File]::AppendAllText($ReportPath, "NEW FILE: $Dest`r`n")
    }

    Copy-Item -LiteralPath $Source -Destination $Dest -Force
}

# Merge order: main → postgres → full
$mergeFolders = @($main, $pack1, $pack2)

foreach ($srcRoot in $mergeFolders) {

    [System.IO.File]::AppendAllText($report, "`r`n>>> MERGING FROM: $srcRoot`r`n`r`n")

    $files = Get-ChildItem -LiteralPath $srcRoot -Recurse -File

    foreach ($file in $files) {

        # Skip the merged folder itself to avoid infinite recursion if running from root
        if ($file.FullName.StartsWith($merged)) { continue }
        # Also skip the pack folders when merging 'main' (root) to avoid duplicating them inside
        if ($srcRoot -eq $main) {
            if ($file.FullName.StartsWith($pack1) -or $file.FullName.StartsWith($pack2) -or $file.FullName.StartsWith($merged)) { continue }
        }

        $relPath = Safe-RelPath $file.FullName $srcRoot
        if (!$relPath) { continue }

        # Normalize slashes
        $relPath = $relPath.Replace('/', '\')

        $destPath = Join-Path $merged $relPath

        Copy-With-Report -Source $file.FullName -Dest $destPath -ReportPath $report
    }
}

Write-Host "`n=== MERGE COMPLETED ===" -ForegroundColor Green
Write-Host "Output folder: $merged"
Write-Host "Report file: $report"
