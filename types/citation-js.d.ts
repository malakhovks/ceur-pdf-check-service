declare module "@citation-js/core" {
  export class Cite {
    data: unknown[];
    constructor(data?: unknown);
    format(format: string, options?: Record<string, unknown>): string;
  }
}

declare module "@citation-js/plugin-bibtex";
declare module "@citation-js/plugin-csl";
