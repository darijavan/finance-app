"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Transaction } from "@/lib/types";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

const clampPan = (offset: number, contentSize: number, containerSize: number) => {
  const max = Math.max(0, (contentSize - containerSize) / 2);

  return Math.min(max, Math.max(-max, offset));
};

type Receipt = Pick<Transaction, "id" | "receipt_name" | "receipt_mime">;

export default function ReceiptViewer({ transaction, onClose }: { transaction: Receipt; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const name = transaction.receipt_name || "Receipt";
  const url = `/api/transactions/${transaction.id}/receipt`;
  const viewUrl = `${url}?view=1`;
  const isPdf = transaction.receipt_mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const reset = () => {
    setZoom(MIN_ZOOM);
    setPosition({ x: 0, y: 0 });
  };
  const clamp = (value: number, axis: "x" | "y") => clampPan(
    value,
    ((axis === "x" ? imageRef.current?.offsetWidth : imageRef.current?.offsetHeight) ?? 0) * zoom,
    (axis === "x" ? stageRef.current?.clientWidth : stageRef.current?.clientHeight) ?? 0,
  );
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (zoom === MIN_ZOOM) {

      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX: position.x, offsetY: position.y };
  };
  const pan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {

      return;
    }
    setPosition({
      x: clamp(drag.offsetX + event.clientX - drag.x, "x"),
      y: clamp(drag.offsetY + event.clientY - drag.y, "y"),
    });
  };

  return <dialog ref={dialogRef} className="modal receipt-viewer" aria-labelledby="receipt-viewer-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="receipt-viewer-header">
      <h3 id="receipt-viewer-title">Receipt: {name}</h3>
      <div className="modal-actions">
        <a className="btn secondary small" href={url}>Download</a>
        <button className="btn secondary small" onClick={onClose} aria-label="Close receipt viewer">Close</button>
      </div>
    </div>
    {isPdf ? <iframe className="receipt-pdf" src={viewUrl} title={`Receipt: ${name}`} /> : <>
      <div className="receipt-image-controls" aria-label="Image zoom controls">
        <button className="btn secondary small" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))} disabled={zoom === MIN_ZOOM} aria-label="Zoom out">−</button>
        <button className="btn secondary small" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))} disabled={zoom === MAX_ZOOM} aria-label="Zoom in">+</button>
        <button className="btn secondary small" onClick={reset} disabled={zoom === MIN_ZOOM && position.x === 0 && position.y === 0} aria-label="Reset zoom">Reset</button>
      </div>
      <div ref={stageRef} className={zoom > MIN_ZOOM ? "receipt-image-stage zoomed" : "receipt-image-stage"} onPointerDown={startPan} onPointerMove={pan} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
        {/* oxlint-disable-next-line next/no-img-element -- private receipt URL and measured DOM dimensions are required here */}
        <img ref={imageRef} src={viewUrl} alt={`Receipt: ${name}`} draggable={false} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} />
      </div>
    </>}
  </dialog>;
}
