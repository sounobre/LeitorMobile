import path from 'node:path';
import { promises as fs } from 'node:fs';

export function e2eStorageDirectory(): string {
  const value = process.env.E2E_STORAGE_DIRECTORY?.trim();
  if (!value) throw new Error('E2E_STORAGE_DIRECTORY must be set by Playwright config');
  return path.resolve(value);
}

export function managedBookPath(bookId: string): string {
  return path.join(e2eStorageDirectory(), 'books', bookId + '.epub');
}

export function managedCoverPath(bookId: string, extension: string): string {
  return path.join(e2eStorageDirectory(), 'covers', bookId + extension);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureStorageParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function syntheticJpeg(): Buffer {
  return Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z', 'base64');
}

export function syntheticPng(): Buffer {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
}

export async function removeIfPresent(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}
