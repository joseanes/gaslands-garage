// app/src/lib/draft/qr.ts
import QRCode from 'qrcode';
import { encodeDraft } from '$lib/draft/io';
import type { Draft } from '$lib/validate/model';

export async function draftToDataURL(draft: Draft): Promise<string> {
  const encoded = encodeDraft(draft);
  const url = `${location.origin}${location.pathname}?draft=${encoded}`;
  return QRCode.toDataURL(url, { margin: 1, scale: 6 });
}

