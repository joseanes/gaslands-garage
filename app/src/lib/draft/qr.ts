// app/src/lib/draft/qr.ts
import QRCode from 'qrcode';
import { encodeDraft } from '$lib/draft/io';
import type { Draft } from '$lib/validate/model';

export async function draftToDataURL(draft: Draft): Promise<string> {
  try {
    if (!draft) {
      console.error("[QR] Error: Draft is undefined or null");
      throw new Error("Draft is undefined or null");
    }

    const encoded = encodeDraft(draft);
    if (!encoded) {
      console.error("[QR] Error: Failed to encode draft");
      throw new Error("Failed to encode draft");
    }

    // Ensure location is available (web context)
    if (typeof location === 'undefined') {
      console.error("[QR] Error: Location not available");
      throw new Error("Location not available");
    }

    const url = `${location.origin}${location.pathname}?draft=${encoded}`;
    console.log("[QR] Generating QR code for URL:", url.substring(0, 50) + "...");
    console.log("[QR] Full URL length:", url.length);

    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      scale: 6,
      errorCorrectionLevel: 'M'
    });

    console.log("[QR] Successfully generated QR code, data URL length:", qrDataUrl.length);
    return qrDataUrl;
  } catch (error) {
    console.error("[QR] Error generating QR code:", error);

    // Return a fallback image - a tiny 1x1 transparent PNG
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

