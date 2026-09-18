@echo off
echo ===================================================
echo   Starting Arena3 Spring Boot Backend on Localhost
echo ===================================================

set "JAVA_HOME=C:\Users\ADMIN\.jdks\corretto-17.0.12"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "%~dp0backend"
echo Java Version:
"%JAVA_HOME%\bin\java.exe" -version

echo.
echo Running Spring Boot Application on port 8088...
call mvnw.cmd spring-boot:run
pause
