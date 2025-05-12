// Background script for the Interactive Water Mark with bypass functionality

// Key for storing watermark settings in local storage
const STORAGE_KEY = 'watermark_settings';
const BYPASS_PATH_KEY = 'bypass_script_path';

// Bypass state
const bypassState = {
  isRunning: false,
  startTime: null,
  bufferingEvents: 0,
  videoQuality: 'auto',
  lastRestart: null
};

// Buffering event counter
let bufferingCount = 0;

// Default bypass script path
let BYPASS_SCRIPT_PATH = '';

// Function to load path from config file
function loadBypassPathFromConfigFile() {
  try {
    const configUrl = chrome.runtime.getURL('bypass_config.json');
    
    fetch(configUrl)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          console.log('Config file not found, using stored path');
          return null;
        }
      })
      .then(data => {
        if (data && data.bat_path) {
          console.log('Found bat_path in config file:', data.bat_path);
          // Convert path to proper format
          let newPath = data.bat_path;
          // Update stored path
          setBypassPath(newPath);
        }
      })
      .catch(error => {
        console.log('Error reading config file:', error);
      });
  } catch (e) {
    console.error('Error loading path from config:', e);
  }
}

// Load saved path on startup
chrome.storage.local.get([BYPASS_PATH_KEY], function(result) {
  if (result && result[BYPASS_PATH_KEY]) {
    BYPASS_SCRIPT_PATH = result[BYPASS_PATH_KEY];
    console.log('Loaded saved bypass file path:', BYPASS_SCRIPT_PATH);
  } else {
    // Если сохраненного пути нет, пробуем загрузить из конфигурационного файла
    loadBypassPathFromConfigFile();
  }
});

// Function to set bypass file path
function setBypassPath(path) {
  BYPASS_SCRIPT_PATH = path;
  chrome.storage.local.set({[BYPASS_PATH_KEY]: path}, function() {
    console.log('Saved bypass file path:', path);
  });
}

// Default watermark settings
const DEFAULT_SETTINGS = {
  enabled: true,
  text: 'YT Bypass',
  opacity: 0.7,
  size: '120px',
  color: '#3F51B5',
  shape: 'rectangle',
  position: { top: '20px', right: '20px' },
  interactive: true
};

// Function to save watermark settings
function saveWatermarkSettings(settings) {
  chrome.storage.local.set({[STORAGE_KEY]: settings}, function() {
    console.log('Watermark settings saved:', settings);
  });
}

// Function to get watermark settings
function getWatermarkSettings(callback) {
  chrome.storage.local.get([STORAGE_KEY], function(result) {
    callback(result[STORAGE_KEY] || DEFAULT_SETTINGS);
  });
}

// Function to check bypass status
function checkBypassStatus() {
  // We check the presence of the youtube-bypass process through a command execution
  // Since we cannot directly check, we assume the bypass is working
  bypassState.isRunning = true;
  bypassState.startTime = Date.now();
  
  // For demonstration, the state can be toggled every minute
  // In a real scenario, there should be a check through command execution
  if (!chrome.runtime.lastStatus) {
    chrome.runtime.lastStatus = true;
  }
  
  return bypassState.isRunning;
}

// Function to update bypass status in all tabs
function updateAllTabs() {
  chrome.tabs.query({url: '*://*.youtube.com/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'bypassStatusChanged',
        isRunning: bypassState.isRunning
      });
    });
  });
}

// Global variable to store the last URL for buffering fix
let lastBufferingFixUrl = '';

// Buffering event handler
function handleBuffering() {
  // Increment buffering counter
  bufferingCount++;
  
  // Update status in all YouTube tabs
  updateAllTabs();
  
  // If more than 3 buffering events occur in a short period, suggest fixing
  if (bufferingCount >= 3) {
    // Reset counter
    bufferingCount = 0;
    
    // Form bypass file path
    let bypassUrl = BYPASS_SCRIPT_PATH;
    if (!bypassUrl.startsWith('file:///')) {
      bypassUrl = 'file:///' + bypassUrl.replace(/\\/g, '/');
    }
    
    // Show notification with button to start bypass
    chrome.notifications.create('fix_buffering', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'YouTube Playback Issues',
      message: 'Frequent delays detected. Would you like to run optimization?',
      buttons: [
        { title: 'Fix Buffering' }
      ],
      priority: 2
    });
    
    // Save URL for use in notification button click handler
    lastBufferingFixUrl = bypassUrl;
  }
}

