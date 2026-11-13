/**
 * Holds the PDF shown by <app-report-viewer>. Copied from astra-app
 * (core/report-data.ts) so reports render the same way:
 *
 *   reportData: ReportData = new ReportData();
 *   const response = await this.service.printXxx();
 *   if (response.success) { this.reportData.showPdfReport('Contract Note', response.data); }
 *
 *   <app-report-viewer [reportData]="reportData"></app-report-viewer>
 */
export class ReportData {
  reportTitle = 'Report Viewer';
  showReportViewer: boolean = false;
  pdfReportData: any;
  base64Data = true;

  reportDataObject: any;

  public showPdfReport(reportTitle: any, data: any) {
    if (reportTitle) {
      this.reportTitle = reportTitle;
    }

    this.pdfReportData = `data:application/pdf;base64,${data}`;

    this.showReportViewer = true;
    this.base64Data = true;
  }

  public showPdfReportPdfSteam(reportTitle: any, response: any) {
    if (reportTitle) {
      this.reportTitle = reportTitle;
    }

    const pdfBlob = new Blob([response], { type: 'application/pdf' });
    this.pdfReportData = URL.createObjectURL(pdfBlob);

    this.showReportViewer = true;
    this.base64Data = false;
  }
}
