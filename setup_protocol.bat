@echo off
echo ==========================================
echo YouTube Bypass - Установка протокола
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

echo Проверка наличия loader.bat...
if not exist "C:\Users\User\Downloads\loader.bat" (
  echo Ошибка: loader.bat не найден!
  echo Убедитесь, что файл находится по пути C:\Users\User\Downloads\loader.bat
  pause
  exit /b 1
)

echo Применение регистрационных настроек...
regedit /s ytbypass_improved.reg

echo Добавление доверенных приложений...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\ProtocolExecute\ytbypass" /v "WarnOnOpen" /t REG_DWORD /d 0 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\ProtocolExecute\ytbypass" /v "EditFlags" /t REG_DWORD /d 2 /f

echo Удаление старых ассоциаций...
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\ytbypass" /f >nul 2>&1

echo Тестирование протокола...
echo Сейчас будет произведено тестирование протокола.
echo Возможно, Windows запросит разрешение на первый запуск.
echo После первого запуска система запомнит ваш выбор.
echo.
pause

start ytbypass://launch

echo.
echo Настройка завершена!
echo.
echo Если Windows запросила разрешение, обязательно выберите:
echo "Всегда использовать это приложение для открытия ytbypass:// ссылок"
echo и нажмите OK.
echo.
pause 