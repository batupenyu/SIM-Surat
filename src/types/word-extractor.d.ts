declare module 'word-extractor' {
  class ExtractedDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFooters(): string;
    getTextboxes(options?: { includeHeadersAndFooters?: boolean }): string;
  }

  export default class WordExtractor {
    extract(filePathOrBuffer: string | Buffer): Promise<ExtractedDocument>;
  }
}
