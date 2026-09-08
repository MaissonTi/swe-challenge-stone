import { Module } from '@nestjs/common';
import { EnvModule } from './infra/env/env.module';
import { PresentationModule } from './presentation/presentation.module';

@Module({
  imports: [EnvModule, PresentationModule],
})
export class AppModule {}
