$ErrorActionPreference = 'Stop'
$backendPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodePath = (Get-Command node.exe).Source
$logPath = Join-Path $backendPath '..\maintenance\worker.log'
$workerPath = Join-Path $PSScriptRoot 'personal-server.mjs'
$taskName = 'vidpilot-ai-worker'
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask -and -not $existingTask.Description.Contains($backendPath)) { throw 'An unrelated task already uses this name; refusing to overwrite it.' }
$command = "Set-Location -LiteralPath '$backendPath'; & '$nodePath' '$workerPath' >> '$logPath' 2>&1"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -EncodedCommand $encoded" -WorkingDirectory $backendPath
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "vidpilot ai local dashboard and automatic QC-gated video worker: $backendPath" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output 'Personal worker registered for sign-in and started in the background. Dashboard: http://localhost:4000'
