/**
 * Type declarations for the `igv` npm package.
 *
 * IGV.js does not ship its own @types package.  This shim covers the subset
 * of the API used by GenomeBrowser.tsx — extend as needed.
 *
 * Reference: https://github.com/igvteam/igv.js/wiki/Browser-creation
 */
declare module "igv" {
  export interface ReferenceOptions {
    /** Assembly identifier shown in the UI, e.g. "hg38" or a custom label. */
    id?: string;
    /** URL to a raw FASTA file (text/plain). */
    fastaURL: string;
    /**
     * URL to a FASTA index (.fai).
     * Optional — IGV can build a simple index in-memory for small sequences.
     */
    indexURL?: string;
    /** When true IGV generates an in-memory index (no .fai file needed). */
    indexed?: boolean;
  }

  export interface TrackOptions {
    /** Track type, e.g. "annotation", "wig", "alignment". */
    type?: string;
    /** File format hint, e.g. "gtf", "gff3", "bed". */
    format?: string;
    /** URL to the track data file. */
    url?: string;
    /** Display name shown in the track header. */
    name?: string;
    /** Track height in pixels. */
    height?: number;
    /** Allow additional arbitrary options IGV supports. */
    [key: string]: unknown;
  }

  export interface BrowserOptions {
    /**
     * Short-hand genome string for built-in references, e.g. "hg38", "mm10".
     * Mutually exclusive with `reference`.
     */
    genome?: string;
    /** Custom reference genome configuration. */
    reference?: ReferenceOptions;
    /** Initial locus string, e.g. "chr5:1,000,000-1,050,000". */
    locus?: string;
    /** Initial track list. */
    tracks?: TrackOptions[];
    /** Show chromosome ideogram at the top. */
    showIdeogram?: boolean;
    /** Show chromosome navigation controls. */
    showNavigation?: boolean;
    /** Show ruler track. */
    showRuler?: boolean;
    /** Allow additional arbitrary options IGV supports. */
    [key: string]: unknown;
  }

  export interface Browser {
    /** Remove all non-reference tracks from the browser. */
    removeAllTracks(): void;
    /**
     * Destroy the browser instance and release DOM resources.
     * Available in IGV.js ≥ 2.12.0 — call if present to avoid memory leaks.
     */
    dispose?(): void;
    /** Navigate to a locus string. */
    search(locus: string): Promise<void>;
  }

  /**
   * Create an IGV browser in the given DOM container.
   *
   * @param container - The HTMLElement that will host the browser.
   * @param options   - Browser configuration options.
   * @returns Promise that resolves to the Browser instance once initialised.
   */
  export function createBrowser(
    container: HTMLElement,
    options: BrowserOptions
  ): Promise<Browser>;
}
