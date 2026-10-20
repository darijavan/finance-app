// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { Transaction } from "../lib/types";

// jsdom does not implement <dialog> modal behavior.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { default: ReceiptViewer } = await import("../app/(finance)/transactions/receipt-viewer");

const pdfTx = { id: 9, receipt_name: "invoice.pdf", receipt_mime: "application/pdf" } as Transaction;
const imageTx = { id: 9, receipt_name: "photo.jpg", receipt_mime: "image/jpeg" } as Transaction;

it("renders a PDF receipt in an inline embed and links a plain download", () => {
  render(<ReceiptViewer transaction={pdfTx} onClose={vi.fn()} />);

  const frame = screen.getByTitle("Receipt: invoice.pdf") as HTMLIFrameElement;
  expect(frame.src).toContain("/api/transactions/9/receipt?view=1");

  const download = screen.getByRole("link", { name: /download/i }) as HTMLAnchorElement;
  expect(download.href).toContain("/api/transactions/9/receipt");
  expect(download.href).not.toContain("view=1");
});

it("renders an image receipt with keyboard-operable zoom controls", () => {
  render(<ReceiptViewer transaction={imageTx} onClose={vi.fn()} />);

  const img = screen.getByRole("img", { name: /photo\.jpg/i }) as HTMLImageElement;
  expect(img.src).toContain("/api/transactions/9/receipt?view=1");
  expect(img.style.transform).toContain("scale(1)");

  fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
  expect(img.style.transform).toContain("scale(1.5)");

  fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
  expect(img.style.transform).toContain("scale(2)");

  Object.defineProperty(img, "offsetWidth", { configurable: true, value: 200 });
  Object.defineProperty(img, "offsetHeight", { configurable: true, value: 200 });
  Object.defineProperty(img.parentElement, "clientWidth", { configurable: true, value: 200 });
  Object.defineProperty(img.parentElement, "clientHeight", { configurable: true, value: 200 });
  fireEvent.pointerDown(img, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(img, { pointerId: 1, clientX: 500, clientY: 500 });
  expect(img.style.transform).toContain("translate(100px, 100px)");

  fireEvent.click(screen.getByRole("button", { name: /reset zoom/i }));
  expect(img.style.transform).toContain("scale(1)");
});

it("closes on the close button, on Escape, and on a backdrop click", () => {
  const onClose = vi.fn();
  render(<ReceiptViewer transaction={pdfTx} onClose={onClose} />);

  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  expect(onClose).toHaveBeenCalledTimes(1);

  const dialog = screen.getByRole("dialog");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);

  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 100, right: 500, top: 100, bottom: 500,
  } as DOMRect);
  fireEvent.click(dialog, { clientX: 20, clientY: 20 });
  expect(onClose).toHaveBeenCalledTimes(3);
});
