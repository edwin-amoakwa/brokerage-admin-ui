import { Injectable } from '@angular/core';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const EXCEL_EXTENSION = '.xlsx';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  constructor() { }

  public static removeIdFields(data: any[]): any[] {
    return data.map(item => {
      const cleanedItem: any = {};

      for (const key in item) {
        if (!(key === 'id' || key.endsWith('Id'))) {
          cleanedItem[key] = item[key];
        }
      }

      return cleanedItem;
    });
  }

  public static removeIdFieldsInPlace(data: any[]): void {
    data.forEach(item => {
      for (const key in item) {
        if (key === 'id' || key.endsWith('Id')) {
          delete item[key];
        }
      }
    });
  }

  public static exportAsExcelFile(json: any[], excelFileName: string): void
  {

    let finalExport:any[] = [];

    json.forEach(item => {
      let rec:any = {};
      Object.keys(item).forEach((objectKey) => {
        const keyAsTitleCase = objectKey.replace(/([A-Z])/g, " $1");
        const keyAsTitleCaseCapitalised = keyAsTitleCase.charAt(0).toUpperCase() + keyAsTitleCase.slice(1);
        rec[keyAsTitleCaseCapitalised] = item[objectKey];
      });
      finalExport.push(rec);
      // //console.log(rec);
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(finalExport);

    // console.table('worksheet',worksheet);

    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, excelFileName);
  }


  /**
   * Writes the headers exactly as given (no title-casing) over rows of cells,
   * for files that must be read back by an upload parser.
   */
  public static exportRowsAsExcelFile(headers: string[], rows: any[][], excelFileName: string): void
  {
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, excelFileName);
  }

  public static exportAsExcelFileSkipHeading(json: any[], excelFileName: string): void
  {

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(json,{ skipHeader: true });


    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, excelFileName);
  }

  /**
   * Generates and downloads an Excel template
   * @param headers Array of strings for column headers
   * @param fileName Desired name of the file
   */
  public static generateExcelTemplate(headers: string[], fileName: string = 'Template'): void {
    // 1. Create a worksheet from an array of arrays (the first array is our header row)
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers]);

    // 2. Create a new Workbook
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();

    // 3. Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // 4. Generate the binary data and trigger download
    // Use bookType: 'biff8' for .xls (Excel 97-2003)
    // Use bookType: 'xlsx' for modern .xlsx
    XLSX.writeFile(workbook, `${fileName}.xls`, { bookType: 'biff8', type: 'binary' });
  }

  private static saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], {
      type: EXCEL_TYPE
    });
    FileSaver.saveAs(data, fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION);
  }


  private static save(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], {
    });
    // data.b
    FileSaver.saveAs(data, fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION);
  }
}
