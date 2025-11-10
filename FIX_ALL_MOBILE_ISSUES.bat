@echo off
REM FIX_ALL_MOBILE_ISSUES.bat
REM Comprehensive fix for mobile app errors

echo ================================
echo MOBILE APP COMPREHENSIVE FIX
echo ================================
echo.
echo This will fix:
echo  1. Empty component files (Element type invalid error)
echo  2. Date format issue (400 error on daily_availability)
echo  3. Clear Next.js cache
echo.
pause

REM Check if we're in the correct directory
if not exist "app\mobile" (
    echo [ERROR] app\mobile directory not found!
    echo Please run this from: C:\Users\Daniel\field-service-dashboard
    pause
    exit /b 1
)

echo [OK] Project directory confirmed
echo.

REM Create directories if they don't exist
echo Creating directories...
if not exist "app\mobile\components" mkdir "app\mobile\components"
if not exist "app\mobile\utils" mkdir "app\mobile\utils"
echo [OK] Directories ready
echo.

REM Fix 1: Install component files
echo ================================
echo FIX 1: Installing Components
echo ================================
echo.

copy /Y "outputs\mobile\components\TeamMembersSection.js" "app\mobile\components\TeamMembersSection.js" >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] TeamMembersSection.js) else (echo   [FAIL] TeamMembersSection.js)

copy /Y "outputs\mobile\components\CostSummarySection.js" "app\mobile\components\CostSummarySection.js" >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] CostSummarySection.js) else (echo   [FAIL] CostSummarySection.js)

copy /Y "outputs\mobile\components\EmailPhotosSection.js" "app\mobile\components\EmailPhotosSection.js" >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] EmailPhotosSection.js) else (echo   [FAIL] EmailPhotosSection.js)

copy /Y "outputs\mobile\components\WorkOrderDetail.js" "app\mobile\components\WorkOrderDetail.js" >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] WorkOrderDetail.js) else (echo   [FAIL] WorkOrderDetail.js)

echo.

REM Fix 2: Install fixed availability helper
echo ================================
echo FIX 2: Fixing Date Format Issue
echo ================================
echo.

copy /Y "outputs\mobile\utils\availabilityHelpers_FIXED.js" "app\mobile\utils\availabilityHelpers.js" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] availabilityHelpers.js updated
    echo   [INFO] Fixed date format for Supabase queries
) else (
    echo   [FAIL] Could not update availabilityHelpers.js
)

echo.

REM Fix 3: Clear cache
echo ================================
echo FIX 3: Clearing Cache
echo ================================
echo.

if exist ".next" (
    rmdir /S /Q ".next"
    echo [OK] Next.js cache cleared
) else (
    echo [INFO] No cache found (already clean)
)

echo.
echo ================================
echo FIXES COMPLETE!
echo ================================
echo.
echo What was fixed:
echo   1. Installed 4 working components (replaces empty files)
echo   2. Fixed date format bug in availability checking
echo   3. Cleared Next.js cache
echo.
echo ================================
echo NEXT STEPS - IMPORTANT!
echo ================================
echo.
echo 1. Stop your dev server
echo    Press Ctrl+C in the terminal
echo.
echo 2. Restart dev server
echo    npm run dev
echo.
echo 3. Hard refresh browser
echo    Press Ctrl+Shift+R
echo.
echo 4. Test the mobile app
echo    http://localhost:3000/mobile
echo.
echo Expected results:
echo   [OK] No "Element type invalid" error
echo   [OK] No 400 errors in console
echo   [OK] Work order details load properly
echo   [OK] Team Members section visible
echo   [OK] Cost Summary visible
echo.

pause
