import type { Page } from '@playwright/test';

export async function selectReaderText(page: Page, text: string): Promise<void> {
  const iframeHandle = await page.locator('.reader-viewer iframe').elementHandle();
  if (!iframeHandle) throw new Error('EPUB iframe was not found.');
  const frame = await iframeHandle.contentFrame();
  if (!frame) throw new Error('EPUB iframe content was not available.');

  await frame.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node && !(node.textContent ?? '').includes(needle)) node = walker.nextNode();
    if (!node) throw new Error('Reader text was not found: ' + needle);

    const value = node.textContent ?? '';
    const start = value.indexOf(needle);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + needle.length);
    const selection = window.getSelection();
    if (!selection) throw new Error('Reader selection API was not available.');
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    (node.parentElement ?? document.body).dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }, text);
}
