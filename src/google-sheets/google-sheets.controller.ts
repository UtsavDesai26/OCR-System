import {
  Controller,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { AppendToSheet } from './interfaces/append-sheet.interface';
import { FolderMapping } from './config/folder-mapping';

@Controller('google-sheets')
export class GoogleSheetsController {
  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  @Post('append-to-sheet')
  async appendToSheet(@Body() body: AppendToSheet) {
    try {
      const { imageType } = body;

      // Determine which Google Sheet to use
      const sheetId =
        imageType === 'Farmer'
          ? FolderMapping.farmCollectorSheet
          : FolderMapping.payslipCollectorSheet;

      if (!sheetId) {
        throw new HttpException(
          'Invalid sheet configuration in FolderMapping',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.googleSheetsService.appendDataToWorkbookSheet(
        body,
        sheetId,
        imageType,
      );
    } catch (error) {
      console.error('Error handling the request:', error.message);
      throw new HttpException(
        'An error occurred while processing the request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
