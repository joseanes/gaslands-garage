// app/src/lib/draft/qr.ts
import QRCode from 'qrcode';
import { encodeDraft } from '$lib/draft/io';
import type { Draft } from '$lib/validate/model';

export async function draftToDataURL(draft: Draft): Promise<string> {
  try {
    const encoded = encodeDraft(draft);
    const url = `${location.origin}${location.pathname}?draft=${encoded}`;

    // Generate QR code with more error handling
    console.log("[QR] Generating QR code for URL:", url.substring(0, 50) + "...");

    return await QRCode.toDataURL(url, {
      margin: 1,
      scale: 6,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("[QR] Error generating QR code:", error);

    // Return a fallback image - a tiny 1x1 transparent PNG
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

