# Creates the n8n Gmail (SMTP) credential from the values in .env, so no one has to
# type a password into the n8n UI or into chat.
#   1. Turn on 2-Step Verification for the Gmail account, then create an App password:
#      https://myaccount.google.com/apppasswords
#   2. Put GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env
#   3. powershell -ExecutionPolicy Bypass -File scripts\setup-credentials.ps1
# The temporary file holding the password is deleted straight after import.

. "$PSScriptRoot\env.ps1"
if (-not $env:GMAIL_ADDRESS -or -not $env:GMAIL_APP_PASSWORD -or $env:GMAIL_APP_PASSWORD -like "your_*") {
    Write-Error "Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env first."; exit 1
}
$tmp = Join-Path $DataDir "cache\smtp_credential.tmp.json"
$cred = @(@{
    id = "GroundlineSmtp01"; name = "Groundline Gmail (SMTP)"; type = "smtp"
    data = @{ user = $env:GMAIL_ADDRESS; password = ($env:GMAIL_APP_PASSWORD -replace '\s', ''); host = "smtp.gmail.com"; port = 465; secure = $true }
})
try {
    ConvertTo-Json $cred -Depth 5 | Out-File -Encoding utf8 $tmp
    n8n import:credentials --input="$tmp"
} finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
Write-Host "Credential 'Groundline Gmail (SMTP)' ready for $($env:GMAIL_ADDRESS)."
