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
  echo GitPusherBand.dll not found. Attempting to build...
  set "MSBUILD="

  for %%F in (
    "%ProgramFiles%\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Professional\MSBuild\Current\Bin\MSBuild.exe"
    "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Enterprise\MSBuild\Current\Bin\MSBuild.exe"
  ) do (
    if not defined MSBUILD if exist "%%~F" set "MSBUILD=%%~F"
  )

  if not defined MSBUILD (
    for /f "delims=" %%F in ('where msbuild 2^>nul') do (
      if not defined MSBUILD set "MSBUILD=%%F"
    )
  )

  if not defined MSBUILD (
    echo MSBuild.exe not found. Install Visual Studio Build Tools with .NET Framework 4.8 targeting pack.
    pause
    exit /b 1
  )

  "%MSBUILD%" "%~dp0GitPusherBand.csproj" /restore /t:Build /p:Configuration=Release /p:Platform=x64 /p:TargetFramework=net48 /nologo /verbosity:minimal
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b %errorlevel%
  )

  set "DLL=%~dp0bin\x64\Release\net48\GitPusherBand.dll"
  if not exist "%DLL%" set "DLL=%~dp0bin\x64\Debug\net48\GitPusherBand.dll"
  if not exist "%DLL%" set "DLL=%~dp0bin\Release\net48\GitPusherBand.dll"
  if not exist "%DLL%" set "DLL=%~dp0bin\Debug\net48\GitPusherBand.dll"
  if not exist "%DLL%" set "DLL=%~dp0GitPusherBand.dll"

  if not exist "%DLL%" (
    echo Build completed, but GitPusherBand.dll was still not found.
    pause
    exit /b 1
  )
)

"%REGASM%" "%DLL%" /codebase
if errorlevel 1 (
  echo Registration failed.
  pause
  exit /b %errorlevel%
)

echo Registered "%DLL%" successfully.
echo Restart Explorer, then enable via: Taskbar ^> Toolbars ^> GitPusherBand
pause
