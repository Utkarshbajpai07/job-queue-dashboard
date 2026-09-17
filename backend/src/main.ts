import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties from incoming bodies
      forbidNonWhitelisted: true, // reject requests that send unexpected fields
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Job queue API listening on port ${port}`);
}
bootstrap();
