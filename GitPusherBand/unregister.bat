@echo off
setlocal
cd /d "%~dp0"

set "REGASM=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
if not exist "%REGASM%" (
  echo RegAsm not found at "%REGASM%".
  pause
  exit /b 1
)

"%REGASM%" GitPusherBand.dll /unregister
if errorlevel 1 (
  echo Unregister failed.
  pause
  exit /b %errorlevel%
)

echo Unregistered GitPusherBand.dll successfully.
echo Restart Explorer to clear the toolbar entry.
pause
