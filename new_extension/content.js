// Скрипт для внедрения интерактивного водяного знака
(function() {
    'use strict';

    // Данные о состоянии обхода
    const bypassState = {
        isRunning: false,
        startTime: null,
        buffering: 0,
        lastCheck: Date.now(),
        quality: 'Неизвестно',
        version: '1.0',
        downloadSpeed: 0,
        uploadSpeed: 0,
        lastSpeedTest: null,
        ping: 0,
        networkStatus: 'Проверка...',
        bufferingStartTime: null,
        lastBufferingFix: null,
        bufferingHistory: [],
        consecutiveBuffering: 0
    };

    // Функция проверки состояния обхода
    function checkBypassStatus() {
        // Проверка наличия процесса youtube-bypass через background.js
        chrome.runtime.sendMessage({action: 'checkBypassStatus'}, function(response) {
            if (response && response.isRunning) {
                bypassState.isRunning = true;
                if (!bypassState.startTime) {
                    bypassState.startTime = Date.now();
                }
            } else {
                bypassState.isRunning = false;
            }
            
            // Обновляем состояние водяного знака
            updateWatermarkStatus();
        });
        
        // Проверка сетевой активности
        checkNetworkSpeed();
    }
    
    // Функция для проверки скорости сети
    function checkNetworkSpeed() {
        // Если последняя проверка была менее 10 секунд назад, пропускаем
        if (bypassState.lastSpeedTest && (Date.now() - bypassState.lastSpeedTest < 10000)) {
            return;
        }
        
        bypassState.lastSpeedTest = Date.now();
        
        try {
            // Получаем информацию о производительности сети
            const perfEntry = performance.getEntriesByType('navigation')[0];
            if (perfEntry) {
                // Расчет скорости загрузки страницы
                const pageSize = perfEntry.transferSize / 1024; // в КБ
                const loadTime = perfEntry.responseEnd - perfEntry.requestStart;
                
                if (loadTime > 0) {
                    // Приблизительная скорость загрузки в Кбит/с
                    bypassState.downloadSpeed = Math.round((pageSize * 8) / (loadTime / 1000));
                }
            }
            
            // Проверяем текущее активное видео для получения данных о буферизации
            const videoElement = document.querySelector('video');
            if (videoElement) {
                // Статус буферизации
                if (videoElement.readyState < 3) {
                    bypassState.networkStatus = 'Буферизация...';
                    
                    // Автоматически проверяем частые случаи буферизации
                    handlePotentialBuffering();
                } else if (videoElement.readyState >= 3 && videoElement.readyState < 4) {
                    bypassState.networkStatus = 'Частичная буферизация';
                } else {
                    bypassState.networkStatus = 'Стабильно';
                }
                
                // Проверка пинга и адаптивного качества
                const videoQuality = getVideoQuality();
                if (videoQuality) {
                    bypassState.quality = videoQuality;
                }
                
                // Проверка задержки загрузки 
                if (videoElement.buffered.length > 0) {
                    const bufferEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
                    const bufferAhead = bufferEnd - videoElement.currentTime;
                    
                    // Если буфер впереди меньше 5 секунд, возможны проблемы
                    if (bufferAhead < 5) {
                        bypassState.networkStatus = 'Низкая скорость буферизации';
                        
                        // Отслеживаем непрерывные проблемы с буферизацией
                        if (!bypassState.bufferingStartTime) {
                            bypassState.bufferingStartTime = Date.now();
                        } else if (Date.now() - bypassState.bufferingStartTime > 10000) {
                            // Если буферизация продолжается более 10 секунд
                            handlePersistentBuffering();
                            bypassState.bufferingStartTime = null; // Сбрасываем таймер после обработки
                        }
                    } else if (bufferAhead > 30) {
                        bypassState.networkStatus = 'Отличная скорость';
                        bypassState.bufferingStartTime = null; // Сбрасываем таймер, если буферизация в норме
                    }
                }
            } else {
                bypassState.networkStatus = 'Нет активного видео';
            }
            
            // Измерение пинга
            measurePing();
            
            // Обновляем отображение
            updateWatermarkStatus();
        } catch (e) {
            console.error('Ошибка проверки скорости сети:', e);
        }
    }
    
    // Функция для измерения пинга
    function measurePing() {
        const start = Date.now();
        
        // Выполняем запрос к API YouTube, чтобы проверить пинг
        fetch('https://www.youtube.com/youtubei/v1/ping?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
            method: 'POST',
            credentials: 'omit',
            cache: 'no-cache'
        }).then(response => {
            const pingTime = Date.now() - start;
            bypassState.ping = pingTime;
            
            // Обновляем информацию о состоянии сети на основе пинга
            if (pingTime < 100) {
                bypassState.networkStatus = 'Отличное соединение';
            } else if (pingTime < 200) {
                bypassState.networkStatus = 'Хорошее соединение';
            } else if (pingTime < 300) {
                bypassState.networkStatus = 'Среднее соединение';
            } else {
                bypassState.networkStatus = 'Высокая задержка';
            }
            
            updateWatermarkStatus();
        }).catch(error => {
            console.error('Ошибка проверки пинга:', error);
            bypassState.networkStatus = 'Ошибка соединения';
            updateWatermarkStatus();
        });
    }
    
    // Функция для получения текущего качества видео
    function getVideoQuality() {
        try {
            // Пытаемся получить информацию из элементов управления YouTube
            const qualityButton = document.querySelector('.ytp-settings-button');
            if (qualityButton) {
                // Получаем доступные данные о качестве с помощью атрибутов
                const qualityInfo = qualityButton.getAttribute('aria-label');
                if (qualityInfo && qualityInfo.includes('качество')) {
                    return qualityInfo.split('качество: ')[1] || 'Неизвестно';
                }
            }
            
            // Альтернативный способ - попытаться получить информацию из плеера
            const video = document.querySelector('video');
            if (video) {
                const height = video.videoHeight;
                if (height >= 2160) return '4K (2160p)';
                if (height >= 1440) return 'QHD (1440p)';
                if (height >= 1080) return 'FHD (1080p)';
                if (height >= 720) return 'HD (720p)';
                if (height >= 480) return 'SD (480p)';
                if (height >= 360) return 'Низкое (360p)';
                if (height >= 240) return 'Очень низкое (240p)';
                if (height > 0) return `${height}p`;
            }
        } catch (e) {
            console.error('Ошибка получения качества видео:', e);
        }
        
        return bypassState.quality;
    }

    // Функция для обнаружения буферизации
    function detectBuffering() {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('waiting', function() {
                bypassState.buffering++;
                updateWatermarkStatus();
                
                // Отправляем информацию о буферизации в background.js
                chrome.runtime.sendMessage({
                    action: 'bufferingDetected',
                    count: bypassState.buffering
                });
                
                // Добавляем уведомление о буферизации в интерфейсе
                if (bypassState.buffering > 3) {
                    showNotification('Оптимизируем воспроизведение...', 'info');
                }
            });
            
            // Отслеживаем восстановление воспроизведения
            videoElement.addEventListener('playing', function() {
                if (bypassState.buffering > 0) {
                    // Если были проблемы, но видео восстановилось
                    showNotification('Воспроизведение оптимизировано', 'success');
                }
            });
            
            // Определяем качество видео
            try {
                const qualityLabel = document.querySelector('.ytp-settings-button')?.getAttribute('aria-label');
                if (qualityLabel) {
                    bypassState.quality = qualityLabel;
                }
            } catch (e) {
                console.log('Не удалось определить качество видео');
            }
        }
    }

    // Получаем настройки водяного знака из хранилища
    chrome.storage.local.get(['watermark_settings'], function(result) {
        const settings = result.watermark_settings || {
            enabled: true,
            text: 'YT Bypass',
            opacity: 0.7,
            size: '120px',
            color: '#3F51B5',
            position: { top: '20px', right: '20px' },
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            interactive: true
        };

        // Проверяем, включен ли водяной знак
        if (settings.enabled) {
            // Создаем и добавляем водяной знак
            const watermark = createWatermark(settings);
            
            // Запускаем регулярную проверку состояния обхода
            checkBypassStatus();
            setInterval(checkBypassStatus, 30000); // Проверяем каждые 30 секунд
            
            // Запускаем более частое обновление информации о скорости сети
            setInterval(checkNetworkSpeed, 5000); // Проверяем каждые 5 секунд
            
            // Запускаем отслеживание буферизации
            detectBuffering();
        }
    });

    // Функция обновления статуса водяного знака
    function updateWatermarkStatus() {
        const watermark = document.getElementById('custom-interactive-watermark');
        if (!watermark) return;
        
        // Обновляем текст водяного знака, чтобы отображать скорость
        if (bypassState.downloadSpeed > 0) {
            watermark.textContent = `${watermark.getAttribute('data-text') || 'YT Bypass'} - ${bypassState.downloadSpeed} Кб/с`;
        }
        
        // Обновляем цвет в зависимости от состояния
        if (bypassState.isRunning) {
            // Цвет в зависимости от скорости и пинга
            if (bypassState.downloadSpeed > 1000 && bypassState.ping < 150) {
                watermark.style.backgroundColor = '#4CAF50'; // Зеленый для высокой скорости
            } else if (bypassState.downloadSpeed > 500) {
                watermark.style.backgroundColor = '#8BC34A'; // Светло-зеленый для средней скорости
            } else if (bypassState.downloadSpeed > 200) {
                watermark.style.backgroundColor = '#FFC107'; // Желтый для низкой скорости
            } else {
                watermark.style.backgroundColor = '#FF9800'; // Оранжевый для очень низкой скорости
            }
        } else {
            watermark.style.backgroundColor = '#F44336'; // Красный, если обход не запущен
        }
        
        // Если открыто меню с информацией, обновляем его содержимое
        const infoPanel = document.getElementById('bypass-info-panel');
        if (infoPanel) {
            const statusElement = document.getElementById('bypass-status');
            const bufferingElement = document.getElementById('buffering-count');
            const upTimeElement = document.getElementById('uptime-value');
            const speedElement = document.getElementById('speed-value');
            const pingElement = document.getElementById('ping-value');
            const networkStatusElement = document.getElementById('network-status');
            
            if (statusElement) {
                statusElement.textContent = bypassState.isRunning ? 'Работает' : 'Остановлен';
                statusElement.style.color = bypassState.isRunning ? '#4CAF50' : '#F44336';
            }
            
            if (bufferingElement) {
                bufferingElement.textContent = bypassState.buffering;
            }
            
            if (upTimeElement && bypassState.startTime) {
                const uptime = Math.floor((Date.now() - bypassState.startTime) / 1000 / 60);
                upTimeElement.textContent = `${uptime} мин.`;
            }
            
            if (speedElement) {
                speedElement.textContent = `${bypassState.downloadSpeed} Кб/с`;
            }
            
            if (pingElement) {
                pingElement.textContent = `${bypassState.ping} мс`;
            }
            
            if (networkStatusElement) {
                networkStatusElement.textContent = bypassState.networkStatus;
            }
        }
    }

    // Слушаем сообщения от фонового скрипта
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateWatermark') {
            // Удаляем существующий водяной знак
            const existingWatermark = document.getElementById('custom-interactive-watermark');
            if (existingWatermark) {
                existingWatermark.remove();
            }
            
            // Создаем новый водяной знак с обновленными настройками
            if (request.settings.enabled) {
                createWatermark(request.settings);
            }
            
            sendResponse({success: true});
        }
        
        if (request.action === 'bypassStatusChanged') {
            bypassState.isRunning = request.isRunning;
            updateWatermarkStatus();
            sendResponse({success: true});
        }
        
        return true; // Важно для асинхронного ответа
    });

    // Функция создания водяного знака
    function createWatermark(settings) {
        // Проверяем, существует ли уже водяной знак
        if (document.getElementById('custom-interactive-watermark')) {
            return;
        }
        
        // Создаем элемент водяного знака
        const watermark = document.createElement('div');
        watermark.id = 'custom-interactive-watermark';
        watermark.className = 'yt-watermark'; // Добавляем класс для совместимости
        
        // Сохраняем оригинальный текст как атрибут
        watermark.setAttribute('data-text', settings.text || 'YT Bypass');
        
        // Применяем базовые стили
        const styles = {
            position: 'fixed',
            zIndex: '9999',
            opacity: settings.opacity || 0.7,
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            backgroundColor: settings.color || '#3F51B5',
            fontFamily: settings.fontFamily || 'Arial, sans-serif',
            fontSize: settings.fontSize || '16px',
            transition: 'all 0.3s ease',
            userSelect: 'none',
            cursor: settings.interactive ? 'move' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        };
        
        // Применяем размер
        if (settings.size) {
            if (settings.shape === 'circle') {
                styles.width = settings.size;
                styles.height = settings.size;
                styles.borderRadius = '50%';
                styles.padding = '0';
            } else {
                styles.padding = '10px 20px';
            }
        }
        
        // Применяем позицию
        if (settings.position) {
            if (settings.position.top) styles.top = settings.position.top;
            if (settings.position.right) styles.right = settings.position.right;
            if (settings.position.bottom) styles.bottom = settings.position.bottom;
            if (settings.position.left) styles.left = settings.position.left;
        } else {
            // Позиция по умолчанию - правый верхний угол
            styles.top = '20px';
            styles.right = '20px';
        }
        
        // Применяем все стили
        Object.assign(watermark.style, styles);
        
        // Создаем кнопку кастомизации
        const customizeButton = document.createElement('div');
        customizeButton.className = 'watermark-customize-btn';
        customizeButton.innerHTML = '⚙️'; // Иконка шестеренки
        Object.assign(customizeButton.style, {
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#2196F3',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });
        
        // Обработчик клика на кнопку кастомизации
        customizeButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Предотвращаем всплытие события
            
            // Открываем popup.html в новом окне
            chrome.runtime.sendMessage({
                action: 'openPopup'
            });
        });
        
        // Показываем кнопку кастомизации при наведении на водяной знак
        watermark.addEventListener('mouseover', function() {
            this.style.opacity = '1';
            this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
            customizeButton.style.opacity = '1';
        });
        
        watermark.addEventListener('mouseout', function() {
            // Возвращаем исходную прозрачность только если меню не открыто
            if (!document.getElementById('bypass-info-panel')) {
                this.style.opacity = settings.opacity;
                this.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
                customizeButton.style.opacity = '0';
            }
        });
        
        // Если включен интерактивный режим, делаем водяной знак перетаскиваемым
        if (settings.interactive) {
            makeDraggable(watermark);
            
            // Добавляем всплывающее меню при щелчке
            watermark.addEventListener('click', function(e) {
                // Предотвращаем открытие меню при перетаскивании
                if (watermark.isDragging) return;
                
                // Показываем панель информации о обходе и запускаем обход
                showBypassInfoPanel(watermark, settings, e);
                
                // Предотвращаем всплытие события
                e.stopPropagation();
            });
        }
        
        // Добавляем кнопку кастомизации к водяному знаку
        watermark.appendChild(customizeButton);
        
        // Добавляем водяной знак на страницу
        document.body.appendChild(watermark);
        
        // Устанавливаем начальный статус
        updateWatermarkStatus();
        
        // Добавляем информацию о состоянии обхода
        updateWatermarkContent(watermark, {
            isRunning: false,
            bufferingEvents: 0,
            uptime: '00:00:00',
            quality: 'auto',
            status: 'Проверка...'
        });
        
        // Добавляем контрольные кнопки
        const controlButtons = createControlButtons(watermark);
        
        // Возвращаем созданный элемент
        return watermark;
    }
    
    // Функция для перетаскивания водяного знака
    function makeDraggable(element) {
        let offsetX = 0, offsetY = 0;
        element.isDragging = false;
        
        element.addEventListener('mousedown', function(e) {
            element.isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            
            // Закрываем панели, если они открыты
            const panels = ['bypass-info-panel', 'watermark-context-menu', 'bypass-recommendations'];
            panels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) panel.remove();
            });
            
            // Изменяем стиль во время перетаскивания
            element.style.opacity = '0.7';
            
            // Предотвращаем выделение текста при перетаскивании
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!element.isDragging) return;
            
            // Вычисляем новые координаты
            const left = e.clientX - offsetX;
            const top = e.clientY - offsetY;
            
            // Обновляем позицию
            element.style.left = left + 'px';
            element.style.top = top + 'px';
            
            // Удаляем right/bottom, если они были установлены
            element.style.right = '';
            element.style.bottom = '';
        });
        
        document.addEventListener('mouseup', function() {
            if (!element.isDragging) return;
            
            element.isDragging = false;
            
            // Восстанавливаем прозрачность
            chrome.storage.local.get(['watermark_settings'], function(result) {
                const settings = result.watermark_settings || {};
                element.style.opacity = settings.opacity || 0.7;
            });
            
            // Сохраняем новую позицию
            savePosition(element);
        });
    }
    
    // Функция для сохранения позиции водяного знака
    function savePosition(element) {
        const rect = element.getBoundingClientRect();
        
        chrome.storage.local.get(['watermark_settings'], function(result) {
            const settings = result.watermark_settings || {};
            
            // Обновляем позицию в настройках
            settings.position = {
                top: rect.top + 'px',
                left: rect.left + 'px'
            };
            
            // Сохраняем обновленные настройки
            chrome.storage.local.set({watermark_settings: settings}, function() {
                console.log('Позиция водяного знака сохранена');
            });
        });
    }
    
    // Функция для отображения панели информации о обходе
    function showBypassInfoPanel(watermark, settings, event) {
        // Удаляем существующие панели, если они есть
        const panels = ['bypass-info-panel', 'watermark-context-menu', 'bypass-recommendations'];
        panels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.remove();
        });
        
        // Не запускаем обход автоматически при открытии панели
        // Это исправляет баг с немедленным запуском при нажатии на водяной знак
        
        // Получаем путь к файлу обхода
        chrome.runtime.sendMessage({action: 'getBypassPath'}, function(response) {
            const bypassPath = response && response.path ? response.path : 'youtube-linuxLina.bat';
            
            // Создаем панель
            const panel = document.createElement('div');
            panel.id = 'bypass-info-panel';
            
            // Стили для панели
            Object.assign(panel.style, {
                position: 'fixed',
                zIndex: '10000',
                backgroundColor: 'rgba(40, 44, 52, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                padding: '15px',
                boxShadow: '0 5px 20px rgba(0, 0, 0, 0.5)',
                color: 'white',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                width: '320px'
            });
            
            // Позиционируем панель рядом с водяным знаком
            const rect = watermark.getBoundingClientRect();
            panel.style.top = (rect.bottom + 10) + 'px';
            panel.style.left = rect.left + 'px';
            
            // Если панель выходит за пределы экрана, корректируем позицию
            const panelWidth = 320;
            if (rect.left + panelWidth > window.innerWidth) {
                panel.style.left = (window.innerWidth - panelWidth - 10) + 'px';
            }
            
            // Создаем заголовок
            const title = document.createElement('div');
            title.textContent = 'Состояние обхода YouTube';
            Object.assign(title.style, {
                fontWeight: 'bold',
                fontSize: '16px',
                padding: '0 0 10px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '15px'
            });
            panel.appendChild(title);
            
            // Содержимое панели - информация о состоянии
            const infoContent = document.createElement('div');
            
            // Статус обхода
            const statusRow = document.createElement('div');
            statusRow.style.marginBottom = '10px';
            statusRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Bypass Status:</span>
                    <span id="bypass-status" style="font-weight: bold; color: ${bypassState.isRunning ? '#4CAF50' : '#F44336'}">
                        ${bypassState.isRunning ? 'Running' : 'Stopped'}
                    </span>
                </div>
            `;
            infoContent.appendChild(statusRow);
            
            // Скорость интернета
            const speedRow = document.createElement('div');
            speedRow.style.marginBottom = '10px';
            speedRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Download Speed:</span>
                    <span id="speed-value" style="font-weight: bold;">${bypassState.downloadSpeed} Kb/s</span>
                </div>
            `;
            infoContent.appendChild(speedRow);
            
            // Пинг
            const pingRow = document.createElement('div');
            pingRow.style.marginBottom = '10px';
            pingRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Ping:</span>
                    <span id="ping-value" style="font-weight: bold;">${bypassState.ping} ms</span>
                </div>
            `;
            infoContent.appendChild(pingRow);
            
            // Состояние сети
            const networkStatusRow = document.createElement('div');
            networkStatusRow.style.marginBottom = '10px';
            networkStatusRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Network Status:</span>
                    <span id="network-status" style="font-weight: bold;">${bypassState.networkStatus}</span>
                </div>
            `;
            infoContent.appendChild(networkStatusRow);
            
            // Количество буферизаций
            const bufferingRow = document.createElement('div');
            bufferingRow.style.marginBottom = '10px';
            bufferingRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Buffering Events:</span>
                    <span id="buffering-count" style="font-weight: bold;">${bypassState.buffering}</span>
                </div>
            `;
            infoContent.appendChild(bufferingRow);
            
            // Время работы
            const uptimeRow = document.createElement('div');
            uptimeRow.style.marginBottom = '10px';
            uptimeRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Uptime:</span>
                    <span id="uptime-value" style="font-weight: bold;">
                        ${bypassState.startTime ? Math.floor((Date.now() - bypassState.startTime) / 1000 / 60) + ' min.' : 'N/A'}
                    </span>
                </div>
            `;
            infoContent.appendChild(uptimeRow);
            
            // Качество видео
            const qualityRow = document.createElement('div');
            qualityRow.style.marginBottom = '15px';
            qualityRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>Video Quality:</span>
                    <span style="font-weight: bold;">${bypassState.quality}</span>
                </div>
            `;
            infoContent.appendChild(qualityRow);
            
            // Добавляем кнопки
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.justifyContent = 'space-between';
            buttonsContainer.style.marginTop = '20px';
            
            // Кнопка оптимизации при буферизации
            const optimizeButton = document.createElement('button');
            optimizeButton.textContent = 'Fix Buffering';
            Object.assign(optimizeButton.style, {
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '48%'
            });
            
            optimizeButton.addEventListener('click', function() {
                // Показываем уведомление о начале оптимизации
                showNotification('Starting playback optimization...', 'info');
                
                // Запускаем через background.js
                chrome.runtime.sendMessage({
                    action: 'restartBypass'
                }, function(response) {
                    if (response && response.success) {
                        showNotification('Optimization started successfully!', 'success');
                    } else {
                        showNotification('Failed to start optimization. Check extension settings.', 'error');
                    }
                });
                
                panel.remove();
            });
            
            optimizeButton.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#45a049';
            });
            
            optimizeButton.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#4CAF50';
            });
            
            // Кнопка рекомендаций
            const recommendationsButton = document.createElement('button');
            recommendationsButton.textContent = 'Рекомендации';
            Object.assign(recommendationsButton.style, {
                backgroundColor: '#3F51B5',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '48%'
            });
            
            recommendationsButton.addEventListener('click', function() {
                showRecommendations();
                panel.remove();
            });
            
            recommendationsButton.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#303F9F';
            });
            
            recommendationsButton.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#3F51B5';
            });
            
            // Добавляем кнопки в панель
            buttonsContainer.appendChild(optimizeButton);
            buttonsContainer.appendChild(recommendationsButton);
            
            // Создаем кнопку запуска обхода
            const startBypassButton = document.createElement('button');
            startBypassButton.textContent = 'Запустить обход';
            Object.assign(startBypassButton.style, {
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                marginTop: '10px'
            });
            
            startBypassButton.addEventListener('click', function() {
                launchBypassFromWatermark();
                panel.remove();
            });
            
            // Кнопка настройки водяного знака (вместо Alternative Launch)
            const customizeButton = document.createElement('button');
            customizeButton.innerHTML = '⚙️ Настройка водяного знака';
            Object.assign(customizeButton.style, {
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
            });
            
            customizeButton.addEventListener('click', function() {
                // Отправляем сообщение для открытия popup.html в отдельном окне
                chrome.runtime.sendMessage({
                    action: 'openPopup'
                });
                panel.remove();
            });
            
            // Добавляем все кнопки в контейнер
            infoContent.appendChild(buttonsContainer);
            infoContent.appendChild(startBypassButton);
            infoContent.appendChild(customizeButton);
            panel.appendChild(infoContent);
            
            // Добавляем панель на страницу
            document.body.appendChild(panel);
            
            // Закрываем панель при клике вне её
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target !== watermark) {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        });
    }
    
    // Функция для отображения рекомендаций
    function showRecommendations() {
        // Создаем блок с рекомендациями
        const recommendationsOverlay = document.createElement('div');
        recommendationsOverlay.className = 'recommendations-overlay';
        recommendationsOverlay.style.position = 'fixed';
        recommendationsOverlay.style.top = '0';
        recommendationsOverlay.style.left = '0';
        recommendationsOverlay.style.width = '100%';
        recommendationsOverlay.style.height = '100%';
        recommendationsOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        recommendationsOverlay.style.zIndex = '10000';
        recommendationsOverlay.style.display = 'flex';
        recommendationsOverlay.style.justifyContent = 'center';
        recommendationsOverlay.style.alignItems = 'center';
        
        const recommendationsContent = document.createElement('div');
        recommendationsContent.className = 'recommendations-content';
        recommendationsContent.style.backgroundColor = 'white';
        recommendationsContent.style.padding = '20px';
        recommendationsContent.style.borderRadius = '5px';
        recommendationsContent.style.maxWidth = '600px';
        recommendationsContent.style.maxHeight = '80%';
        recommendationsContent.style.overflow = 'auto';
        
        // Заголовок
        const recommendationsTitle = document.createElement('h2');
        recommendationsTitle.textContent = 'Recommendations for YouTube Optimization';
        recommendationsTitle.style.marginTop = '0';
        
        // Содержимое рекомендаций
        const recommendationsList = document.createElement('ul');
        recommendationsList.style.textAlign = 'left';
        
        const recommendations = [
            'Set video quality to 720p for optimal quality-to-speed ratio',
            'Disable autoplay if frequent buffering occurs',
            'Use wired connection instead of Wi-Fi if possible',
            'Close unused tabs and programs to free up resources',
            'Clear browser cache if YouTube runs slowly',
            'Disable extensions that may slow down the browser',
            'Check your internet connection speed at speedtest.net',
            'Make sure the youtube-linuxLina.bat path is correctly specified in settings'
        ];
        
        recommendations.forEach(rec => {
            const item = document.createElement('li');
            item.textContent = rec;
            item.style.margin = '10px 0';
            recommendationsList.appendChild(item);
        });
        
        // Кнопка закрытия
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '20px';
        closeButton.style.padding = '8px 15px';
        closeButton.style.backgroundColor = '#f44336';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        
        closeButton.addEventListener('click', function() {
            document.body.removeChild(recommendationsOverlay);
        });
        
        // Добавляем все элементы на страницу
        recommendationsContent.appendChild(recommendationsTitle);
        recommendationsContent.appendChild(recommendationsList);
        recommendationsContent.appendChild(closeButton);
        recommendationsOverlay.appendChild(recommendationsContent);
        document.body.appendChild(recommendationsOverlay);
    }
    
    // Функция для отображения уведомлений
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        
        // Определяем цвет в зависимости от типа уведомления
        let bgColor = '#3F51B5'; // info (синий)
        if (type === 'success') bgColor = '#4CAF50'; // зеленый
        if (type === 'error') bgColor = '#F44336'; // красный
        if (type === 'warning') bgColor = '#FF9800'; // оранжевый
        
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            font-family: Arial, sans-serif;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Показываем уведомление
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Обработка потенциальных проблем с буферизацией
    function handlePotentialBuffering() {
        // Увеличиваем счетчик буферизации
        bypassState.buffering++;
        
        // Если буферизация происходит часто, отправляем сигнал на оптимизацию
        if (bypassState.buffering > 3) {
            // Отправляем информацию в background.js о необходимости оптимизации
            chrome.runtime.sendMessage({
                action: 'bufferingDetected',
                count: bypassState.buffering
            });
        }
    }

    // Обработка непрерывной буферизации
    function handlePersistentBuffering() {
        // Показываем уведомление пользователю
        showNotification('Обнаружена продолжительная буферизация. Запускаем автоматическое исправление...', 'warning');
        
        // Отправляем сигнал в background.js для немедленной оптимизации
        chrome.runtime.sendMessage({
            action: 'bufferingDetected',
            count: 10 // Отправляем высокое значение для запуска оптимизации
        });
    }

    // Функция для создания кнопок управления обходом
    function createControlButtons(container) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'bypass-controls';
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.marginTop = '10px';
        
        // Кнопка запуска обхода
        const startButton = document.createElement('button');
        startButton.textContent = 'Start Bypass';
        startButton.className = 'start-bypass-btn';
        startButton.style.backgroundColor = '#ff9800';
        startButton.style.color = 'white';
        startButton.style.border = 'none';
        startButton.style.padding = '5px 10px';
        startButton.style.marginRight = '5px';
        startButton.style.borderRadius = '4px';
        startButton.style.cursor = 'pointer';
        
        // Кнопка перезапуска обхода
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart Bypass';
        restartButton.className = 'restart-bypass-btn';
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.padding = '5px 10px';
        restartButton.style.marginRight = '5px';
        restartButton.style.borderRadius = '4px';
        restartButton.style.cursor = 'pointer';
        
        // Кнопка рекомендаций
        const recommendationsButton = document.createElement('button');
        recommendationsButton.textContent = 'Recommendations';
        recommendationsButton.className = 'recommendations-btn';
        recommendationsButton.style.backgroundColor = '#2196F3';
        recommendationsButton.style.color = 'white';
        recommendationsButton.style.border = 'none';
        recommendationsButton.style.padding = '5px 10px';
        recommendationsButton.style.borderRadius = '4px';
        recommendationsButton.style.cursor = 'pointer';
        
        // Добавляем обработчики кликов
        startButton.addEventListener('click', function() {
            // Используем launcher.js для запуска обхода
            try {
                if (window.ytBypass && typeof window.ytBypass.launchViaWindow === 'function') {
                    const result = window.ytBypass.launchViaWindow();
                    if (result) {
                        showNotification('Bypass started successfully!', 'success');
                    } else {
                        showNotification('Failed to start bypass. Check protocol registration.', 'error');
                    }
                } else {
                    // Запасной вариант, если launcher.js не загрузился
                    chrome.runtime.sendMessage({action: 'startBypass'});
                }
            } catch (e) {
                console.error('Error launching bypass:', e);
                showNotification('Error launching bypass. Check browser console for details.', 'error');
            }
        });
        
        restartButton.addEventListener('click', function() {
            // Используем launcher.js для запуска обхода
            try {
                if (window.ytBypass && typeof window.ytBypass.launchViaWindow === 'function') {
                    const result = window.ytBypass.launchViaWindow();
                    if (result) {
                        showNotification('Bypass restarted successfully!', 'success');
                    } else {
                        showNotification('Failed to restart bypass. Check protocol registration.', 'error');
                    }
                } else {
                    // Запасной вариант, если launcher.js не загрузился
                    chrome.runtime.sendMessage({action: 'restartBypass'});
                }
            } catch (e) {
                console.error('Error restarting bypass:', e);
                showNotification('Error restarting bypass. Check browser console for details.', 'error');
            }
        });
        
        recommendationsButton.addEventListener('click', function() {
            showRecommendations();
        });
        
        // Добавляем кнопки в контейнер
        buttonsContainer.appendChild(startButton);
        buttonsContainer.appendChild(restartButton);
        buttonsContainer.appendChild(recommendationsButton);
        
        // Добавляем контейнер кнопок в основной блок
        container.appendChild(buttonsContainer);
        
        return {startButton, restartButton, recommendationsButton};
    }

    // Функция обновления содержимого водяного знака
    function updateWatermarkContent(watermark, state) {
        // Проверяем, существует ли водяной знак
        if (!watermark) return;
        
        // Обновляем текст водяного знака
        watermark.setAttribute('data-status', state.isRunning ? 'running' : 'stopped');
        
        // Обновляем цвет в зависимости от состояния
        if (state.isRunning) {
            watermark.style.backgroundColor = '#4CAF50'; // Зеленый, если обход запущен
        } else {
            watermark.style.backgroundColor = '#F44336'; // Красный, если обход не запущен
        }
        
        // Создаем индикатор статуса, если его еще нет
        if (!watermark.querySelector('.status-indicator')) {
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'status-indicator';
            statusIndicator.style.cssText = `
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 8px;
                background-color: ${state.isRunning ? '#4CAF50' : '#F44336'};
                display: inline-block;
            `;
            watermark.insertBefore(statusIndicator, watermark.firstChild);
            
            // Добавляем немного отступа для текста
            watermark.style.display = 'flex';
            watermark.style.alignItems = 'center';
            watermark.style.justifyContent = 'center';
        } else {
            // Обновляем цвет индикатора
            const statusIndicator = watermark.querySelector('.status-indicator');
            statusIndicator.style.backgroundColor = state.isRunning ? '#4CAF50' : '#F44336';
        }
    }

    // Функция для проверки регистрации протокола
    function checkProtocolRegistration() {
        // Загружаем конфигурацию
        fetch(chrome.runtime.getURL('bypass_config.json'))
            .then(response => {
                if (!response.ok) {
                    throw new Error('Конфигурационный файл не найден');
                }
                return response.json();
            })
            .then(config => {
                // Проверяем, установлен ли протокол
                if (!config.protocol_installed || !config.bat_path) {
                    // Показываем предупреждение в водяном знаке
                    const watermark = document.querySelector('.yt-watermark');
                    if (watermark) {
                        watermark.classList.add('error');
                        watermark.setAttribute('data-status', 'Требуется установка протокола');
                        watermark.setAttribute('title', 'Нажмите, чтобы настроить YouTube Bypass');
                        
                        // Добавляем обработчик для показа панели с инструкциями
                        watermark.addEventListener('click', function() {
                            showInstallationInstructions();
                        });
                    }
                } else {
                    // Обновляем информацию о последнем запуске
                    const lastLaunch = config.last_launch;
                    if (lastLaunch) {
                        const timeSinceLaunch = Date.now() - lastLaunch;
                        const hoursAgo = Math.floor(timeSinceLaunch / (1000 * 60 * 60));
                        
                        if (hoursAgo < 1) {
                            // Обновляем состояние, если запуск был менее часа назад
                            bypassState.isRunning = true;
                            bypassState.startTime = lastLaunch;
                            updateWatermarkStatus();
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Ошибка при проверке протокола:', error);
            });
    }

    // Функция для показа инструкций по установке
    function showInstallationInstructions() {
        // Получаем или создаем контейнер для панели инструкций
        let panel = document.getElementById('yt-bypass-install-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'yt-bypass-install-panel';
            panel.className = 'yt-bypass-panel';
            panel.innerHTML = `
                <div class="panel-header">
                    <h3>Настройка YouTube Bypass</h3>
                    <button class="close-button">×</button>
                </div>
                <div class="panel-content">
                    <p><strong>Для работы обхода необходимо установить протокол ytbypass://</strong></p>
                    <ol>
                        <li>Запустите файл <strong>install_protocol_direct.bat</strong> от имени администратора</li>
                        <li>Укажите полный путь к файлу <strong>youtube-linuxLina.bat</strong></li>
                        <li>После установки перезапустите браузер</li>
                    </ol>
                    <p>Вы также можете открыть страницу прямого запуска для дополнительных вариантов:</p>
                    <button id="open-direct-launch" class="action-button">Открыть страницу запуска</button>
                </div>
            `;
            
            // Добавляем стили для панели
            const style = document.createElement('style');
            style.textContent = `
                .yt-bypass-panel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 450px;
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    z-index: 9999;
                    font-family: 'Roboto', Arial, sans-serif;
                }
                
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background-color: #f00;
                    color: white;
                    border-radius: 8px 8px 0 0;
                }
                
                .panel-header h3 {
                    margin: 0;
                    font-size: 16px;
                }
                
                .close-button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    line-height: 24px;
                    text-align: center;
                }
                
                .panel-content {
                    padding: 16px;
                    color: #333;
                }
                
                .action-button {
                    background-color: #f00;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 8px;
                }
                
                .action-button:hover {
                    background-color: #c00;
                }
            `;
            
            document.head.appendChild(style);
            document.body.appendChild(panel);
            
            // Добавляем обработчики событий
            const closeButton = panel.querySelector('.close-button');
            if (closeButton) {
                closeButton.addEventListener('click', function() {
                    panel.remove();
                });
            }
            
            const openDirectButton = panel.querySelector('#open-direct-launch');
            if (openDirectButton) {
                openDirectButton.addEventListener('click', function() {
                    chrome.runtime.sendMessage({action: 'openDirectLauncher'});
                    panel.remove();
                });
            }
            
            // Закрытие по клику вне панели
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target.className !== 'yt-watermark') {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        } else {
            // Если панель уже существует, обновляем её видимость
            panel.style.display = 'block';
        }
    }

    // Функция запуска обхода через content script
    function launchBypassFromWatermark() {
        // Показываем уведомление о начале запуска
        showNotification('Запуск обхода через 3 секунды...', 'info');
        
        // Добавляем задержку в 3 секунды перед запуском обхода
        setTimeout(() => {
            // Вместо отправки сообщения в background.js открываем URL с протоколом ytbypass://
            try {
                // Создаем случайный идентификатор для запроса
                const requestId = Math.floor(Math.random() * 999999);
                // Открываем URL с протоколом ytbypass://, что вызовет диалоговое окно системы
                window.location.href = `ytbypass://launch?r=${requestId}`;
                
                // Обновляем состояние
                setTimeout(() => {
                    // Через некоторое время предполагаем, что протокол был запущен
                    bypassState.isRunning = true;
                    bypassState.startTime = Date.now();
                    updateWatermarkStatus();
                }, 2000);
            } catch (e) {
                console.error('Ошибка открытия протокола:', e);
                showNotification('Ошибка запуска обхода. Проверьте настройки протокола.', 'error');
            }
        }, 3000); // Задержка в 3 секунды (3000 мс)
    }

    // Добавляем вызов функции проверки протокола при загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(checkProtocolRegistration, 3000); // Проверяем через 3 секунды после загрузки
    });
})(); 