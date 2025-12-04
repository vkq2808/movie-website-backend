import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { morganMiddleware } from './common/logger/morgan.middleware';
import { winstonLoggerOptions } from './common/logger/winston-logger';
import { WinstonModule } from 'nest-winston';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: WinstonModule.createLogger(winstonLoggerOptions),
  });

  // app.enableCors({
  //   origin: (
  //     origin: string | undefined,
  //     callback: (err: Error | null, allow?: boolean) => void,
  //   ) => {
  //     const corsEnv = 'https://haunted-tomb-wrrg7jr4pvqg29v99-3000.app.github.dev';
  //     const allowedOrigins = (
  //       typeof corsEnv === 'string' && corsEnv.length ? corsEnv : '*'
  //     )
  //       .split(',')
  //       .map((s) => s.trim());
  //     if (
  //       !origin ||
  //       allowedOrigins.includes('*') ||
  //       allowedOrigins.includes(origin)
  //     ) {
  //       callback(null, true);
  //     } else {
  //       callback(new Error('Not allowed by CORS'));
  //     }
  //   },
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   preflightContinue: false,
  //   optionsSuccessStatus: 204,
  //   credentials: true,
  // });

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true); // eslint-disbale-line @typescript-eslint/no-unsafe-call
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Cho phép gửi cookie, Authorization header, v.v.
  });

  type CookieParserFn = (
    secret?: string,
    options?: unknown,
  ) => import('express').RequestHandler;
  const cookieParserFn = cookieParser as unknown as CookieParserFn;
  app.use(cookieParserFn());

  // Dùng Morgan để log request HTTP
  // app.use(morganMiddleware);

  const port = 2808;
  await app.listen(
    port,
    process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1',
  );
}
void bootstrap();
