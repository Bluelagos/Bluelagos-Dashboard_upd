param(
    [string]$Deck = (Join-Path $PSScriptRoot "Blue_Lagos_Deputy_Governor_Presentation.pptx")
)

$ErrorActionPreference = "Stop"
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
$pdf = [System.IO.Path]::ChangeExtension($deckPath, ".pdf")
$renders = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "renders"))
if (-not (Test-Path -LiteralPath $renders)) {
    New-Item -ItemType Directory -Path $renders | Out-Null
}

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1
try {
    $presentation = $powerPoint.Presentations.Open($deckPath, $true, $false, $false)
    try {
        $presentation.Export($renders, "PNG", 1920, 1080)
    }
    finally {
        $presentation.Close()
    }
}
finally {
    $powerPoint.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint) | Out-Null
}

python (Join-Path $PSScriptRoot "render_preview.py")
if ($LASTEXITCODE -ne 0) {
    throw "Preview PDF generation failed"
}

Write-Output "PDF preview: $pdf"
Write-Output "Slide renders: $renders"
