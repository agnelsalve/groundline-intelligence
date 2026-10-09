# Shared setup for every Groundline script: loads .env into this process only and
# sets the folders n8n may read/write. Dot-source it:  . "$PSScriptRoot\env.ps1"

$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root "data"
$OutDir = Join-Path $Root "outputs"

$EnvFile = Join-Path $Root ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"'), 'Process')
    }
    Write-Host "Loaded .env"
} else {
    Write-Host "No .env found - copy .env.example to .env. Without an AI key the pipeline still runs on keyword rules."
}

# Folders the workflow writes to (n8n creates files, not folders)
foreach ($d in @("clean", "raw", "cache", "runs", "runs\errors", "scale")) { New-Item -ItemType Directory -Force (Join-Path $DataDir $d) | Out-Null }
foreach ($d in @("briefs", "alerts", "data", "charts", "emails")) { New-Item -ItemType Directory -Force (Join-Path $OutDir $d) | Out-Null }

$env:GROUNDLINE_DATA_DIR = $DataDir
$env:GROUNDLINE_OUTPUT_DIR = $OutDir
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DataDir;$OutDir"   # n8n may only touch these two folders
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = "false"             # lets Code nodes read the .env values above
$env:N8N_RUNNERS_TASK_TIMEOUT = "1800"                  # AI nodes can run for minutes on a cold cache
# Scale-test finding: n8n runs only 10 Code-node tasks at once by default and drops tasks that wait >60 s
# in the queue (HTTP 500 at 50 concurrent AI requests). Raised so bursts queue instead of failing.
$env:N8N_RUNNERS_MAX_CONCURRENCY = "50"
$env:N8N_RUNNERS_TASK_REQUEST_TIMEOUT = "300"
$env:N8N_DIAGNOSTICS_ENABLED = "false"