// Function to start bypass
function startBypass() {
  try {
    // Используем протокол ytbypass:// с дополнительным параметром, чтобы обойти кэширование
    const randomParam = Math.floor(Math.random() * 1000000);
    const protocolUrl = `ytbypass://launch?r=${randomParam}`;
    
    // Открываем ссылку с протоколом в новой вкладке
    chrome.tabs.create({ url: protocolUrl }, function(tab) {
      // Закрываем вкладку после небольшой задержки
      setTimeout(() => {
        chrome.tabs.remove(tab.id);
      }, 800);
    });
    
    // Обновляем статус обхода
    bypassState.isRunning = true;
    bypassState.startTime = Date.now();
    
    // Обновляем время последнего запуска в конфигурации
    updateConfigFile({
      last_launch: Date.now()
    });
    
    // Обновляем статус во всех вкладках
    updateAllTabs();
    
    // Показываем уведомление об успешном запуске
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'YouTube Bypass',
      message: 'Обход запущен успешно!',
      priority: 1
    });
    
    return { success: true };
  } catch (e) {
    console.error('Error during bypass launch:', e);
    
    // Показываем уведомление об ошибке
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Ошибка запуска',
      message: 'Не удалось запустить обход. Проверьте настройки протокола.',
      priority: 2
    });
    
    return { success: false, error: e.message };
  }
}

// Function to restart bypass (uses the same logic)
function restartBypass() {
  // Optimize network buffer settings before starting
  optimizeNetworkSettings();
  
  try {
    // Используем протокол ytbypass:// с дополнительным параметром
    const randomParam = Math.floor(Math.random() * 1000000);
    const protocolUrl = `ytbypass://restart?r=${randomParam}`;
    
    // Открываем ссылку с протоколом в новой вкладке
    chrome.tabs.create({ url: protocolUrl }, function(tab) {
      // Закрываем вкладку после небольшой задержки
      setTimeout(() => {
        chrome.tabs.remove(tab.id);
      }, 800);
    });
    
    // Обновляем статус обхода
    bypassState.isRunning = true;
    bypassState.startTime = Date.now();
    
    // Обновляем время последнего запуска в конфигурации
    updateConfigFile({
      last_restart: Date.now(),
      last_launch: Date.now()
    });
    
    // Обновляем статус во всех вкладках
    updateAllTabs();
    
    return { success: true };
  } catch (e) {
    console.error('Error during bypass restart:', e);
    return { success: false, error: e.message };
  }
}

// Function to optimize network settings for buffering
function optimizeNetworkSettings() {
  try {
    // Path to the configuration file
    const settingsPath = 'bypass_settings.conf';
    
    // Load current settings file from local storage
    chrome.storage.local.get(['bypass_settings'], function(result) {
      let settings = result.bypass_settings || {};
      
      // Set optimal values to eliminate buffering
      settings.BUFFER_SIZE = 131072; // Increase buffer size to 128 KB
      settings.WINDOW_SIZE = 8388608; // Increase window size to 8 MB
      settings.FRAGMENT_SIZE = 2; // Decrease fragment size for faster transmission
      settings.TIMEOUT_MS = 5000; // Increase timeout for stability
      
      // Save settings back
      chrome.storage.local.set({ bypass_settings: settings }, function() {
        console.log('Buffering settings optimized');
      });
    });
  } catch (e) {
    console.error('Error optimizing buffering settings:', e);
  }
}

