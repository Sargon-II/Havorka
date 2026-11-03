/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore - pdfjs-dist has complex types but works perfectly in browser
import * as pdfjsLib from 'pdfjs-dist';

// Dynamic helper version from the imported library
const pdfjsVersion = pdfjsLib.version || '4.0.379'; 

// Use the official CDN for the worker to avoid packing issues and enable zero-install offline worker caching
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;

/**
 * Parses text from a PDF file directly in the browser.
 */
export async function parsePdfOnClient(arrayBuffer: ArrayBuffer, onProgress?: (percent: number) => void): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          // Check if it's on a new line (by transform position, if available)
          const transform = (item as any).transform;
          const y = transform ? transform[5] : null;
          
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 8) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
            pageText += ' ';
          }
          
          pageText += item.str;
          if (y !== null) {
            lastY = y;
          }
        }
      }

      fullText += pageText + '\n\n';
      if (onProgress) {
        onProgress(Math.round((pageNum / numPages) * 100));
      }
    }

    return fullText;
  } catch (err: any) {
    console.error('Error in parsePdfOnClient:', err);
    throw new Error('Не удалось разобрать PDF файл на клиенте: ' + (err.message || err.toString()));
  }
}
