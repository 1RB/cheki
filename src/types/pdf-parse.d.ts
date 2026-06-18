declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    total_pages?: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
