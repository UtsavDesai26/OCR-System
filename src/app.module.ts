import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleSheetsService } from './google-sheets/google-sheets.service';
import { GoogleSheetsController } from './google-sheets/google-sheets.controller';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';

@Module({
  imports: [GoogleSheetsModule],
  controllers: [AppController, GoogleSheetsController],
  providers: [AppService, GoogleSheetsService],
})
export class AppModule {}
