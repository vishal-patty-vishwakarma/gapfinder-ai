declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    text: string;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, any>
  ): Promise<PDFData>;

  export default pdfParse;
}
