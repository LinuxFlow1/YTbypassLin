@echo off
echo ========================================
echo = Установка расширения с водяным знаком =
echo ========================================
echo.

set EXTENSION_DIR=%~dp0new_extension
echo Расположение расширения: %EXTENSION_DIR%
echo.

echo Проверка наличия браузеров...

set CHROME_FOUND=0
set EDGE_FOUND=0
set BRAVE_FOUND=0

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set CHROME_FOUND=1
    set CHROME_PATH="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    echo [+] Google Chrome найден
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set CHROME_FOUND=1
    set CHROME_PATH="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    echo [+] Google Chrome найден
) else (
    echo [-] Google Chrome не найден
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set EDGE_FOUND=1
    set EDGE_PATH="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    echo [+] Microsoft Edge найден
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set EDGE_FOUND=1
    set EDGE_PATH="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
    echo [+] Microsoft Edge найден
) else (
    echo [-] Microsoft Edge не найден
)

if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set BRAVE_FOUND=1
    set BRAVE_PATH="%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
    echo [+] Brave найден
) else if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set BRAVE_FOUND=1
    set BRAVE_PATH="%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
    echo [+] Brave найден
) else (
    echo [-] Brave не найден
)

echo.
echo Выберите браузер для установки расширения:
echo.

if %CHROME_FOUND%==1 echo 1. Google Chrome
if %EDGE_FOUND%==1 echo 2. Microsoft Edge
if %BRAVE_FOUND%==1 echo 3. Brave Browser
echo 4. Выйти

echo.
set /p BROWSER_CHOICE=Введите номер (1-4): 

if "%BROWSER_CHOICE%"=="1" (
    if %CHROME_FOUND%==1 (
        echo Запуск Google Chrome с расширением...
        start "" %CHROME_PATH% --load-extension="%EXTENSION_DIR%" --no-first-run --no-default-browser-check "https://youtube.com"
    ) else (
        echo Google Chrome не установлен на этом компьютере.
    )
) else if "%BROWSER_CHOICE%"=="2" (
    if %EDGE_FOUND%==1 (
        echo Запуск Microsoft Edge с расширением...
        start "" %EDGE_PATH% --load-extension="%EXTENSION_DIR%" --no-first-run --no-default-browser-check "https://youtube.com"
    ) else (
        echo Microsoft Edge не установлен на этом компьютере.
    )
) else if "%BROWSER_CHOICE%"=="3" (
    if %BRAVE_FOUND%==1 (
        echo Запуск Brave с расширением...
        start "" %BRAVE_PATH% --load-extension="%EXTENSION_DIR%" --no-first-run --no-default-browser-check "https://youtube.com"
    ) else (
        echo Brave не установлен на этом компьютере.
    )
) else if "%BROWSER_CHOICE%"=="4" (
    echo Выход из программы установки.
    goto end
) else (
    echo Неверный выбор. Пожалуйста, запустите скрипт снова.
)

echo.
echo Инструкция по использованию:
echo 1. После открытия YouTube вы увидите водяной знак в правом верхнем углу страницы
echo 2. Нажмите на него для открытия меню настроек
echo 3. Вы можете перетащить водяной знак в любое место на странице
echo 4. Настройте прозрачность, размер и цвет по вашему желанию
echo.
echo Для постоянной установки расширения:
echo 1. Откройте меню браузера -^> Дополнительные инструменты -^> Расширения
echo 2. Включите "Режим разработчика" (переключатель в правом верхнем углу)
echo 3. Нажмите "Загрузить распакованное расширение"
echo 4. Выберите папку new_extension
echo.
pause

:end 