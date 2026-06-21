import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const config = app.get(AppConfigService);

  // Globális prefix (pl. /api).
  app.setGlobalPrefix(config.apiGlobalPrefix);

  // Biztonsági fejlécek.
  app.use(helmet());

  // CORS a megengedett originekre (vesszővel elválasztva az env-ben).
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  // Globális validáció: ismeretlen mezők eldobása + transzformáció.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Egységes hibaválasz (ApiErrorBody).
  app.useGlobalFilters(new AllExceptionsFilter());

  // Tiszta leállás (Prisma onModuleDestroy, BullMQ worker close).
  app.enableShutdownHooks();

  await app.listen(config.apiPort);
  logger.log(
    `Valloreg API fut a ${config.apiPort} porton (prefix: /${config.apiGlobalPrefix}).`,
  );
}

void bootstrap();
