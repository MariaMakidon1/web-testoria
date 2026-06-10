import { ref } from "vue";
import type jsPDF from "jspdf";
import type { TestCase, TestStep } from "@/types/testCase";
import type { TestResult, Attachment } from "@/types/testResult";
import type { Project } from "@/types/project";
import type { TestRun } from "@/types/testRun";
import { formatPassRate, toPercentRounded } from "@/utils/passRate";

export interface PdfExportData {
  project: Project;
  testRun?: TestRun;
  testCases: TestCase[];
  testResults: TestResult[];
}

export interface PdfExportOptions {
  includeSteps?: boolean;
  includeComments?: boolean;
  includeScreenshots?: boolean;
  includeMetadata?: boolean;
}

const defaultOptions: PdfExportOptions = {
  includeSteps: true,
  includeComments: true,
  includeScreenshots: true,
  includeMetadata: true,
};

export function usePdfExport() {
  const exporting = ref(false);
  const error = ref<string | null>(null);

  // Color definitions
  const colors = {
    primary: [102, 126, 234] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],
    danger: [239, 68, 68] as [number, number, number],
    warning: [245, 158, 11] as [number, number, number],
    info: [59, 130, 246] as [number, number, number],
    gray: [107, 114, 128] as [number, number, number],
    lightGray: [243, 244, 246] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    black: [0, 0, 0] as [number, number, number],
  };

  // Status colors
  const statusColors: Record<string, [number, number, number]> = {
    passed: colors.success,
    failed: colors.danger,
    blocked: [75, 85, 99] as [number, number, number],
    no_run: [156, 163, 175] as [number, number, number],
  };

  // Priority colors
  const priorityColors: Record<string, [number, number, number]> = {
    Critical: [220, 38, 38],
    High: [249, 115, 22],
    Medium: [234, 179, 8],
    Low: colors.success,
  };

  function getStatusColor(status: string): [number, number, number] {
    return statusColors[status] || colors.gray;
  }

  function getPriorityColor(priority: string): [number, number, number] {
    return priorityColors[priority] || colors.gray;
  }

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

  async function fetchAsDataURL(url: string): Promise<string> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function loadImageSize(
    dataUrl: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("image load failed"));
      img.src = dataUrl;
    });
  }

  // HTML → plain text with structural hints (bullets, numbering, paragraph
  // breaks). Used for step table cells where jspdf-autotable cannot carry
  // inline font styles.
  function htmlToFormattedText(html: string): string {
    if (!html) return "";
    const container = document.createElement("div");
    container.innerHTML = html;

    function walk(node: Node): string {
      let out = "";
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent || "";
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === "br") {
            out += "\n";
          } else if (tag === "p" || tag === "div") {
            if (out && !out.endsWith("\n")) out += "\n";
            out += walk(el);
            if (!out.endsWith("\n")) out += "\n";
          } else if (tag === "ul") {
            if (out && !out.endsWith("\n")) out += "\n";
            Array.from(el.children).forEach((li) => {
              out += "• " + walk(li).trim() + "\n";
            });
          } else if (tag === "ol") {
            if (out && !out.endsWith("\n")) out += "\n";
            let i = 1;
            Array.from(el.children).forEach((li) => {
              out += `${i}. ` + walk(li).trim() + "\n";
              i++;
            });
          } else if (tag === "h1" || tag === "h2" || tag === "h3") {
            if (out && !out.endsWith("\n")) out += "\n";
            out += walk(el);
            out += "\n";
          } else if (tag === "hr") {
            out += "\n———\n";
          } else {
            out += walk(el);
          }
        }
      });
      return out;
    }

    return walk(container)
      .trim()
      .replace(/\n{3,}/g, "\n\n");
  }

  // Parse HTML into block-level tokens with styled inline runs for rich
  // rendering via jsPDF. Each block is laid out on its own line(s); inline
  // bold/italic/mono spans are preserved per word.
  interface StyledWord {
    text: string;
    bold: boolean;
    italic: boolean;
  }
  interface HtmlBlock {
    prefix: string;
    words: StyledWord[];
    bottomGap: number;
  }

  function parseHtmlToBlocks(html: string): HtmlBlock[] {
    const blocks: HtmlBlock[] = [];
    if (!html) return blocks;
    const container = document.createElement("div");
    container.innerHTML = html;

    function collectInline(
      node: Node,
      bold: boolean,
      italic: boolean,
      out: StyledWord[],
    ) {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = (child.textContent || "").replace(/\s+/g, " ");
          const parts = text.split(" ").filter((w) => w.length > 0);
          for (const w of parts) out.push({ text: w, bold, italic });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === "br") return;
          const nBold = bold || tag === "strong" || tag === "b";
          const nItalic = italic || tag === "em" || tag === "i";
          collectInline(el, nBold, nItalic, out);
        }
      });
    }

    function walkBlocks(node: Node, prefix: string) {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === "p" || tag === "div") {
            const words: StyledWord[] = [];
            collectInline(el, false, false, words);
            if (words.length) blocks.push({ prefix, words, bottomGap: 2 });
          } else if (tag === "ul") {
            Array.from(el.children).forEach((li) => {
              const words: StyledWord[] = [];
              collectInline(li, false, false, words);
              if (words.length)
                blocks.push({ prefix: "• ", words, bottomGap: 1 });
            });
          } else if (tag === "ol") {
            let i = 1;
            Array.from(el.children).forEach((li) => {
              const words: StyledWord[] = [];
              collectInline(li, false, false, words);
              if (words.length)
                blocks.push({ prefix: `${i}. `, words, bottomGap: 1 });
              i++;
            });
          } else if (tag === "h1" || tag === "h2" || tag === "h3") {
            const words: StyledWord[] = [];
            collectInline(el, true, false, words);
            if (words.length) blocks.push({ prefix, words, bottomGap: 3 });
          } else if (tag === "blockquote" || tag === "pre") {
            const words: StyledWord[] = [];
            collectInline(el, false, true, words);
            if (words.length)
              blocks.push({ prefix: "  ", words, bottomGap: 2 });
          } else if (tag === "hr") {
            blocks.push({
              prefix: "———",
              words: [],
              bottomGap: 2,
            });
          } else {
            walkBlocks(el, prefix);
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = (child.textContent || "").trim();
          if (text) {
            const words: StyledWord[] = [];
            collectInline(child, false, false, words);
            if (words.length) blocks.push({ prefix, words, bottomGap: 2 });
          }
        }
      });
    }

    walkBlocks(container, "");
    return blocks;
  }

  async function exportToPdf(
    data: PdfExportData,
    options: PdfExportOptions = {},
  ): Promise<void> {
    const opts = { ...defaultOptions, ...options };
    exporting.value = true;
    error.value = null;

    try {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new JsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Helper to add new page if needed
      function checkPageBreak(requiredHeight: number): void {
        if (yPosition + requiredHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
      }

      // Render rich HTML (from Tiptap) with bold/italic/list support, wrapping
      // across lines and paginating as needed. Returns the new yPosition.
      function renderFormattedHtml(
        html: string,
        x: number,
        startY: number,
        maxWidth: number,
        fontSize: number,
      ): number {
        let curY = startY;
        let blocks: HtmlBlock[];
        try {
          blocks = parseHtmlToBlocks(html);
        } catch {
          // Fallback: plain text
          doc.setFontSize(fontSize);
          doc.setFont("helvetica", "normal");
          const lines = doc.splitTextToSize(stripHtml(html), maxWidth);
          for (const line of lines) {
            if (curY > pageHeight - margin) {
              doc.addPage();
              curY = margin;
            }
            doc.text(line, x, curY);
            curY += fontSize * 0.35 + 1;
          }
          return curY;
        }

        if (blocks.length === 0) return curY;

        doc.setFontSize(fontSize);
        const lineHeight = fontSize * 0.4 + 0.5;

        for (const block of blocks) {
          doc.setFont("helvetica", "normal");
          let lineX = x;
          if (block.prefix) {
            if (curY > pageHeight - margin) {
              doc.addPage();
              curY = margin;
            }
            doc.text(block.prefix, lineX, curY);
            lineX += doc.getTextWidth(block.prefix);
          }
          const indent = lineX - x;
          const lineStart = lineX;

          for (let i = 0; i < block.words.length; i++) {
            const word = block.words[i];
            const style =
              word.bold && word.italic
                ? "bolditalic"
                : word.bold
                  ? "bold"
                  : word.italic
                    ? "italic"
                    : "normal";
            doc.setFont("helvetica", style);
            const wordWidth = doc.getTextWidth(word.text);
            const atLineStart = lineX === lineStart;
            const spaceWidth = atLineStart ? 0 : doc.getTextWidth(" ");

            if (!atLineStart && lineX + spaceWidth + wordWidth - x > maxWidth) {
              curY += lineHeight;
              if (curY > pageHeight - margin) {
                doc.addPage();
                curY = margin;
              }
              lineX = x + indent;
              doc.text(word.text, lineX, curY);
              lineX += wordWidth;
            } else {
              if (!atLineStart) {
                doc.text(" ", lineX, curY);
                lineX += spaceWidth;
              }
              if (curY > pageHeight - margin) {
                doc.addPage();
                curY = margin;
                lineX = x + indent;
              }
              doc.text(word.text, lineX, curY);
              lineX += wordWidth;
            }
          }

          curY += lineHeight + block.bottomGap;
          doc.setFont("helvetica", "normal");
        }

        return curY;
      }

      // Add header
      function addHeader(): void {
        doc.setFillColor(...colors.primary);
        doc.rect(0, 0, pageWidth, 35, "F");

        doc.setTextColor(...colors.white);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("Test Report", margin, 20);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(data.project.name, margin, 28);

        // Date on the right
        doc.setFontSize(10);
        const dateText = formatDate(new Date().toISOString());
        const dateWidth = doc.getTextWidth(dateText);
        doc.text(dateText, pageWidth - margin - dateWidth, 28);

        yPosition = 45;
      }

      // Add summary section
      function addSummary(): void {
        doc.setTextColor(...colors.black);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Summary", margin, yPosition);
        yPosition += 8;

        // Calculate stats
        const total = data.testResults.length;
        const passed = data.testResults.filter(
          (r) => r.status === "passed",
        ).length;
        const failed = data.testResults.filter(
          (r) => r.status === "failed",
        ).length;
        const blocked = data.testResults.filter(
          (r) => r.status === "blocked",
        ).length;
        const noRun = data.testResults.filter(
          (r) => r.status === "no_run",
        ).length;
        const passRateRatio = total > 0 ? passed / total : null;
        const passRatePercent = toPercentRounded(passRateRatio) ?? 0;

        // Summary cards
        const cardWidth = (contentWidth - 15) / 4;
        const cardHeight = 20;
        const stats = [
          { label: "Total", value: total.toString(), color: colors.primary },
          { label: "Passed", value: passed.toString(), color: colors.success },
          { label: "Failed", value: failed.toString(), color: colors.danger },
          {
            label: "Pass Rate",
            value: formatPassRate(passRateRatio),
            color:
              passRatePercent >= 80
                ? colors.success
                : passRatePercent >= 60
                  ? colors.warning
                  : colors.danger,
          },
        ];

        stats.forEach((stat, index) => {
          const xPos = margin + index * (cardWidth + 5);

          // Card background
          doc.setFillColor(...colors.lightGray);
          doc.roundedRect(xPos, yPosition, cardWidth, cardHeight, 2, 2, "F");

          // Colored left border
          doc.setFillColor(...stat.color);
          doc.rect(xPos, yPosition, 3, cardHeight, "F");

          // Value
          doc.setTextColor(...stat.color);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(stat.value, xPos + cardWidth / 2, yPosition + 9, {
            align: "center",
          });

          // Label
          doc.setTextColor(...colors.gray);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(stat.label, xPos + cardWidth / 2, yPosition + 16, {
            align: "center",
          });
        });

        yPosition += cardHeight + 10;

        // Additional stats
        const lineHeight = 5;
        const writeWrappedLine = (text: string): void => {
          const lines = doc.splitTextToSize(text, contentWidth) as string[];
          doc.text(lines, margin, yPosition);
          yPosition += lines.length * lineHeight;
        };

        if (data.testRun) {
          doc.setTextColor(...colors.gray);
          doc.setFontSize(10);
          writeWrappedLine(`Test Run: ${data.testRun.name}`);
          writeWrappedLine(`Status: ${data.testRun.status}`);
          if (data.testRun.completed_at) {
            writeWrappedLine(
              `Completed: ${formatDate(data.testRun.completed_at)}`,
            );
          }
        }

        doc.text(
          `Blocked: ${blocked} | No Run: ${noRun}`,
          margin,
          yPosition,
        );
        yPosition += 15;
      }

      // Add test cases table
      function addTestCasesTable(): void {
        checkPageBreak(30);

        doc.setTextColor(...colors.black);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Test Cases Overview", margin, yPosition);
        yPosition += 8;

        const tableData = data.testCases.map((tc) => {
          const result = data.testResults.find((r) => r.test_case_id === tc.id);
          return [
            tc.id.toString(),
            tc.title.substring(0, 50) + (tc.title.length > 50 ? "..." : ""),
            tc.priority,
            tc.type,
            result?.status || "No Result",
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [["ID", "Title", "Priority", "Type", "Status"]],
          body: tableData,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: colors.primary,
            textColor: colors.white,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: "auto" },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 25 },
          },
          didParseCell: function (data) {
            // Color status cells
            if (data.section === "body" && data.column.index === 4) {
              const status = data.cell.raw as string;
              data.cell.styles.textColor = getStatusColor(status);
              data.cell.styles.fontStyle = "bold";
            }
            // Color priority cells
            if (data.section === "body" && data.column.index === 2) {
              const priority = data.cell.raw as string;
              data.cell.styles.textColor = getPriorityColor(priority);
              data.cell.styles.fontStyle = "bold";
            }
          },
        });

        yPosition =
          (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
            .finalY + 15;
      }

      // Add detailed test cases with steps, comments, and screenshots
      async function addDetailedTestCases(): Promise<void> {
        doc.addPage();
        yPosition = margin;

        doc.setTextColor(...colors.black);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Detailed Test Results", margin, yPosition);
        yPosition += 10;

        for (const testCase of data.testCases) {
          const result = data.testResults.find(
            (r) => r.test_case_id === testCase.id,
          );

          // Check if we need a new page (estimate space needed)
          const estimatedHeight =
            40 +
            (opts.includeSteps ? testCase.steps.length * 15 : 0) +
            (opts.includeComments && result?.comment ? 20 : 0);
          checkPageBreak(Math.min(estimatedHeight, 100));

          // Test case header with status badge
          const status = result?.status || "No Result";
          const statusColor = getStatusColor(status);

          // Background for test case header
          doc.setFillColor(...colors.lightGray);
          doc.roundedRect(margin, yPosition - 2, contentWidth, 12, 2, 2, "F");

          // Status indicator
          doc.setFillColor(...statusColor);
          doc.circle(margin + 5, yPosition + 4, 3, "F");

          // Test case title
          doc.setTextColor(...colors.black);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          const titleText = `TC-${testCase.id}: ${testCase.title}`;
          doc.text(titleText.substring(0, 80), margin + 12, yPosition + 5);

          // Status text on the right with padding
          doc.setTextColor(...statusColor);
          doc.setFontSize(10);
          const statusWidth = doc.getTextWidth(status);
          doc.text(status, pageWidth - margin - statusWidth - 5, yPosition + 5);

          yPosition += 14;

          // Metadata
          if (opts.includeMetadata) {
            doc.setTextColor(...colors.gray);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(
              `Priority: ${testCase.priority} | Type: ${testCase.type} | Status: ${testCase.status || "active"}`,
              margin + 5,
              yPosition,
            );
            yPosition += 5;
          }

          // Description (rich text preserved)
          if (testCase.description) {
            checkPageBreak(15);
            doc.setTextColor(...colors.black);
            yPosition = renderFormattedHtml(
              testCase.description,
              margin + 5,
              yPosition,
              contentWidth - 10,
              9,
            );
            yPosition += 3;
          }

          // Preconditions (rich text preserved)
          if (testCase.preconditions) {
            checkPageBreak(15);
            doc.setTextColor(...colors.gray);
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.text("Preconditions:", margin + 5, yPosition);
            yPosition += 4;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.black);
            yPosition = renderFormattedHtml(
              testCase.preconditions,
              margin + 5,
              yPosition,
              contentWidth - 10,
              8,
            );
            yPosition += 3;
          }

          // Test steps
          if (opts.includeSteps && testCase.steps.length > 0) {
            checkPageBreak(20);

            doc.setTextColor(...colors.black);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Test Steps:", margin + 5, yPosition);
            yPosition += 5;

            const stepsData = testCase.steps.map(
              (step: TestStep, index: number) => [
                (index + 1).toString(),
                htmlToFormattedText(step.step),
                htmlToFormattedText(step.expected),
              ],
            );

            autoTable(doc, {
              startY: yPosition,
              head: [["#", "Action", "Expected Result"]],
              body: stepsData,
              margin: { left: margin + 5, right: margin },
              // `striped` (the default theme) bands `rowIndex % 2 === 0`,
              // which includes row 0 — so the first step would always
              // render with the alternate gray fill while the second step
              // is white. Use `plain` so every body row renders uniformly.
              theme: "plain",
              styles: {
                fontSize: 8,
                cellPadding: 2,
              },
              headStyles: {
                fillColor: [229, 231, 235],
                textColor: colors.gray,
                fontStyle: "bold",
              },
              bodyStyles: {
                fontStyle: "normal",
              },
              columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: "auto" },
                2: { cellWidth: "auto" },
              },
            });

            yPosition =
              (doc as jsPDF & { lastAutoTable: { finalY: number } })
                .lastAutoTable.finalY + 5;
          }

          // Comments
          if (opts.includeComments && result?.comment) {
            checkPageBreak(20);

            doc.setFillColor(255, 251, 235); // Light yellow background
            doc.roundedRect(
              margin + 5,
              yPosition - 2,
              contentWidth - 10,
              15,
              2,
              2,
              "F",
            );

            doc.setTextColor(...colors.warning);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text("Comment:", margin + 8, yPosition + 3);

            doc.setTextColor(...colors.black);
            doc.setFont("helvetica", "normal");
            const commentText = stripHtml(result.comment);
            const splitComment = doc.splitTextToSize(
              commentText,
              contentWidth - 20,
            );
            doc.text(splitComment.slice(0, 2), margin + 8, yPosition + 8);
            yPosition += 18;
          }

          // Screenshots/Attachments — capped at 3 per result to match backend
          if (
            opts.includeScreenshots &&
            result?.attachments &&
            result.attachments.length > 0
          ) {
            const imageAttachments = result.attachments.filter(
              (att: Attachment) => att.mime_type?.startsWith("image/"),
            );
            const cap = 3;
            const embed = imageAttachments.slice(0, cap);

            for (const attachment of embed) {
              checkPageBreak(60);

              doc.setTextColor(...colors.gray);
              doc.setFontSize(8);
              doc.text(
                `Screenshot: ${attachment.filename}`,
                margin + 5,
                yPosition,
              );
              yPosition += 4;

              if (attachment.url) {
                try {
                  const dataUrl = await fetchAsDataURL(attachment.url);
                  const { width: natW, height: natH } =
                    await loadImageSize(dataUrl);
                  const aspect = natW > 0 ? natH / natW : 0;

                  let imgWidth = contentWidth;
                  let imgHeight = imgWidth * aspect;

                  const maxHeight = pageHeight - yPosition - margin;
                  const fullPageHeight = pageHeight - margin * 2;
                  if (imgHeight > maxHeight) {
                    if (imgHeight <= fullPageHeight) {
                      doc.addPage();
                      yPosition = margin;
                    } else {
                      imgHeight = fullPageHeight;
                      imgWidth = aspect > 0 ? imgHeight / aspect : contentWidth;
                    }
                  }

                  const fmt =
                    attachment.mime_type === "image/png" ? "PNG" : "JPEG";
                  doc.addImage(
                    dataUrl,
                    fmt,
                    margin,
                    yPosition,
                    imgWidth,
                    imgHeight,
                  );
                  yPosition += imgHeight + 5;
                } catch (_imgError) {
                  doc.setTextColor(...colors.gray);
                  doc.text(
                    `[Image: ${attachment.filename} — unavailable]`,
                    margin + 10,
                    yPosition,
                  );
                  yPosition += 5;
                }
              }
            }

            if (imageAttachments.length > cap) {
              doc.setTextColor(...colors.gray);
              doc.setFontSize(8);
              doc.text(
                `+${imageAttachments.length - cap} more screenshot(s) — open run in app`,
                margin + 5,
                yPosition,
              );
              yPosition += 5;
            }
          }

          // Separator line
          yPosition += 3;
          doc.setDrawColor(...colors.lightGray);
          doc.setLineWidth(0.5);
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 8;
        }
      }

      // Add footer to all pages
      function addFooter(): void {
        const totalPages = (
          doc as unknown as { internal: { getNumberOfPages: () => number } }
        ).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setTextColor(...colors.gray);
          doc.setFontSize(8);
          doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: "center" },
          );
          doc.text("Generated by Testoria", margin, pageHeight - 8);
        }
      }

      // Generate PDF
      addHeader();
      addSummary();
      addTestCasesTable();
      await addDetailedTestCases();
      addFooter();

      // Download
      const filename = `test-report-${data.project.name}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to generate PDF";
      throw err;
    } finally {
      exporting.value = false;
    }
  }

  return {
    exporting,
    error,
    exportToPdf,
  };
}
