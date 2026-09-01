import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { success: true, data: { status: 'ok', service: 'sports-erp-api' } };
  }
}
