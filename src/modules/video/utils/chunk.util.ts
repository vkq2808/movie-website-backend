import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

export async function assembleChunksToMp4(tempDir: string, outputPath: string) {
  const files = await fsPromises.readdir(tempDir);
  const chunkFiles = files.filter(f => f.endsWith('.chunk'));

  // Sắp xếp theo số thứ tự
  chunkFiles.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(tempDir, chunkFile);
    const data = await fsPromises.readFile(chunkPath);
    await fsPromises.appendFile(outputPath, data);
  }

  // Xoá các chunk sau khi ghép
  for (const f of chunkFiles) {
    await fsPromises.unlink(path.join(tempDir, f));
  }

  await fsPromises.rmdir(tempDir).catch(() => { });
}
