"use client";

/**
 * Live QR scan from the camera. Loaded lazily on the first tap of the camera
 * button.
 *
 * - About 8 frames a second, one frame in flight at a time (no pile-up of
 *   async detects, no double results).
 * - Frames are scaled to 960 px before decoding; one shared BarcodeDetector,
 *   jsQR as the fallback (both via src/lib/qr/decode.ts).
 * - The shutter takes a still photo for the OCR path when the receipt has no
 *   readable QR.
 */
import { useEffect, useRef } from "react";
import type { Translate } from "@/lib/i18n/translate";
import { decodeQrFromImageData } from "@/lib/qr/decode";
import { Icon, Cancel01Icon, Camera01Icon } from "@/components/Icon";

interface Props {
  t: Translate;
  onResult: (raw: string) => void;
  onPhoto: (file: File) => void;
  onClose: () => void;
  onError: () => void;
}

const FRAME_MS = 125;
const FRAME_EDGE = 960;

export default function CameraScanner({ t, onResult, onPhoto, onClose, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handlers = useRef({ onResult, onError });

  useEffect(() => {
    handlers.current = { onResult, onError };
  }, [onResult, onError]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || !ctx) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
        const scale = Math.min(1, FRAME_EDGE / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const found = await decodeQrFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (found && !stopped) {
          stopped = true;
          handlers.current.onResult(found);
          return;
        }
      }
      if (!stopped) timer = setTimeout(tick, FRAME_MS);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        tick();
      } catch {
        if (!stopped) handlers.current.onError();
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, []);

  const shutter = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onPhoto(new File([blob], "camera.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  };

  return (
    <div className="cam" role="group" aria-label={t("verify.camera.title")}>
      <video ref={videoRef} className="cam-video" playsInline muted aria-hidden="true" />
      <div className="cam-frame" aria-hidden="true" />
      <p className="cam-hint">{t("verify.camera.hint")}</p>
      <button type="button" className="cam-close" onClick={onClose} aria-label={t("verify.camera.close")}>
        <Icon icon={Cancel01Icon} size={20} />
      </button>
      <button type="button" className="cam-shutter" onClick={shutter}>
        <Icon icon={Camera01Icon} size={18} />
        {t("verify.camera.shutter")}
      </button>
    </div>
  );
}
