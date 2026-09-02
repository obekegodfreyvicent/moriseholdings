import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
