import { Module } from '@nestjs/common';
import { UseCasesModule } from '../app/usecases/usecases.module';
import { AuthController } from './http/controllers/auth.controller';
import { HealthController } from './http/controllers/health.controller';
import { ProductsController } from './http/controllers/products.controller';

@Module({
  imports: [UseCasesModule],
  controllers: [HealthController, AuthController, ProductsController],
})
export class PresentationModule {}
