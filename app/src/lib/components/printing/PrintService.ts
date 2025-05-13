// PrintService.ts - Provides utility functions for printing

import type { Draft } from '$lib/draft/io';
import { draftToDataURL } from '$lib/draft/qr';

/**
 * Checks if rules acknowledgment is required before printing
 * @param actionType - The type of action requiring acknowledgment
 * @param hasRules - Whether the user has acknowledged owning the rules
 * @returns - True if action can proceed, false if rules acknowledgment needed
 */
export function checkRulesAcknowledgment(
  actionType: string,
  hasRules: boolean,
  showRulesModal: (action: string) => void
): boolean {
  // If user has acknowledged rules, proceed
  if (hasRules) {
    return true;
  }
  
  // Otherwise, show rules acknowledgment modal
  showRulesModal(actionType);
  return false;
}

/**
 * Executes the print operation
 * @param printStyle - The selected print style
 * @param draft - The current team draft for QR code generation
 */
export async function printTeam(printStyle: string, draft: Draft): Promise<void> {
  console.log("[PrintService] printTeam called");

  try {
    // Generate a fresh QR code for printing
    let printQrCode: string;
    try {
      printQrCode = await draftToDataURL(draft);
      console.log("[PrintService] QR code generated successfully");
    } catch (qrError) {
      console.error("[PrintService] Error generating QR code:", qrError);
      // Use a fallback transparent image
      printQrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }

    // Find QR code image element and update its src
    const hiddenQrImage = document.querySelector('#print-qr-code') as HTMLImageElement | null;
    if (hiddenQrImage) {
      hiddenQrImage.style.display = 'block'; // Make sure it's visible
      hiddenQrImage.src = printQrCode;
      console.log("[PrintService] QR code image updated");
    } else {
      console.warn("[PrintService] QR code image element not found");
    }

    // Apply the print style attribute
    if (printStyle && typeof document !== 'undefined') {
      document.body.setAttribute('data-print-format', printStyle);
      console.log("[PrintService] Print format applied:", printStyle);
    }

    // Make sure the print container is at least temporarily visible
    const printViewElement = document.getElementById('gaslands-print-view');
    if (printViewElement) {
      // Force it to be visible BEFORE we try to clone it in the print handler
      const originalDisplay = printViewElement.style.display;
      printViewElement.style.display = 'block';

      // Let the custom print handler take over
      console.log("[PrintService] Print view element found and made visible, calling window.print()");

      // Give the browser a moment to render the now-visible print view
      setTimeout(() => {
        try {
          window.print();

          // Restore the original display after a delay
          setTimeout(() => {
            printViewElement.style.display = originalDisplay;
          }, 1000);
        } catch (printError) {
          console.error("[PrintService] Error during printing:", printError);
          printViewElement.style.display = originalDisplay;
        }
      }, 200);
    } else {
      console.error("[PrintService] Print view element not found");
      alert('Print view not found. Please try again or refresh the page.');
    }
  } catch (err) {
    console.error("[PrintService] Error during printing preparation:", err);
    alert('There was an error preparing for printing. Please try again.');
  }
}

/**
 * Wrapper function for printing with rules check
 */
export function printWithRulesCheck(
  printStyle: string,
  draft: Draft,
  hasRules: boolean,
  showRulesModal: (action: string) => void
): void {
  if (checkRulesAcknowledgment('printTeam', hasRules, showRulesModal)) {
    printTeam(printStyle, draft);
  }
}