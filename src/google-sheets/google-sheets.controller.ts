import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { AppendToSheet } from './interfaces/append-sheet.interface';

@Controller('google-sheets')
export class GoogleSheetsController {
  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  @Post('append-to-sheet')
  async appendToSheet(@Body() body: AppendToSheet) {
    try {
      return await this.googleSheetsService.processSheetData(body);
    } catch (error) {
      console.error('Error handling the request:', error.message);
      throw new HttpException(
        'An error occurred while processing the request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
