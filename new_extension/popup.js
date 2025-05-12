// Скрипт для управления интерфейсом настроек водяного знака
document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы формы
    const enabledCheckbox = document.getElementById('enabled');
    const textInput = document.getElementById('text');
    const opacitySlider = document.getElementById('opacity');
    const sizeInput = document.getElementById('size');
    const colorPicker = document.getElementById('color');
    const colorValue = document.getElementById('color-value');
    const interactiveCheckbox = document.getElementById('interactive');
    const shapeOptions = document.querySelectorAll('.shape-option');
    const previewElement = document.getElementById('preview');
    const saveButton = document.getElementById('save');
    const resetButton = document.getElementById('reset');
    const positionSelector = document.getElementById('positionSelector');
    const scriptPathInput = document.getElementById('scriptPath');
    const closeWindowBtn = document.getElementById('closeWindowBtn');
    
    // Проверяем, открыто ли окно как отдельное или как popup расширения
    function checkWindowType() {
        try {
            // Если окно открыто как отдельное, то window.opener будет не null
            // или если ширина окна больше стандартной ширины popup (320px)
            if (window.opener !== null || window.outerWidth > 350) {
                // Показываем кнопку закрытия окна
                closeWindowBtn.style.display = 'block';
                
                // Добавляем заголовок страницы
                document.title = 'Настройка водяного знака';
                
                // Можно также изменить ширину контейнера для лучшего отображения
                document.body.style.width = 'auto';
                document.querySelector('.container').style.width = '350px';
                document.querySelector('.container').style.margin = '0 auto';
            }
        } catch (e) {
            console.error('Ошибка при определении типа окна:', e);
        }
    }
    
    // Вызываем функцию проверки типа окна
    checkWindowType();
    
    // Обработчик для кнопки закрытия окна
    closeWindowBtn.addEventListener('click', function() {
        window.close();
    });
    
    // Текущая форма водяного знака
    let currentShape = 'rectangle';
    
    // Загружаем сохраненные настройки
    loadSettings();
    
    // Обработчики событий для формы
    
    // Включение/выключение водяного знака
    enabledCheckbox.addEventListener('change', updatePreview);
    
    // Изменение текста
    textInput.addEventListener('input', updatePreview);
    
    // Изменение прозрачности
    opacitySlider.addEventListener('input', updatePreview);
    
    // Изменение размера
    sizeInput.addEventListener('input', updatePreview);
    
    // Изменение цвета
    colorPicker.addEventListener('input', function() {
        colorValue.textContent = this.value.toUpperCase();
        updatePreview();
    });
    
    // Переключение интерактивного режима
    interactiveCheckbox.addEventListener('change', updatePreview);
    
    // Переключение формы
    shapeOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Удаляем класс selected со всех опций
            shapeOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Добавляем класс selected на выбранную опцию
            this.classList.add('selected');
            
            // Обновляем текущую форму
            currentShape = this.dataset.shape;
            
            // Обновляем предпросмотр
            updatePreview();
        });
    });
    
    // Сохранение настроек
    saveButton.addEventListener('click', saveSettings);
    
    // Сброс настроек
    resetButton.addEventListener('click', resetSettings);
    
    // Функция обновления предпросмотра
    function updatePreview() {
        // Применяем текст
        previewElement.textContent = textInput.value || 'WATERMARK';
        
        // Применяем прозрачность
        previewElement.style.opacity = opacitySlider.value / 100;
        
        // Применяем цвет фона
        previewElement.style.backgroundColor = colorPicker.value;
        
        // Применяем форму
        if (currentShape === 'circle') {
            previewElement.classList.add('circle');
            previewElement.style.width = '60px';
            previewElement.style.height = '60px';
            previewElement.style.padding = '0';
        } else {
            previewElement.classList.remove('circle');
            previewElement.style.width = 'auto';
            previewElement.style.height = 'auto';
            previewElement.style.padding = '5px 15px';
        }
        
        // Сбрасываем все классы позиционирования
        previewElement.className = 'watermark-preview';
        // Добавляем класс текущей позиции
        previewElement.classList.add(positionSelector.value);
    }
    
    // Функция загрузки настроек
    function loadSettings() {
        chrome.storage.local.get(['watermark_settings'], function(result) {
            const settings = result.watermark_settings || {
                enabled: true,
                text: 'WATERMARK',
                opacity: 0.7,
                size: '120',
                color: '#3F51B5',
                shape: 'rectangle',
                interactive: true
            };
            
            // Применяем загруженные настройки к форме
            enabledCheckbox.checked = settings.enabled !== false;
            textInput.value = settings.text || 'WATERMARK';
            opacitySlider.value = settings.opacity || 0.7;
            sizeInput.value = settings.size ? settings.size.replace('px', '') : '120';
            colorPicker.value = settings.color || '#3F51B5';
            colorValue.textContent = colorPicker.value.toUpperCase();
            interactiveCheckbox.checked = settings.interactive !== false;
            
            // Устанавливаем форму
            currentShape = settings.shape || 'rectangle';
            shapeOptions.forEach(option => {
                if (option.dataset.shape === currentShape) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
            
            // Обновляем предпросмотр
            updatePreview();
        });
    }
    
    // Функция сохранения настроек
    function saveSettings() {
        const settings = {
            enabled: enabledCheckbox.checked,
            text: textInput.value,
            opacity: parseFloat(opacitySlider.value),
            size: sizeInput.value + 'px',
            color: colorPicker.value,
            shape: currentShape,
            interactive: interactiveCheckbox.checked
        };
        
        // Сохраняем настройки водяного знака
        chrome.storage.local.set({watermark_settings: settings}, function() {
            console.log('Настройки сохранены:', settings);
            
            // Сохраняем путь к bat-файлу отдельно
            const scriptPath = scriptPathInput.value.trim();
            if (scriptPath) {
                chrome.storage.sync.set({scriptPath: scriptPath}, function() {
                    console.log('Путь к bat-файлу сохранен:', scriptPath);
                    
                    // Отправляем сообщение в background.js для обновления пути
                    chrome.runtime.sendMessage({
                        action: 'setBypassPath',
                        path: scriptPath
                    });
                });
            }
            
            // Применяем настройки ко всем вкладкам с YouTube
            applyToAllYouTubeTabs(settings);
            
            // Показываем уведомление о сохранении
            showNotification('Настройки сохранены!');
            
            // Если окно было открыто как отдельное, закрываем его после сохранения
            if (window.opener !== null || window.outerWidth > 350) {
                // Небольшая задержка, чтобы пользователь увидел уведомление
                setTimeout(() => {
                    window.close();
                }, 1500);
            }
        });
    }
    
    // Функция сброса настроек
    function resetSettings() {
        const defaultSettings = {
            enabled: true,
            text: 'WATERMARK',
            opacity: 0.7,
            size: '120px',
            color: '#3F51B5',
            shape: 'rectangle',
            interactive: true
        };
        
        // Применяем настройки по умолчанию к форме
        enabledCheckbox.checked = defaultSettings.enabled;
        textInput.value = defaultSettings.text;
        opacitySlider.value = defaultSettings.opacity;
        sizeInput.value = defaultSettings.size.replace('px', '');
        colorPicker.value = defaultSettings.color;
        colorValue.textContent = colorPicker.value.toUpperCase();
        interactiveCheckbox.checked = defaultSettings.interactive;
        
        // Устанавливаем форму по умолчанию
        currentShape = defaultSettings.shape;
        shapeOptions.forEach(option => {
            if (option.dataset.shape === currentShape) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
        
        // Обновляем предпросмотр
        updatePreview();
        
        // Сохраняем настройки по умолчанию
        chrome.storage.local.set({watermark_settings: defaultSettings}, function() {
            console.log('Настройки сброшены к значениям по умолчанию');
            
            // Применяем настройки к активной вкладке
            applyToActiveTab(defaultSettings);
            
            // Показываем уведомление о сбросе
            showNotification('Настройки сброшены!');
        });
    }
    
    // Функция применения настроек к активной вкладке
    function applyToActiveTab(settings) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
                const activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, {
                    action: 'updateWatermark',
                    settings: settings
                });
            }
        });
    }
    
    // Функция применения настроек ко всем вкладкам с YouTube
    function applyToAllYouTubeTabs(settings) {
        // Ищем все вкладки с YouTube
        chrome.tabs.query({url: "*://*.youtube.com/*"}, function(tabs) {
            // Для каждой вкладки с YouTube
            tabs.forEach(function(tab) {
                // Отправляем сообщение об обновлении настроек водяного знака
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateWatermark',
                    settings: settings
                });
            });
        });
    }
    
    // Функция отображения уведомления
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FFA500' : '#f44336'};
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 500;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Показываем уведомление
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Скрываем уведомление через 2 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);
    }
    
    // Обработчики изменений настроек
    colorPicker.addEventListener('change', function() {
        updatePreview();
        saveSettings();
    });
    
    opacitySlider.addEventListener('input', function() {
        updatePreview();
        saveSettings();
    });
    
    positionSelector.addEventListener('change', function() {
        updatePreview();
        saveSettings();
    });
    
    scriptPathInput.addEventListener('change', function() {
        saveSettings();
    });

    // Загружаем путь к bat-файлу при загрузке страницы
    chrome.storage.sync.get(['scriptPath'], function(result) {
        if (result.scriptPath) {
            scriptPathInput.value = result.scriptPath;
        }
    });
}); 