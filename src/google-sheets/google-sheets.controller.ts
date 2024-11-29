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
  async appendToSheet(
    @Body() body: AppendToSheet,
    @Query('folderType') folderType: string,
  ) {
    try {
      if (!folderType) {
        throw new HttpException('Missing folder type', HttpStatus.BAD_REQUEST);
      }

      return await this.googleSheetsService.processSheetData(
        body,
        folderType as keyof typeof FolderMapping,
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
