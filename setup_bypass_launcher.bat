@echo off
echo ==========================================
echo YouTube Bypass - Установка Silent Launcher
echo ==========================================
echo.

rem Запрашиваем права администратора
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo Этот скрипт требует прав администратора!
  echo Пожалуйста, запустите его от имени администратора.
  pause
  exit
)

echo Применение регистрационных настроек...
regedit /s register_vbs.reg

echo Проверка наличия всех необходимых файлов...
if not exist silent_launcher.vbs (
  echo Ошибка: silent_launcher.vbs не найден
  pause
  exit /b 1
)

if not exist direct_launcher.bat (
  echo Ошибка: direct_launcher.bat не найден
  pause
  exit /b 1
)

if not exist loader.bat (
  echo Ошибка: loader.bat не найден
  pause
  exit /b 1
)

echo Установка атрибутов для скриптов...
attrib +h silent_launcher.vbs
attrib +h direct_launcher.bat

echo Тестирование запуска...
echo Сейчас будет произведен тестовый запуск обхода.
echo Если все настроено правильно, вы увидите уведомление об успешном запуске.
echo.
pause

wscript.exe silent_launcher.vbs

echo.
echo Установка завершена!
echo Теперь водяной знак должен работать без запросов разрешения.
echo.
pause 