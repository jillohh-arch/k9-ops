import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExportToolbar } from "../export-toolbar";

vi.mock("@/lib/export", () => ({
  exportToCsv: vi.fn(),
  exportToPdf: vi.fn(),
  exportToXlsx: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ExportToolbar failure boundary", () => {
  it("handles a synthetic export error without crashing or leaving the UI busy", async () => {
    vi.useFakeTimers();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const getData = vi.fn(() => {
      throw new Error("synthetic export failure");
    });

    render(
      <ExportToolbar
        getData={getData}
        reportId="health"
        reportTitle="Saúde"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Exportar como PDF" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(consoleError).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Exportar como PDF" }),
    ).not.toBeDisabled();
  });
});
