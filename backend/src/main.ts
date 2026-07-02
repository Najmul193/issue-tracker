import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174'];

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
}
bootstrap();
