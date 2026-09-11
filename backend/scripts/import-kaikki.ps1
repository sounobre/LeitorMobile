param(
    [string]$InputFile = "D:\LeitorMobile\data\kaikki\kaikki.org-dictionary-English.jsonl",
    [switch]$Download,
    [long]$MaxRecords = 0
)

$ErrorActionPreference = "Stop"
$downloadUrl = "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl"
$parent = Split-Path -Parent $InputFile
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
if ($Download -and -not (Test-Path -LiteralPath $InputFile)) {
    Write-Host "Baixando o snapshot Kaikki (aproximadamente 3 GB)..."
    $temporaryFile = "$InputFile.download"
    if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }
    Invoke-WebRequest -Uri $downloadUrl -OutFile $temporaryFile
    Move-Item -LiteralPath $temporaryFile -Destination $InputFile -Force
}
if (-not (Test-Path -LiteralPath $InputFile)) { throw "Arquivo não encontrado: $InputFile. Use -Download ou informe -InputFile." }

Push-Location (Join-Path $PSScriptRoot "..")
try {
    mvn -q spring-boot:run `
        "-Dspring-boot.run.arguments=--app.dictionary.import-on-startup=true --app.dictionary.import-file=$InputFile --app.dictionary.max-records=$MaxRecords"
} finally {
    Pop-Location
}
