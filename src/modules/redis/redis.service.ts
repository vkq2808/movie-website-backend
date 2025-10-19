import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis.Redis;


  onModuleInit() {
    const isProduction = process.env.NODE_ENV === 'production';
    this.client = new Redis.Redis({
      username: isProduction ? process.env.REDIS_USERNAME || 'default' : process.env.REDIS_USERNAME_DEV || 'default',
      password: isProduction ? process.env.REDIS_PASSWORD || 'password' : process.env.REDIS_PASSWORD_DEV || 'password',
      host: isProduction ? process.env.REDIS_HOST || 'localhost' : process.env.REDIS_HOST_DEV || 'localhost',
      port: isProduction ? process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379 : process.env.REDIS_PORT_DEV ? parseInt(process.env.REDIS_PORT_DEV, 10) : 6379,
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis', { host: this.client.options.host, port: this.client.options.port });
    });

    this.client.on('error', (err) => {
      console.error('Redis error: ', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis.Redis {
    return this.client;
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async keys(pattern: string) {
    return this.client.keys(pattern);
  }
}
