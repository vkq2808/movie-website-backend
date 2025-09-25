import { Image } from '../../image/image.entity';
import { EntityManager } from 'typeorm';
import { TMDBMovieImage } from '../dtos/movie.dto';

export async function processMovieImages(
  manager: EntityManager,
  infos: TMDBMovieImage[],
  alt: string,
): Promise<Image[] | null> {
  try {
    const validResults: Image[] = [];
    for (let i = 0; i < infos.length; i++) {
      const result = infos[i];
      if (result) {
        validResults.push(
          await saveImage(
            manager,
            `https://image.tmdb.org/t/p/w500${result.file_path}`,
            alt,
            result,
          ),
        );
      }
    }
    return validResults;
  } catch (error) {
    console.error(`Failed to process images:`, error);
    return null;
  }
}

async function saveImage(
  manager: EntityManager,
  url: string,
  alt: string,
  probeResult: TMDBMovieImage,
): Promise<Image> {
  let image = await manager.findOne(Image, { where: { url } });
  if (!image) {
    image = manager.create(Image, {
      url,
      alt,
      width: probeResult.width,
      height: probeResult.height,
    });
    image = await manager.save(image);
  }
  return image;
}
