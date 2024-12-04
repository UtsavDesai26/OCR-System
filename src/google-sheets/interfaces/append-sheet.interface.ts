export interface AppendToSheet {
  imageType: string; // Maps to the workbook sheet
  imageData: Array<Record<string, any>>;
}
