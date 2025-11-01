import { DeepPartial } from 'typeorm';
import { WatchProvider } from './watch-provider.entity';

export const DEFAULT_PROVIDERS: DeepPartial<WatchProvider>[] = [
  {
    name: 'Local Server',
    slug: 'local',
    description: 'Videos hosted directly on the backend server',
    logo_url: '/icon.png',
    website_url: '',
    display_priority: 100,
  },
  {
    name: 'YouTube',
    slug: 'youtube',
    description: 'Videos hosted on YouTube',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png',
    website_url: 'https://www.youtube.com',
    display_priority: 80,
  },
  {
    name: 'Cloudflare R2',
    slug: 'r2',
    description: 'Videos hosted on Cloudflare R2 storage',
    logo_url: 'https://media.datacenterdynamics.com/media/images/Cloudflare.width-358.png',
    website_url: 'https://www.cloudflare.com/r2/',
    display_priority: 60,
  },
  // {
  //   name: 'Vimeo',
  //   slug: 'vimeo',
  //   description: 'High-quality videos hosted on Vimeo',
  //   logo_url: 'https://vimeo.bynder.com/transform/fc16e968-0ee9-425a-9d69-11a6b0df75fd/Media-Kit-Wordmark-Thumbnail?io=transform:fill,width:1920&quality=100',
  //   website_url: 'https://vimeo.com',
  //   display_priority: 70,
  // },
  // {
  //   name: 'Dailymotion',
  //   slug: 'dailymotion',
  //   description: 'Video streaming hosted on Dailymotion',
  //   logo_url: 'https://static1.dmcdn.net/images/dailymotion-logo-ogtag-new.png.va3e30462476a82772',
  //   website_url: 'https://www.dailymotion.com',
  //   display_priority: 65,
  // },
];
