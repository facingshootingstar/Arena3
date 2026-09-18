Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Arena3 Spring Boot Backend on Localhost" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$env:JAVA_HOME = "C:\Users\ADMIN\.jdks\corretto-17.0.12"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "$PSScriptRoot\backend"
Write-Host "Java Version:" -ForegroundColor Green
& "$env:JAVA_HOME\bin\java.exe" -version

Write-Host "`nRunning Spring Boot Application on port 8088..." -ForegroundColor Yellow
.\mvnw.cmd spring-boot:run
