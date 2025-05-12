@echo off
rem Direct Launcher для YouTube Bypass без диалоговых окон
echo [%date% %time%] Direct launcher invoked

rem Проверяем, запущен ли уже обход
if exist "%TEMP%\yt_bypass_running.lock" (
  echo Bypass already running, exit
  exit
)

rem Запускаем loader.bat напрямую
start "" /B "C:\Users\User\Downloads\loader.bat"

rem Даём знать расширению, что запуск произошёл успешно
exit 