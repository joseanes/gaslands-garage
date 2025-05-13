// print-direct-qr.js - Simplified print handler with direct DOM manipulation
(function() {
  // Wait for document to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[print-direct] Initializing simplified print handler');
    
    // Capture the print function reference
    const originalPrint = window.print;
    
    // Override the window.print function
    window.print = function() {
      try {
        console.log('[print-direct] Print requested, preparing content');
        
        // Find the print view content
        const printViewElement = document.getElementById('gaslands-print-view');
        
        if (!printViewElement) {
          console.error('[print-direct] Print view element not found!');
          originalPrint.call(window);
          return;
        }
        
        console.log('[print-direct] Found print view element');
        
        // Set specific print class on body for CSS targeting
        document.body.classList.add('printing-in-progress');
        
        // Ensure print view is visible during printing
        const originalDisplayStyle = printViewElement.style.display;
        printViewElement.style.display = 'block';
        printViewElement.style.visibility = 'visible';
        
        // Make sure QR code image is visible
        const qrCodeImage = document.getElementById('print-qr-code');
        if (qrCodeImage) {
          qrCodeImage.style.display = 'block';
          console.log('[print-direct] QR code image made visible');
        }
        
        // Don't wait for QR code to load, just proceed with direct printing
        console.log('[print-direct] Using direct browser printing');
        
        // Use a small timeout to ensure the display change takes effect
        setTimeout(function() {
          try {
            // Use the browser's built-in print function
            originalPrint.call(window);
            
            // Reset styles after printing (with a delay)
            setTimeout(function() {
              printViewElement.style.display = originalDisplayStyle;
              document.body.classList.remove('printing-in-progress');
              console.log('[print-direct] Printing complete, reset display styles');
            }, 1000);
          } catch(err) {
            console.error('[print-direct] Error during actual printing:', err);
            // Reset display style if print fails
            printViewElement.style.display = originalDisplayStyle;
            document.body.classList.remove('printing-in-progress');
          }
        }, 300);
      } catch (error) {
        console.error('[print-direct] Error during print preparation:', error);
        document.body.classList.remove('printing-in-progress');
        // Fall back to original print function
        originalPrint.call(window);
      }
    };
    
    console.log('[print-direct] Simplified print handler initialized');
  });
})();