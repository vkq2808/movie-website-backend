import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
require('dotenv').config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN ?? '*').split(',');
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
