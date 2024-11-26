import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import { AppendToSheet } from './interfaces/append-sheet.interface';
import { ProcessSheetResponse } from './interfaces/process-sheet-response.interface';

@Injectable()
export class GoogleSheetsService {
  private readonly sheets: sheets_v4.Sheets;
  private readonly drive: drive_v3.Drive;
  private readonly BASE_FOLDER_ID = process.env.BASE_FOLDER_ID;

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
   * Processes data for the Google Sheet: creates or retrieves the sheet and appends data.
   */
  async processSheetData(dto: AppendToSheet): Promise<ProcessSheetResponse> {
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

    try {
      const spreadsheetTitle = `${username.toUpperCase()}_MainSheet`;
      const spreadsheetId =
        await this.findOrCreateSpreadsheet(spreadsheetTitle);

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
   * Retrieves or creates a new spreadsheet by title.
   */
  private async findOrCreateSpreadsheet(title: string): Promise<string> {
    const existingFile = await this.searchForSpreadsheet(title);

    if (existingFile) return existingFile.id;

    return this.createSpreadsheet(title);
  }

  /**
   * Searches for an existing spreadsheet by title.
   */
  private async searchForSpreadsheet(
    title: string,
  ): Promise<drive_v3.Schema$File | undefined> {
    const response = await this.drive.files.list({
      q: `'${this.BASE_FOLDER_ID}' in parents and name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet'`,
      fields: 'files(id, name)',
    });

    return response.data.files?.[0];
  }

  /**
   * Creates a new spreadsheet with the specified title.
   */
  private async createSpreadsheet(title: string): Promise<string> {
    const response = await this.drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [this.BASE_FOLDER_ID],
      },
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Failed to create spreadsheet');
    }

    return response.data.id;
  }

  /**
   * Retrieves the names of all sheets in a spreadsheet.
   */
  private async getSheetNames(spreadsheetId: string): Promise<string[]> {
    const response = await this.sheets.spreadsheets.get({ spreadsheetId });
    return response.data.sheets.map((sheet) => sheet.properties?.title || '');
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
  private extractHeaders(data: any[]): string[] {
    return Object.keys(data[0]);
  }

  /**
   * Maps data to values.
   */
  private mapDataToValues(data: any[]): any[] {
    return data.map((item) => Object.values(item));
  }
}
