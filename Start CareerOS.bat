@echo off
rem Starts CareerOS and opens it in the browser. Used by the desktop shortcut.
title CareerOS
cd /d "%~dp0"
set URL=http://127.0.0.1:3001

rem Already running? Then just open it.
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 3001)).Close(); exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" %URL%
  exit /b
)

rem Open the browser as soon as the app answers (gives up after about 2 minutes).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 120; $i++) { try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 5 | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep 1 } }"

echo.
echo   CareerOS is starting and will open in your browser shortly.
echo   Keep this window open while you use CareerOS. Close it to stop CareerOS.
echo.
npm run dev -- -p 3001
