// print-fix.js - Stand-alone print functionality fix
// This is injected to fix printing issues

document.addEventListener('DOMContentLoaded', function() {
  // Listen for print events
  window.addEventListener('beforeprint', function() {
    console.log('Print event detected, preparing print view...');
    
    // Make sure the print view is visible
    const printView = document.getElementById('gaslands-print-view');
    if (printView) {
      printView.style.display = 'block';
      
      // Look for QR image element in print view
      const qrCodeImage = document.getElementById('print-qr-code');
      if (qrCodeImage) {
        // Make sure it's visible
        qrCodeImage.style.display = 'block';
      }
      
      // Any placeholders to hide?
      const placeholders = document.querySelectorAll('.qr-code-placeholder');
      placeholders.forEach(placeholder => {
        placeholder.style.display = 'none';
      });
    } else {
      console.error('Print view element not found! Expected element with id="gaslands-print-view"');
    }
  });
  
  // After printing, hide the print view again
  window.addEventListener('afterprint', function() {
    console.log('Print completed, restoring view...');
    
    // Hide the print view again
    const printView = document.getElementById('gaslands-print-view');
    if (printView) {
      printView.style.display = 'none';
      
      // Look for QR image element in print view
      const qrCodeImage = document.getElementById('print-qr-code');
      if (qrCodeImage) {
        // Hide it again
        qrCodeImage.style.display = 'none';
      }
      
      // Show placeholders again
      const placeholders = document.querySelectorAll('.qr-code-placeholder');
      placeholders.forEach(placeholder => {
        placeholder.style.display = 'block';
      });
    }
  });
  
  console.log('Print event listeners registered');
});