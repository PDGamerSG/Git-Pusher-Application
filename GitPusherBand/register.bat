@echo off
setlocal
cd /d "%~dp0"

set "REGASM=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
if not exist "%REGASM%" (
  echo RegAsm not found at "%REGASM%".
  pause
  exit /b 1
)

"%REGASM%" GitPusherBand.dll /codebase
if errorlevel 1 (
  echo Registration failed.
  pause
  exit /b %errorlevel%
)

echo Registered GitPusherBand.dll successfully.
echo Restart Explorer, then enable via: Taskbar ^> Toolbars ^> GitPusherBand
pause
