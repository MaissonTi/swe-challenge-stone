import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../infra/auth/public.decorator';
import { TraceRoot } from '../../../observability/trace-root.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok' } } })
  @Public()
  @Get()
  @TraceRoot()
  async check(): Promise<{ status: 'ok' }> {
    return { status: 'ok' };
  }
}
