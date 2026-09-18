Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Running Arena3 TestNG Automated Test Suite" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$env:JAVA_HOME = "C:\Users\ADMIN\.jdks\corretto-17.0.12"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "$PSScriptRoot\backend"
.\mvnw.cmd test
