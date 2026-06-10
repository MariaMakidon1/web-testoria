import { ref } from "vue";
import type { Worksheet } from "exceljs";
import type { TestCase, TestStep } from "@/types/testCase";
import type { TestResult } from "@/types/testResult";
import type { Project } from "@/types/project";
import type { TestRun } from "@/types/testRun";

export interface ExcelExportData {
  project: Project;
  testRun?: TestRun;
  testCases: TestCase[];
  testResults: TestResult[];
}

export interface ExcelExportOptions {
  includeSteps?: boolean;
  includeComments?: boolean;
  includeMetadata?: boolean;
}

const defaultOptions: ExcelExportOptions = {
  includeSteps: true,
  includeComments: true,
  includeMetadata: true,
};

export function useExcelExport() {
  const exporting = ref(false);
  const error = ref<string | null>(null);

  // Status colors for Excel
  const statusColors: Record<string, string> = {
    passed: "22C55E",
    failed: "EF4444",
    blocked: "4B5563",
    no_run: "9CA3AF",
  };

  // Priority colors
  const priorityColors: Record<string, string> = {
    Critical: "DC2626",
    High: "F97316",
    Medium: "EAB308",
    Low: "22C55E",
  };

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function stripHtml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  async function exportToExcel(
    data: ExcelExportData,
    options: ExcelExportOptions = {},
  ): Promise<void> {
    const opts = { ...defaultOptions, ...options };
    exporting.value = true;
    error.value = null;

    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver"),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Testoria";
      workbook.created = new Date();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet("Summary", {
        properties: { tabColor: { argb: "667EEA" } },
      });
      addSummarySheet(summarySheet, data);

      // Test Cases Sheet
      const testCasesSheet = workbook.addWorksheet("Test Cases", {
        properties: { tabColor: { argb: "3B82F6" } },
      });
      addTestCasesSheet(testCasesSheet, data, opts);

      // Test Steps Sheet (if included)
      if (opts.includeSteps) {
        const stepsSheet = workbook.addWorksheet("Test Steps", {
          properties: { tabColor: { argb: "8B5CF6" } },
        });
        addTestStepsSheet(stepsSheet, data);
      }

      // Test Results Sheet
      const resultsSheet = workbook.addWorksheet("Test Results", {
        properties: { tabColor: { argb: "22C55E" } },
      });
      addTestResultsSheet(resultsSheet, data, opts);

      // Screenshots sheet — embed up to 3 images per result.
      await addScreenshotsSheet(workbook, data);

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `test-report-${data.project.name}-${new Date().toISOString().split("T")[0]}.xlsx`;
      saveAs(blob, filename);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to generate Excel";
      throw err;
    } finally {
      exporting.value = false;
    }
  }

  function addSummarySheet(sheet: Worksheet, data: ExcelExportData): void {
    // Title
    sheet.mergeCells("A1:D1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "Test Report Summary";
    titleCell.font = { size: 18, bold: true, color: { argb: "667EEA" } };
    titleCell.alignment = { horizontal: "center" };

    // Project info
    sheet.getCell("A3").value = "Project:";
    sheet.getCell("B3").value = data.project.name;
    sheet.getCell("A3").font = { bold: true };

    sheet.getCell("A4").value = "Project:";
    sheet.getCell("B4").value = data.project.name;
    sheet.getCell("A4").font = { bold: true };

    sheet.getCell("A5").value = "Generated:";
    sheet.getCell("B5").value = formatDate(new Date().toISOString());
    sheet.getCell("A5").font = { bold: true };

    if (data.testRun) {
      sheet.getCell("A6").value = "Test Run:";
      sheet.getCell("B6").value = data.testRun.name;
      sheet.getCell("A6").font = { bold: true };
      sheet.mergeCells("B6:D6");
      sheet.getCell("B6").alignment = { wrapText: true, vertical: "top" };
      sheet.getRow(6).height = Math.max(
        20,
        Math.ceil(data.testRun.name.length / 60) * 15,
      );

      sheet.getCell("A7").value = "Status:";
      sheet.getCell("B7").value = data.testRun.status;
      sheet.getCell("A7").font = { bold: true };
      sheet.mergeCells("B7:D7");
      sheet.getCell("B7").alignment = { wrapText: true, vertical: "top" };
    }

    // Statistics
    const startRow = data.testRun ? 9 : 7;
    sheet.getCell(`A${startRow}`).value = "Statistics";
    sheet.getCell(`A${startRow}`).font = { size: 14, bold: true };

    const total = data.testResults.length || data.testCases.length;
    const passed = data.testResults.filter((r) => r.status === "passed").length;
    const failed = data.testResults.filter((r) => r.status === "failed").length;
    const blocked = data.testResults.filter(
      (r) => r.status === "blocked",
    ).length;
    const noRun = data.testResults.filter(
      (r) => r.status === "no_run",
    ).length;
    // Store as ratio so the cell is sortable and locale-aware via numFmt;
    // the threshold compares a 0..100 percent for readability (plan-083).
    const passRateRatio = total > 0 ? passed / total : 0;
    const passRatePercent = passRateRatio * 100;

    const stats: Array<[string, number | string]> = [
      ["Total Test Cases", data.testCases.length],
      ["Total Results", total],
      ["Passed", passed],
      ["Failed", failed],
      ["Blocked", blocked],
      ["No Run", noRun],
      ["Pass Rate", passRateRatio],
    ];

    stats.forEach((stat, index) => {
      const row = startRow + 1 + index;
      sheet.getCell(`A${row}`).value = stat[0];
      sheet.getCell(`B${row}`).value = stat[1];
      sheet.getCell(`A${row}`).font = { bold: true };

      // Color code pass rate
      if (stat[0] === "Pass Rate") {
        sheet.getCell(`B${row}`).numFmt = "0.0%";
        sheet.getCell(`B${row}`).font = {
          bold: true,
          color: {
            argb:
              passRatePercent >= 80
                ? "22C55E"
                : passRatePercent >= 60
                  ? "F59E0B"
                  : "EF4444",
          },
        };
      }
    });

    // Column widths
    sheet.getColumn("A").width = 20;
    sheet.getColumn("B").width = 30;
  }

  function addTestCasesSheet(
    sheet: Worksheet,
    data: ExcelExportData,
    _opts: ExcelExportOptions,
  ): void {
    // Headers
    const headers = [
      "ID",
      "Title",
      "Priority",
      "Type",
      "Case Status",
      "Result Status",
      "Description",
    ];
    const headerRow = sheet.addRow(headers);

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "667EEA" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Data rows
    data.testCases.forEach((tc, index) => {
      const result = data.testResults.find((r) => r.test_case_id === tc.id);
      const status = result?.status || "No Result";

      const row = sheet.addRow([
        tc.id,
        tc.title,
        tc.priority,
        tc.type,
        tc.status || "active",
        status,
        tc.description ? stripHtml(tc.description) : "",
      ]);

      // Alternate row colors
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F3F4F6" },
          };
        });
      }

      // Color code priority
      const priorityCell = row.getCell(3);
      priorityCell.font = {
        bold: true,
        color: { argb: priorityColors[tc.priority] || "000000" },
      };

      // Color code status
      const statusCell = row.getCell(6);
      statusCell.font = {
        bold: true,
        color: { argb: statusColors[status] || "000000" },
      };

      // Borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "E5E7EB" } },
          left: { style: "thin", color: { argb: "E5E7EB" } },
          bottom: { style: "thin", color: { argb: "E5E7EB" } },
          right: { style: "thin", color: { argb: "E5E7EB" } },
        };
      });
    });

    // Column widths
    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 50;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 12;
    sheet.getColumn(7).width = 50;

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  function addTestStepsSheet(sheet: Worksheet, data: ExcelExportData): void {
    // Headers
    const headers = [
      "Test Case ID",
      "Test Case Title",
      "Step #",
      "Action",
      "Expected Result",
    ];
    const headerRow = sheet.addRow(headers);

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "8B5CF6" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Data rows. ID and title are written only on the first step of each
    // case so a case with multiple steps reads as a grouped block instead
    // of repeating the same identifier on every row. Row banding alternates
    // per test case so the empty ID/title cells stay visually attached to
    // their owner.
    data.testCases.forEach((tc, tcIndex) => {
      tc.steps.forEach((step: TestStep, stepIndex: number) => {
        const isFirstStep = stepIndex === 0;
        const row = sheet.addRow([
          isFirstStep ? tc.id : "",
          isFirstStep ? tc.title : "",
          stepIndex + 1,
          stripHtml(step.step),
          stripHtml(step.expected),
        ]);

        if (tcIndex % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F3F4F6" },
            };
          });
        }

        // Borders
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "E5E7EB" } },
            left: { style: "thin", color: { argb: "E5E7EB" } },
            bottom: { style: "thin", color: { argb: "E5E7EB" } },
            right: { style: "thin", color: { argb: "E5E7EB" } },
          };
          cell.alignment = { wrapText: true, vertical: "top" };
        });
      });
    });

    // Column widths
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 8;
    sheet.getColumn(4).width = 50;
    sheet.getColumn(5).width = 50;

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
    return await resp.arrayBuffer();
  }

  async function addScreenshotsSheet(
    workbook: import("exceljs").Workbook,
    data: ExcelExportData,
  ): Promise<void> {
    const withImages = data.testResults.filter(
      (r) => (r.attachments ?? []).some((a) => a.mime_type?.startsWith("image/")),
    );
    if (withImages.length === 0) return;

    const sheet = workbook.addWorksheet("Screenshots", {
      properties: { tabColor: { argb: "F59E0B" } },
    });
    sheet.getColumn("A").width = 30;
    sheet.getColumn("B").width = 80;
    let row = 1;
    for (const result of withImages) {
      const testCase = data.testCases.find((tc) => tc.id === result.test_case_id);
      const header = sheet.getCell(`A${row}`);
      header.value = "Case";
      header.font = { bold: true };
      sheet.getCell(`B${row}`).value =
        `${testCase?.title || "Case"} (id=${result.test_case_id})`;
      row += 1;

      const images = (result.attachments ?? [])
        .filter((a) => a.mime_type?.startsWith("image/"))
        .slice(0, 3);
      for (const att of images) {
        if (!att.url) {
          sheet.getCell(`B${row}`).value = `[${att.filename} — no url]`;
          row += 1;
          continue;
        }
        try {
          const buffer = await fetchAsArrayBuffer(att.url);
          const ext = (att.mime_type || "image/png").split("/")[1];
          const extension = (
            ext === "jpeg" || ext === "jpg" || ext === "png" || ext === "gif"
              ? ext
              : "png"
          ) as "png" | "jpeg" | "gif";
          const imageId = workbook.addImage({ buffer, extension });
          sheet.getRow(row).height = 155;
          sheet.addImage(imageId, {
            tl: { col: 1, row: row - 1 },
            ext: { width: 300, height: 200 },
          });
          sheet.getCell(`A${row}`).value = att.filename;
          row += 11;
        } catch {
          sheet.getCell(`B${row}`).value =
            `[${att.filename} — unavailable]`;
          row += 1;
        }
      }
      const excess =
        (result.attachments ?? []).filter((a) =>
          a.mime_type?.startsWith("image/"),
        ).length - images.length;
      if (excess > 0) {
        sheet.getCell(`B${row}`).value = `+${excess} more — open run in app`;
        row += 1;
      }
      row += 2;
    }
  }

  function addTestResultsSheet(
    sheet: Worksheet,
    data: ExcelExportData,
    _opts: ExcelExportOptions,
  ): void {
    // Headers
    const headers = [
      "Test Case ID",
      "Test Case Title",
      "Status",
      "Tested At",
      "Execution Time",
      "Comment",
    ];
    const headerRow = sheet.addRow(headers);

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "22C55E" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Data rows
    data.testCases.forEach((tc, index) => {
      const result = data.testResults.find((r) => r.test_case_id === tc.id);
      const status = result?.status || "No Result";

      const row = sheet.addRow([
        tc.id,
        tc.title,
        status,
        result?.tested_at ? formatDate(result.tested_at) : "-",
        result?.execution_time ? `${result.execution_time}s` : "-",
        result?.comment ? stripHtml(result.comment) : "",
      ]);

      // Alternate row colors
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F3F4F6" },
          };
        });
      }

      // Color code status with background
      const statusCell = row.getCell(3);
      statusCell.font = { bold: true, color: { argb: "FFFFFF" } };
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: statusColors[status] || "94A3B8" },
      };
      statusCell.alignment = { horizontal: "center" };

      // Borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "E5E7EB" } },
          left: { style: "thin", color: { argb: "E5E7EB" } },
          bottom: { style: "thin", color: { argb: "E5E7EB" } },
          right: { style: "thin", color: { argb: "E5E7EB" } },
        };
        cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
      });
    });

    // Column widths
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 45;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 50;

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  return {
    exporting,
    error,
    exportToExcel,
  };
}
