@echo off
setlocal
cd /d "%~dp0"

set "REGASM=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
if not exist "%REGASM%" (
  echo RegAsm not found at "%REGASM%".
  pause
  exit /b 1
)

set "DLL=%~dp0bin\x64\Release\net48\GitPusherBand.dll"
if not exist "%DLL%" set "DLL=%~dp0bin\x64\Debug\net48\GitPusherBand.dll"
if not exist "%DLL%" set "DLL=%~dp0bin\Release\net48\GitPusherBand.dll"
if not exist "%DLL%" set "DLL=%~dp0bin\Debug\net48\GitPusherBand.dll"
if not exist "%DLL%" set "DLL=%~dp0GitPusherBand.dll"

if not exist "%DLL%" (
  echo GitPusherBand.dll not found.
  echo Build GitPusherBand.sln first, then run this script again.
  pause
  exit /b 1
)

"%REGASM%" "%DLL%" /unregister
if errorlevel 1 (
  echo Unregister failed.
  pause
  exit /b %errorlevel%
)

echo Unregistered "%DLL%" successfully.
echo Restart Explorer to clear the toolbar entry.
pause
