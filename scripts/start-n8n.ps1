# Starts n8n configured for this project and loads the three workflows. Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\start-n8n.ps1
# Then open http://localhost:5678

. "$PSScriptRoot\env.ps1"

foreach ($wf in @("error_handler.json", "analyze_api.json", "workflow_v2.json")) {
    n8n import:workflow --input="$(Join-Path $Root "workflow\$wf")" | Out-Null
}
# The error handler must be published for n8n to call it; the API so its webhook listens.
n8n publish:workflow --id=GroundlineErrHnd | Out-Null
n8n publish:workflow --id=GroundlineApiV2x | Out-Null

Write-Host "Data:    $DataDir"
Write-Host "Outputs: $OutDir"
Write-Host "Starting n8n -> http://localhost:5678   (Analyze API: POST http://localhost:5678/webhook/groundline/analyze)"
n8n start