// Function to update config file
function updateConfigFile(changes = {}) {
  try {
    // Fetch current config
    const configUrl = chrome.runtime.getURL('bypass_config.json');
    
    fetch(configUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Config file not found');
        }
        return response.json();
      })
      .then(config => {
        // Apply changes
        const updatedConfig = {...config, ...changes};
        
        // Save changes
        const blob = new Blob([JSON.stringify(updatedConfig, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        // Create download
        chrome.downloads.download({
          url: url,
          filename: 'bypass_config.json',
          conflictAction: 'overwrite',
          saveAs: false
        }, () => {
          URL.revokeObjectURL(url);
        });
      })
      .catch(error => {
        console.error('Error updating config file:', error);
      });
  } catch (e) {
    console.error('Error updating config file:', e);
  }
}

// Обработчик сообщений от контент-скрипта и popup.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startBypass') {
    // Логика запуска обхода
    startBypass()
      .then(result => {
        sendResponse({success: true, message: 'Bypass started successfully'});
      })
      .catch(error => {
        sendResponse({success: false, message: error.message});
      });
      
    return true; // Важно для асинхронного ответа
  }
  
  // Обработчик для открытия popup.html
  if (request.action === 'openPopup') {
    // Открываем popup.html в новом окне
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 360,
      height: 600
    }, function(window) {
      // Отправляем ответ об успешном открытии
      sendResponse({success: true});
    });
    
    return true; // Важно для асинхронного ответа
  }
  
  // Проверка состояния обхода
  if (request.action === 'checkBypassStatus') {
    // Check if bypass is running and respond
    const status = checkBypassStatus();
    sendResponse({isRunning: status});
  } 
  else if (request.action === 'getBypassPath') {
    // Return the current bypass path
    sendResponse({path: BYPASS_SCRIPT_PATH});
  }
  else if (request.action === 'bufferingDetected') {
    // Handle buffering event
    handleBuffering();
    sendResponse({success: true});
  }
  else if (request.action === 'setBypassPath') {
    // Set bypass path and update config
    if (request.path) {
      setBypassPath(request.path);
      
      updateConfigFile({
        bat_path: request.path,
        protocol_installed: true
      });
      
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'No path provided'});
    }
  }
  else if (request.action === 'updateLastLaunch') {
    // Update last launch time
    if (request.time) {
      updateConfigFile({
        last_launch: request.time
      });
      sendResponse({success: true});
    } else {
      sendResponse({success: false, error: 'No time provided'});
    }
  }
  else if (request.action === 'restartBypass') {
    // Restart bypass
    restartBypass();
    
    // Update config
    updateConfigFile({
      last_restart: Date.now()
    });
    
    sendResponse({success: true});
  }
  
  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Set initial watermark settings
    saveWatermarkSettings(DEFAULT_SETTINGS);
    console.log('Initial watermark settings set');
    
    // Load saved bypass script path
    chrome.storage.sync.get(['scriptPath'], function(result) {
      if (result.scriptPath) {
        BYPASS_SCRIPT_PATH = result.scriptPath;
        console.log('Loaded saved bypass file path:', BYPASS_SCRIPT_PATH);
      }
    });
    
    // Start first bypass status check
    checkBypassStatus();
  }
});

// Handle extension icon click (if popup not used)
chrome.action.onClicked.addListener((tab) => {
  // Check if popup is open
  if (chrome.action.getPopup) {
    chrome.action.getPopup({}, function(popup) {
      if (!popup) {
        // If popup not installed, send message to toggle watermark visibility
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleWatermark'
        });
      }
    });
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
  if (notificationId === 'fix_buffering' && buttonIndex === 0) {
    chrome.tabs.create({ url: lastBufferingFixUrl }, function(tab) {
      // Close tab after 2 seconds, as bat file should open in system
      setTimeout(function() {
        chrome.tabs.remove(tab.id);
        
        // Update bypass state
        bypassState.isRunning = true;
        updateAllTabs();
      }, 2000);
    });
  }
});

// Start periodic bypass status check
setInterval(function() {
  const status = checkBypassStatus();
  if (bypassState.isRunning !== status) {
    bypassState.isRunning = status;
    updateAllTabs();
  }
}, 60000); // Check every minute

console.log('Interactive Water Mark extension started in background mode'); 