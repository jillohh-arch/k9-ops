import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { K9EditPhoto } from "../k9-edit-photo";

const imagePropsSpy = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    imagePropsSpy(props);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={String(props.alt ?? "")}
        data-unoptimized={props.unoptimized ? "true" : "false"}
        src={String(props.src ?? "")}
      />
    );
  },
}));

describe("K9EditPhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders existing remote Firebase Storage photo with unoptimized=true", () => {
    const remoteUrl =
      "https://firebasestorage.googleapis.com/v0/b/canil-gcm.firebasestorage.app/o/profile_photos%2Fdog-1.png?alt=media&token=abc";

    render(
      <K9EditPhoto
        onPhotoChange={vi.fn()}
        onRemove={vi.fn()}
        previewUrl={remoteUrl}
      />,
    );

    expect(imagePropsSpy).toHaveBeenCalledTimes(1);
    const passedProps = imagePropsSpy.mock.calls[0][0];
    expect(passedProps.src).toBe(remoteUrl);
    expect(passedProps.unoptimized).toBe(true);
    expect(screen.getByRole("button", { name: /remover foto/i })).toBeTruthy();
    expect(screen.getByText(/trocar foto/i)).toBeTruthy();
  });

  it("renders local blob preview with unoptimized=true", () => {
    const blobUrl = "blob:http://localhost:3000/mock-uuid";

    render(
      <K9EditPhoto
        onPhotoChange={vi.fn()}
        onRemove={vi.fn()}
        previewUrl={blobUrl}
      />,
    );

    expect(imagePropsSpy).toHaveBeenCalledTimes(1);
    const passedProps = imagePropsSpy.mock.calls[0][0];
    expect(passedProps.src).toBe(blobUrl);
    expect(passedProps.unoptimized).toBe(true);
  });

  it("renders placeholder state when no photo is present", () => {
    render(
      <K9EditPhoto
        onPhotoChange={vi.fn()}
        onRemove={vi.fn()}
        previewUrl=""
      />,
    );

    expect(imagePropsSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Foto do K9")).toBeTruthy();
    expect(screen.getByText("Sem foto definida")).toBeTruthy();
    expect(screen.getByText("Adicionar foto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /remover foto/i })).toBeNull();
  });

  it("triggers onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <K9EditPhoto
        onPhotoChange={vi.fn()}
        onRemove={onRemove}
        previewUrl="https://firebasestorage.googleapis.com/test.png"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remover foto/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("triggers onPhotoChange when a file is selected", () => {
    const onPhotoChange = vi.fn();
    render(
      <K9EditPhoto
        onPhotoChange={onPhotoChange}
        onRemove={vi.fn()}
        previewUrl=""
      />,
    );

    const input = screen.getByLabelText(/adicionar foto/i) as HTMLInputElement;
    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPhotoChange).toHaveBeenCalledTimes(1);
  });
});
