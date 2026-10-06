# Runs the full pipeline headlessly (no browser): imports the workflows and executes the main one.
#   powershell -ExecutionPolicy Bypass -File scripts\run-pipeline.ps1
# Stop any running "n8n start" first - both use the same local database.

. "$PSScriptRoot\env.ps1"

foreach ($wf in @("error_handler.json", "analyze_api.json", "workflow_v2.json")) {
    n8n import:workflow --input="$(Join-Path $Root "workflow\$wf")" | Out-Null
}
$started = Get-Date
n8n execute --id=GroundlineV2Main | Out-Null
$secs = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
Write-Host "`nDone in $secs s. Briefs + dashboard in $OutDir ; run summary: $OutDir\run_summary.md"
if (Test-Path "$OutDir\run_summary.md") { Get-Content "$OutDir\run_summary.md" | Select-Object -First 12 }
