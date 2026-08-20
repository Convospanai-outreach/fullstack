param(
    [string]$Path = ".",
    [string]$OutputFile = "project_tree.txt"
)

$exclude = @("node_modules", ".next", ".git", "dist", "build", "coverage")

function Show-Tree {
    param(
        [string]$CurrentPath,
        [string]$Indent = "",
        [bool]$IsLast = $true
    )

    $name = Split-Path $CurrentPath -Leaf
    
    # Print current item
    $marker = ""
    if ($IsLast) { $marker = "\-- " } else { $marker = "+-- " }
    
    $line = "$Indent$marker$name"
    $line | Out-File -FilePath $OutputFile -Append -Encoding utf8

    # Prepare indent for children
    $childIndent = $Indent
    if ($IsLast) { $childIndent += "    " } else { $childIndent += "|   " }

    # Get children
    try {
        $items = Get-ChildItem -LiteralPath $CurrentPath -Force -ErrorAction SilentlyContinue | 
        Where-Object { $exclude -notcontains $_.Name }
    }
    catch {
        return
    }

    $count = $items.Count
    $i = 0

    foreach ($item in $items) {
        $i++
        $isLastChild = ($i -eq $count)
        
        if ($item.PSIsContainer) {
            Show-Tree -CurrentPath $item.FullName -Indent $childIndent -IsLast $isLastChild
        }
        else {
            $marker = ""
            if ($isLastChild) { $marker = "\-- " } else { $marker = "+-- " }
            "$childIndent$marker$($item.Name)" | Out-File -FilePath $OutputFile -Append -Encoding utf8
        }
    }
}

# Initialize output file
$fullOutPath = Join-Path (Get-Location) $OutputFile
"Project Tree for: $(Convert-Path $Path)" | Out-File -FilePath $fullOutPath -Encoding utf8
"Generated on: $(Get-Date)" | Out-File -FilePath $fullOutPath -Append -Encoding utf8
"=========================================" | Out-File -FilePath $fullOutPath -Append -Encoding utf8

# Start recursion
$rootItems = Get-ChildItem -LiteralPath $Path -Force | Where-Object { $exclude -notcontains $_.Name }
$count = $rootItems.Count
$i = 0

foreach ($item in $rootItems) {
    $i++
    $isLast = ($i -eq $count)
    if ($item.PSIsContainer) {
        Show-Tree -CurrentPath $item.FullName -IsLast $isLast
    }
    else {
        $marker = ""
        if ($isLast) { $marker = "\-- " } else { $marker = "+-- " }
        "$marker$($item.Name)" | Out-File -FilePath $fullOutPath -Append -Encoding utf8
    }
}

Write-Host "Tree generated at: $fullOutPath" -ForegroundColor Green
