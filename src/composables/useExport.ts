import { ref } from "vue";

export type ExportFormat = "json" | "csv" | "xml";

export interface ExportOptions {
  filename: string;
  format: ExportFormat;
  fields?: string[];
  includeHeaders?: boolean;
}

export function useExport() {
  const exporting = ref(false);
  const error = ref<string | null>(null);

  function exportToJson<T>(data: T[], filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    downloadFile(jsonString, `${filename}.json`, "application/json");
  }

  function exportToCsv<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    fields?: string[],
    includeHeaders = true,
  ): void {
    if (data.length === 0) {
      error.value = "No data to export";
      return;
    }

    const keys = fields || Object.keys(data[0]);
    const rows: string[] = [];

    if (includeHeaders) {
      rows.push(keys.map(formatCsvHeader).join(","));
    }

    data.forEach((item) => {
      const values = keys.map((key) => {
        const value = item[key];
        return formatCsvValue(value);
      });
      rows.push(values.join(","));
    });

    const csvString = rows.join("\n");
    downloadFile(csvString, `${filename}.csv`, "text/csv");
  }

  function exportToXml<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    rootElement = "items",
    itemElement = "item",
  ): void {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${rootElement}>\n`;

    data.forEach((item) => {
      xml += `  <${itemElement}>\n`;
      Object.entries(item).forEach(([key, value]) => {
        const safeValue = escapeXml(String(value ?? ""));
        xml += `    <${key}>${safeValue}</${key}>\n`;
      });
      xml += `  </${itemElement}>\n`;
    });

    xml += `</${rootElement}>`;
    downloadFile(xml, `${filename}.xml`, "application/xml");
  }

  async function exportData<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions,
  ): Promise<boolean> {
    exporting.value = true;
    error.value = null;

    try {
      switch (options.format) {
        case "json":
          exportToJson(data, options.filename);
          break;
        case "csv":
          exportToCsv(
            data,
            options.filename,
            options.fields,
            options.includeHeaders,
          );
          break;
        case "xml":
          exportToXml(data, options.filename);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
      return true;
    } catch (e) {
      error.value = (e as Error).message;
      return false;
    } finally {
      exporting.value = false;
    }
  }

  function downloadFile(
    content: string,
    filename: string,
    mimeType: string,
  ): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function formatCsvHeader(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  function formatCsvValue(value: unknown): string {
    if (value == null) return "";
    const stringValue = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  return {
    exporting,
    error,
    exportData,
    exportToJson,
    exportToCsv,
    exportToXml,
  };
}
