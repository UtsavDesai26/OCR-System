import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import { AppendToSheet } from './interfaces/append-sheet.interface';
import { ProcessSheetResponse } from './interfaces/process-sheet-response.interface';
import { FolderMapping } from './config/folder-mapping';

@Injectable()
export class GoogleSheetsService {
  private readonly sheets: sheets_v4.Sheets;

  constructor() {
    const credentials = this.loadCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Appends data to a specified workbook sheet
   */
  async appendDataToWorkbookSheet(
    dto: AppendToSheet,
    sheetId: string,
    workbookName: string,
  ): Promise<ProcessSheetResponse> {
    const { imageData } = dto;

    if (!Array.isArray(imageData) || !imageData.length) {
      throw new HttpException(
        'Invalid imageData: must be a non-empty array',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Map data to values
      const values = this.mapDataToValues(imageData);

      // Append to the specific workbook sheet
      await this.appendDataToSheet(sheetId, workbookName, values);

      return {
        statusCode: HttpStatus.OK,
        message: `Data successfully appended to workbook sheet: ${workbookName}`,
      };
    } catch (error) {
      throw new HttpException(
        `Error appending data to workbook sheet '${workbookName}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Appends data to a specific workbook sheet
   */
  private async appendDataToSheet(
    sheetId: string,
    sheetName: string,
    values: any[][],
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      throw new HttpException(
        `Failed to append data to workbook sheet '${sheetName}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Maps data to values
   */
  private mapDataToValues(data: Record<string, any>[]): any[][] {
    return data.map((row) => Object.values(row));
  }

  /**
   * Load Google API credentials
   */
  private loadCredentials(): any {
    try {
      const credentialsPath = './zaver-app-production-66642ceddc7b.json';
      return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    } catch (error) {
      throw new Error(
        'Unable to load Google API credentials: ' + error.message,
      );
    }
  }
}
