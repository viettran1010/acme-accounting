import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { ReportsService } from './reports/reports.service';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [DbModule, TicketsModule],
  controllers: [ReportsController, HealthcheckController],
  providers: [ReportsService],
})
export class AppModule {}
