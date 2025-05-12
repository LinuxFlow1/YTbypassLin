// Launcher script for the YouTube Bypass extension
// This script handles the protocol communication and launch

// Main function to launch the bypass
function launchBypass() {
  try {
    console.log("Attempting to launch bypass...");
    
    // Get protocol URL
    const bypassUrl = "ytbypass://launch";
    
    // Try to open the URL
    window.location.href = bypassUrl;
    
    // Alternative method
    const link = document.createElement('a');
    link.href = bypassUrl;
    link.click();
    
    console.log("Bypass launch attempted");
    return true;
  } catch (e) {
    console.error("Error launching bypass:", e);
    return false;
  }
}

// Alternative function using window.open
function launchBypassViaWindow() {
  try {
    console.log("Attempting to launch bypass via window.open...");
    
    // Get protocol URL
    const bypassUrl = "ytbypass://launch";
    
    // Try to open the URL in a new window
    const win = window.open(bypassUrl, '_blank');
    
    // Close the window after a short delay
    setTimeout(() => {
      if (win) {
        win.close();
      }
    }, 500);
    
    console.log("Bypass launch via window.open attempted");
    return true;
  } catch (e) {
    console.error("Error launching bypass via window.open:", e);
    return false;
  }
}

// Export functions for use in other scripts
window.ytBypass = {
  launch: launchBypass,
  launchViaWindow: launchBypassViaWindow
};

console.log("YouTube Bypass launcher script loaded"); 