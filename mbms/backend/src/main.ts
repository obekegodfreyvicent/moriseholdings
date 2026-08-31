import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    cors: {
      origin: [/^http:\/\/localhost:\d+$/],
      credentials: true,
    },
  });

  // Clients call the API Gateway at /api/v1/{service}/{resource} —
  // 09_API Specification, Section 2.1. This monolith plays that role for
  // the Sprint 1+2 slice.
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI / Swagger — the machine-readable companion to 09_API
  // Specification. Interactive UI at /api/v1/docs, raw document at
  // /api/v1/docs-json. The two bearer schemes mirror the two JWT
  // audiences: `staff` (JWT_ACCESS_SECRET) and `customer`
  // (JWT_CUSTOMER_ACCESS_SECRET) — see .env.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Morise MBMS API')
    .setDescription(
      'Morise Holdings Limited Business Management System — Phase 1 API. ' +
        'Base path /api/v1. Staff endpoints take a `staff` bearer token from ' +
        'POST /identity/auth/login; Customer Storefront endpoints take a ' +
        '`customer` bearer token from POST /customer-portal/auth/login.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'staff',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'customer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`MBMS backend listening on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`MBMS API docs (Swagger UI) on http://localhost:${port}/api/v1/docs`);
}

bootstrap();
