import { exec } from 'child_process';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function convertToHLS(inputPath: string, outputDir: string) {
  await fsPromises.mkdir(outputDir, { recursive: true });

  const hlsPlaylist = path.join(outputDir, 'index.m3u8');

  const ffmpegCmd = `
    ffmpeg -i "${inputPath}" \
    -codec copy -start_number 0 \
    -hls_time 10 -hls_list_size 0 \
    -f hls "${hlsPlaylist}"
  `;

  try {
    await execAsync(ffmpegCmd);
    return hlsPlaylist;
  } catch (error) {
    console.error('FFmpeg HLS conversion failed:', error);
    throw new Error('Failed to convert video to HLS format');
  }
}
