@echo off
REM Skatryk Trainer - Android APK Quick Setup Script (Windows)
REM This script sets up your environment for APK generation

setlocal enabledelayedexpansion

echo.
echo 🚀 Skatryk Trainer - Android APK Setup
echo ========================================
echo.

REM Check prerequisites
echo 📋 Checking prerequisites...

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo ✅ Node.js %%i

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found. Please install Node.js
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo ✅ npm %%i

REM Check Java
where java >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Java not found. Capacitor requires JDK 11+
    echo    Install from: https://www.oracle.com/java/technologies/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr /R "version"') do echo ✅ Java %%i

REM Check Android SDK
if "%ANDROID_HOME%"=="" (
    echo ⚠️  ANDROID_HOME not set
    echo    Set it in System Properties ^> Environment Variables
    echo    Or run: set ANDROID_HOME=C:\Android\Sdk
    pause
    exit /b 1
)
echo ✅ ANDROID_HOME=%ANDROID_HOME%

echo.
echo 📦 Installing npm dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo 🔨 Building web assets...
call npm run build
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo 🤖 Setting up Capacitor Android...
if exist android (
    echo    Android platform already exists, skipping setup...
) else (
    call npm run cap:add:android
    if %ERRORLEVEL% NEQ 0 goto error
)

echo.
echo 📱 Syncing with Android platform...
call npm run cap:build:android
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo    1. Open Android Studio:
echo       npm run cap:open:android
echo.
echo    2. Build Debug APK:
echo       - Click Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo       - APK will be at: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo    3. Build Release APK:
echo       - Click Build ^> Generate Signed Bundle / APK
echo       - Select APK, create keystore, build
echo       - APK will be at: android\app\build\outputs\apk\release\app-release.apk
echo.
echo 📚 Documentation:
echo    - PWA ^& APK Guide: see PWA_AND_APK_GENERATION.md
echo    - Audit Report: see ANDROID_BUILD_AUDIT.md
echo    - App Links Setup: see ANDROID_APP_LINKS_SETUP.md
echo.
pause
exit /b 0

:error
echo.
echo ❌ Setup failed!
echo    See error messages above for details
pause
exit /b 1
