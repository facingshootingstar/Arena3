@echo off
echo ===================================================
echo   Running Arena3 TestNG Automated Test Suite
echo ===================================================

set "JAVA_HOME=C:\Users\ADMIN\.jdks\corretto-17.0.12"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "%~dp0backend"
call mvnw.cmd test
pause
