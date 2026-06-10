import { ref } from "vue";
import type ExcelJS from "exceljs";

export type ImportFormat = "json" | "csv" | "excel";

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

export interface ImportOptions {
  format: ImportFormat;
  validateRow?: (row: Record<string, unknown>) => boolean;
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown>;
  requiredFields?: string[];
}

export function useImport<T = Record<string, unknown>>() {
  const importing = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  async function importFromFile(
    file: File,
    options: ImportOptions,
  ): Promise<ImportResult<T>> {
    importing.value = true;
    progress.value = 0;
    error.value = null;

    try {
      let result: ImportResult<T>;

      if (options.format === "excel") {
        const buffer = await readFileAsArrayBuffer(file);
        progress.value = 30;
        result = await parseExcel(buffer, options);
      } else {
        const content = await readFile(file);
        progress.value = 30;

        switch (options.format) {
          case "json":
            result = parseJson(content, options);
            break;
          case "csv":
            result = parseCsv(content, options);
            break;
          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }
      }

      progress.value = 100;
      return result;
    } catch (e) {
      error.value = (e as Error).message;
      return {
        success: false,
        data: [],
        errors: [(e as Error).message],
        totalRows: 0,
        validRows: 0,
      };
    } finally {
      importing.value = false;
    }
  }

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }

  async function parseExcel(
    buffer: ArrayBuffer,
    options: ImportOptions,
  ): Promise<ImportResult<T>> {
    const errors: string[] = [];
    const { default: ExcelJSLib } = await import("exceljs");
    const workbook = new ExcelJSLib.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        success: false,
        data: [],
        errors: ["No worksheets found in file"],
        totalRows: 0,
        validRows: 0,
      };
    }

    const rows = worksheet.getSheetValues() as (ExcelJS.CellValue[] | null)[];
    // ExcelJS getSheetValues returns 1-indexed array; first non-null row is headers
    const nonNull = rows.filter(
      (r): r is ExcelJS.CellValue[] => r !== null && r !== undefined,
    );
    if (nonNull.length === 0) {
      return {
        success: false,
        data: [],
        errors: ["Empty worksheet"],
        totalRows: 0,
        validRows: 0,
      };
    }

    const headerRow = nonNull[0].slice(1); // slice(1) removes the leading undefined from 1-indexed rows
    const headers = headerRow.map((h) =>
      String(h ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_"),
    );

    if (options.requiredFields) {
      const missingFields = options.requiredFields.filter(
        (f) => !headers.includes(f.toLowerCase()),
      );
      if (missingFields.length > 0) {
        return {
          success: false,
          data: [],
          errors: [`Missing required columns: ${missingFields.join(", ")}`],
          totalRows: nonNull.length - 1,
          validRows: 0,
        };
      }
    }

    const validData: T[] = [];
    for (let i = 1; i < nonNull.length; i++) {
      const rowValues = nonNull[i].slice(1);
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        const cell = rowValues[idx];
        record[header] =
          cell !== null && cell !== undefined ? String(cell) : "";
      });

      if (options.validateRow && !options.validateRow(record)) {
        errors.push(`Row ${i + 1}: Validation failed`);
        continue;
      }

      const transformed = options.transformRow
        ? options.transformRow(record)
        : record;
      validData.push(transformed as T);
    }

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      totalRows: nonNull.length - 1,
      validRows: validData.length,
    };
  }

  function parseJson(content: string, options: ImportOptions): ImportResult<T> {
    const errors: string[] = [];
    let parsed: unknown[];

    try {
      parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }
    } catch {
      return {
        success: false,
        data: [],
        errors: ["Invalid JSON format"],
        totalRows: 0,
        validRows: 0,
      };
    }

    const validData: T[] = [];

    parsed.forEach((row, index) => {
      if (typeof row !== "object" || row === null) {
        errors.push(`Row ${index + 1}: Invalid data format`);
        return;
      }

      const record = row as Record<string, unknown>;

      // Check required fields
      if (options.requiredFields) {
        const missingFields = options.requiredFields.filter(
          (f) => !(f in record),
        );
        if (missingFields.length > 0) {
          errors.push(
            `Row ${index + 1}: Missing required fields: ${missingFields.join(", ")}`,
          );
          return;
        }
      }

      // Validate row
      if (options.validateRow && !options.validateRow(record)) {
        errors.push(`Row ${index + 1}: Validation failed`);
        return;
      }

      // Transform row
      const transformed = options.transformRow
        ? options.transformRow(record)
        : record;
      validData.push(transformed as T);
    });

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      totalRows: parsed.length,
      validRows: validData.length,
    };
  }

  function parseCsv(content: string, options: ImportOptions): ImportResult<T> {
    const errors: string[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      return {
        success: false,
        data: [],
        errors: ["Empty file"],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Parse header
    const headers = parseCsvLine(lines[0]);
    const validData: T[] = [];

    // Check required fields in headers
    if (options.requiredFields) {
      const normalizedHeaders = headers.map((h) =>
        h.toLowerCase().replace(/\s+/g, "_"),
      );
      const missingFields = options.requiredFields.filter(
        (f) => !normalizedHeaders.includes(f.toLowerCase()),
      );
      if (missingFields.length > 0) {
        return {
          success: false,
          data: [],
          errors: [`Missing required columns: ${missingFields.join(", ")}`],
          totalRows: lines.length - 1,
          validRows: 0,
        };
      }
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const record: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, "_");
        record[key] = values[index] || "";
      });

      // Validate row
      if (options.validateRow && !options.validateRow(record)) {
        errors.push(`Row ${i}: Validation failed`);
        continue;
      }

      // Transform row
      const transformed = options.transformRow
        ? options.transformRow(record)
        : record;
      validData.push(transformed as T);
    }

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      totalRows: lines.length - 1,
      validRows: validData.length,
    };
  }

  function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  return {
    importing,
    progress,
    error,
    importFromFile,
  };
}
