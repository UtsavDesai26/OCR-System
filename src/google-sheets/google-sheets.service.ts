import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import { AppendToSheet } from './interfaces/append-sheet.interface';
import { ProcessSheetResponse } from './interfaces/process-sheet-response.interface';
import { FolderMapping } from './config/folder-mapping';

@Injectable()
export class GoogleSheetsService {
  private readonly sheets: sheets_v4.Sheets;
  private readonly drive: drive_v3.Drive;

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
    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Process data to append to the Google Sheet
   */
  async processSheetData(
    dto: AppendToSheet,
    folderType: keyof typeof FolderMapping,
  ): Promise<ProcessSheetResponse> {
    const { username, imageType, imageData } = dto;

    if (
      !username ||
      !imageType ||
      !Array.isArray(imageData) ||
      !imageData.length
    ) {
      throw new HttpException(
        'Missing or invalid required fields',
        HttpStatus.BAD_REQUEST,
      );
    }

    const folderId = FolderMapping[folderType];
    if (!folderId) {
      throw new HttpException(
        `Invalid folder type: ${folderType}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const spreadsheetTitle = `${username.toUpperCase()}_MainSheet`;
      const spreadsheetId = await this.findOrCreateSpreadsheet(
        spreadsheetTitle,
        folderId,
      );

      const existingSheetNames = await this.getSheetNames(spreadsheetId);

      if (!existingSheetNames.includes(imageType)) {
        await this.createSheet(spreadsheetId, imageType);
        const headers = this.extractHeaders(imageData);
        await this.appendDataToSheet(spreadsheetId, imageType, [headers]);
      }

      const values = this.mapDataToValues(imageData);
      await this.appendDataToSheet(spreadsheetId, imageType, values);

      return {
        statusCode: HttpStatus.OK,
        message: 'Data successfully appended to the sheet',
      };
    } catch (error) {
      throw new HttpException(
        `Error processing sheet data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Loads and parses the Google API credentials.
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

  /**
   * Find or create a spreadsheet by title in the given folder
   */
  private async findOrCreateSpreadsheet(
    title: string,
    folderId: string,
  ): Promise<string> {
    try {
      const existingFile = await this.searchForSpreadsheet(title, folderId);
      if (existingFile) return existingFile.id;
      return this.createSpreadsheet(title, folderId);
    } catch (error) {
      console.log('error', error);
      throw new HttpException(
        `Error finding or creating spreadsheet: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for a spreadsheet by title
   */
  private async searchForSpreadsheet(
    title: string,
    folderId: string,
  ): Promise<drive_v3.Schema$File | undefined> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet'`,
        fields: 'files(id, name)',
      });
      return response.data.files?.[0];
    } catch (error) {
      throw new HttpException(
        `Failed to search for spreadsheet '${title}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new spreadsheet in the given folder
   */
  private async createSpreadsheet(
    title: string,
    folderId: string,
  ): Promise<string> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId],
        },
        fields: 'id',
      });

      return response.data.id;
    } catch (error) {
      throw new HttpException(
        `Failed to create spreadsheet '${title}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sheet names in a spreadsheet
   */
  private async getSheetNames(spreadsheetId: string): Promise<string[]> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });

      return (
        response.data.sheets?.map((sheet) => sheet.properties?.title) || []
      );
    } catch (error) {
      throw new HttpException(
        `Failed to get sheet names: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Creates a new sheet in a spreadsheet.
   */
  private async createSheet(
    spreadsheetId: string,
    sheetTitle: string,
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetTitle },
              },
            },
          ],
        },
      });
    } catch (error) {
      throw new HttpException(
        `Failed to create sheet '${sheetTitle}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Appends data to a sheet in a spreadsheet.
   */
  private async appendDataToSheet(
    spreadsheetId: string,
    sheetName: string,
    values: any[],
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      throw new HttpException(
        `Failed to append data to sheet '${sheetName}': ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Extracts the headers from the data.
   */
  private extractHeaders(data: Record<string, any>[]): string[] {
    try {
      return Object.keys(data[0]);
    } catch (error) {
      throw new HttpException(
        'Failed to extract headers from the data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Maps data to values.
   */
  private mapDataToValues(data: Record<string, any>[]): any[][] {
    try {
      return data.map((row) => Object.values(row));
    } catch (error) {
      throw new HttpException(
        'Failed to map data to values',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
