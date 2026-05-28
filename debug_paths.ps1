$root = (Get-Location).Path
Write-Host "Root: $root"

$pack1 = Join-Path $root "CraftMyFunnel-postgres-pack"
Write-Host "Pack1: $pack1"
Write-Host "Test-Path Pack1: $(Test-Path $pack1)"

$pack2 = Join-Path $root "CraftMyFunnel-full-pack"
Write-Host "Pack2: $pack2"
Write-Host "Test-Path Pack2: $(Test-Path $pack2)"

$merged = Join-Path $root "CraftMyFunnel-merged-final"
Write-Host "Merged: $merged"

if (Test-Path $merged) {
    Write-Host "Merged folder exists, deleting..."
    Remove-Item -Recurse -Force $merged
}
New-Item -ItemType Directory -Path $merged | Out-Null
Write-Host "Created Merged folder"

$report = Join-Path $merged "merge-report.txt"
Write-Host "Report: $report"
"Start Report" | Out-File -FilePath $report -Encoding utf8
Write-Host "Wrote to report"
