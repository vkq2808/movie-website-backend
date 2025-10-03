import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const corsEnv = process.env.CORS_ORIGIN;
      const allowedOrigins = (
        typeof corsEnv === 'string' && corsEnv.length ? corsEnv : '*'
      )
        .split(',')
        .map((s) => s.trim());
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });
  type CookieParserFn = (
    secret?: string,
    options?: unknown,
  ) => import('express').RequestHandler;
  const cookieParserFn = cookieParser as unknown as CookieParserFn;
  app.use(cookieParserFn());

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
