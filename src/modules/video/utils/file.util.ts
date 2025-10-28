import { promises as fsPromises } from 'fs';
import * as path from 'path';

export async function ensureDir(dirPath: string) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

export async function deleteFileSafe(filePath: string) {
  await fsPromises.unlink(filePath).catch(() => { });
}

export function getSafePath(baseDir: string, fileName: string) {
  const safe = path.normalize(fileName).replace(/^(\.\.[/\\])+/, '');
  return path.join(baseDir, safe);
}
