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
  // Generate a fresh QR code for printing without showing the modal
  const printQrCode = await draftToDataURL(draft);

  // Find and prepare the print view elements
  const hiddenQrImage = document.querySelector('#print-qr-code') as HTMLImageElement | null;
  const printView = document.querySelector('#gaslands-print-view') as HTMLElement | null;
  const placeholder = document.querySelector('.qr-code-placeholder') as HTMLElement | null;

  // For checking our component structure
  const printViewComponent = document.querySelector('.print-view-content') as HTMLElement | null;

  if (hiddenQrImage) {
    // Set the QR code directly to this element
    hiddenQrImage.src = printQrCode;
    hiddenQrImage.style.display = "block";

    // Hide placeholder
    if (placeholder) {
      placeholder.style.display = "none";
    }
  }

  // Make sure the print view is visible
  if (printView) {
    printView.style.display = "block";
    console.log('Print view element made visible');
  } else {
    console.error('Print view element not found!');
  }

  // Apply the correct print format to the body element
  if (printStyle && typeof document !== 'undefined') {
    document.body.setAttribute('data-print-format', printStyle);
  }

  // Give the browser a moment to render the QR code into the DOM
  setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      console.error("Error during printing:", err);
    }

    // After printing, reset the body attribute
    if (typeof document !== 'undefined') {
      document.body.removeAttribute('data-print-format');
    }

    // Reset the QR code display after printing
    if (hiddenQrImage) {
      setTimeout(() => {
        hiddenQrImage.style.display = 'none';
        // Show placeholder again
        if (placeholder) placeholder.style.display = 'block';
      }, 500);
    }
  }, 500); // Increased timeout to ensure proper rendering
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