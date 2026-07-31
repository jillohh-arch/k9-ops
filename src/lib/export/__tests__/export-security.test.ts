import { jsPDF } from "jspdf";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPdfDocument, savePdfDocument } from "../export-pdf";
import {
  neutralizeSpreadsheetFormula,
  sanitizeDownloadFilename,
  sanitizeWorksheetName,
} from "../export-safety";
import {
  createXlsxBlob,
  createXlsxWorkbook,
  exportToXlsx,
} from "../export-xlsx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("secure export filenames", () => {
  it("removes paths, control characters, reserved names and duplicate extensions", () => {
    expect(
      sanitizeDownloadFilename("../../segredo\u0000:relatorio.PDF", ".pdf"),
    ).toBe("segredo-relatorio.pdf");
    expect(sanitizeDownloadFilename("CON", ".xlsx")).toBe("k9-ops-CON.xlsx");
    expect(sanitizeDownloadFilename("relatorio.xlsx", ".xlsx")).toBe(
      "relatorio.xlsx",
    );
  });

  it("limits and sanitizes worksheet names", () => {
    const name = sanitizeWorksheetName(
      "'Relatório: Operacional/Com [dados] muito longos'",
    );
    expect(name).toBe("Relatório Operacional Com dados");
    expect(name.length).toBeLessThanOrEqual(31);
  });
});

describe("PDF export", () => {
  it("creates a non-empty PDF with table, accents, long values and literal HTML", () => {
    const doc = createPdfDocument({
      filename: "relatório",
      title: "Relatório de Saúde K9",
      subtitle: "<script>alert('texto literal')</script>",
      headers: ["K9", "Observação"],
      rows: [
        [
          "Ágata",
          `${"<b>não interpretar</b>"} ${"descrição longa ".repeat(80)}`,
        ],
      ],
    });

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("saves only with a sanitized local filename", () => {
    const doc = new jsPDF();
    const save = vi.spyOn(doc, "save").mockImplementation(() => doc);

    expect(() => savePdfDocument(doc, "..\\..\\dados:reais")).not.toThrow();
    expect(save).toHaveBeenCalledWith("dados-reais.pdf");
  });
});

describe("XLSX export", () => {
  it("neutralizes formula prefixes, including leading whitespace", () => {
    for (const value of ["=1+1", "+CMD", "-2+3", "@SUM(A1:A2)", " =1+1"]) {
      expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
    }
    expect(neutralizeSpreadsheetFormula("texto normal")).toBe("texto normal");
  });

  it("builds only a synthetic write-only workbook with safe cells", () => {
    const workbook = createXlsxWorkbook(
      ["Nome", "=Cabeçalho"],
      [
        ["Ágata", "=HYPERLINK(\"file:///c:/segredo\")"],
        ["", "@comando"],
      ],
      "Saúde:/K9[]",
    );
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    expect(sheetName).toBe("Saúde K9");
    expect(worksheet.A2).toMatchObject({ t: "s", v: "Ágata" });
    expect(worksheet.B1).toMatchObject({ t: "s", v: "'=Cabeçalho" });
    expect(worksheet.B2).toMatchObject({
      t: "s",
      v: "'=HYPERLINK(\"file:///c:/segredo\")",
    });
    expect(worksheet.B3).toMatchObject({ t: "s", v: "'@comando" });
    expect(worksheet.B2.f).toBeUndefined();
  });

  it("supports empty and reasonably sized exports without reading files", () => {
    expect(createXlsxBlob([], [], "Vazio").size).toBeGreaterThan(0);

    const rows = Array.from({ length: 1_000 }, (_, index) => [
      `K9-${index}`,
      `Observação sintética ${index}`,
    ]);
    expect(createXlsxBlob(["K9", "Observação"], rows).size).toBeGreaterThan(
      10_000,
    );
  });

  it("downloads a non-empty workbook with a sanitized filename", () => {
    const createObjectURL = vi.fn(() => "blob:synthetic");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    exportToXlsx("../relatório:K9", ["K9"], [["Ágata"]], "Saúde");

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
