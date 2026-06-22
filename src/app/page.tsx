"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { banks, detectBank, type BankCode, type VerifyResult } from "@/lib/banks";
import { articles } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";
import { BankLogoByName } from "@/components/BankLogo";
import { BankSelector } from "@/components/BankSelector";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, BoltIcon, Key01Icon, Layers01Icon, CodeIcon, ReceiptTextIcon, Search01Icon, Camera01Icon, QrCode01Icon, QrCodeScanIcon, BookOpen01Icon, ContainerIcon, CheckmarkCircle01Icon, ArrowRight01Icon, GithubIcon, StarIcon, Copy01Icon, CopyCheckIcon, ChevronDownIcon, Alert01Icon, Upload01Icon } from "@/components/Icon";
import { extractTextFromImage } from "@/lib/ocr";
import { parseReceiptText } from "@/lib/ocr-parser";

export default function Home() {
  const { t } = useTranslation();
  const [bank, setBank] = useState<BankCode>("cbe");
  const [reference, setReference] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{ bank: string; ref: string; date: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [inputMode, setInputMode] = useState<"reference" | "url" | "photo">("reference");
  const [showQrPaste, setShowQrPaste] = useState(false);
  const [qrData, setQrData] = useState("");
  const [batchResults, setBatchResults] = useState<{ fileName: string; status: "scanning" | "verifying" | "done" | "error"; data?: VerifyResult; error?: string }[]>([]);
  // Smart fallback state for geo-blocked banks (Telebirr, M-Pesa)
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackBankUrl, setFallbackBankUrl] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackResult, setFallbackResult] = useState<VerifyResult | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [fallbackTab, setFallbackTab] = useState<"paste" | "bookmarklet">("paste");
  const [isMobile, setIsMobile] = useState(false);
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
  const [photoExtracted, setPhotoExtracted] = useState<{ reference: string; bank: BankCode } | null>(null);

  const selectedBank = banks.find((b) => b.code === bank)!;
  const needsAccount = selectedBank.requiresAccount;
  const needsPhone = selectedBank.requiresPhone;
  const isDisabled = selectedBank.status === "soon";
  const isGeoBlocked = selectedBank.geoBlocked;

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
    try {
      const h = localStorage.getItem("cheki_history");
      if (h) setHistory(JSON.parse(h).slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    if (!reference) return;
    const trimmed = reference.trim();
    if (trimmed.startsWith("http")) {
      setInputMode("url");
      return;
    }
    setInputMode("reference");
    const detected = detectBank(trimmed);
    if (detected && detected !== bank) setBank(detected as BankCode);
  }, [reference]);

  useEffect(() => {
    if (photoExtracted && reference.trim() !== photoExtracted.reference) {
      setPhotoExtracted(null);
    }
  }, [reference, photoExtracted]);

  const isBoaQrPayload = (s: string) => {
    const t = s.trim();
    if (t.length < 80) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(t)) return false;
    try {
      const decoded = atob(t);
      return decoded.length % 16 === 0 && decoded.length >= 32;
    } catch {
      return false;
    }
  };

  const verifyQr = useCallback(async (payload: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank: "boa", qrData: payload.trim() }),
      });
      const data: VerifyResult = await resp.json();
      if (!data.success) {
        setError(data.error || "QR decryption failed.");
        setResult(data);
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQrDetected = useCallback((rawValue: string) => {
    setShowScanner(false);
    scannerActiveRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (isBoaQrPayload(rawValue)) {
      setBank("boa");
      setQrData(rawValue);
      setShowQrPaste(true);
      verifyQr(rawValue);
    } else if (rawValue.startsWith("http")) {
      setReference(rawValue);
      setInputMode("url");
    } else {
      setReference(rawValue);
      setInputMode("reference");
      const detected = detectBank(rawValue);
      if (detected) setBank(detected as BankCode);
    }
  }, [verifyQr]);

  // Build fallback URL from the selected bank + reference
  const buildFallbackUrl = useCallback((bankCode: string, ref: string): string => {
    if (bankCode === "telebirr") return `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;
    if (bankCode === "mpesa") return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${ref}`;
    return "";
  }, []);

  const handleVerify = useCallback(async () => {
    if (showQrPaste && qrData.trim()) {
      await verifyQr(qrData);
      return;
    }
    if (!reference.trim() || isDisabled) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank, reference: reference.trim(), accountNumber: accountNumber.trim() || undefined }),
      });
      const data: VerifyResult = await resp.json();
      if (!data.success) {
        setError(data.error || "Verification failed.");
        setResult(data);
        // Trigger smart fallback for geo-blocked banks
        if (data.fallbackUrl || isGeoBlocked) {
          const fbUrl = data.fallbackUrl || buildFallbackUrl(bank, reference.trim());
          if (fbUrl) {
            setShowFallback(true);
            setFallbackBankUrl(fbUrl);
            setFallbackTab(isMobile ? "paste" : "bookmarklet");
            setFallbackResult(null);
            setFallbackError(null);
            setPasteContent("");
          }
        }
      } else {
        setResult(data);
        setShowFallback(false);
        const entry = { bank, ref: reference.trim(), date: new Date().toISOString() };
        const newHistory = [entry, ...history.filter((h) => h.ref !== reference.trim())].slice(0, 5);
        setHistory(newHistory);
        try { localStorage.setItem("cheki_history", JSON.stringify(newHistory)); } catch {}
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [bank, reference, accountNumber, isDisabled, history, showQrPaste, qrData, verifyQr, isGeoBlocked, isMobile, buildFallbackUrl]);

  useEffect(() => {
    if (result && result.success && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const scannerActiveRef = useRef(false);

  const startScanner = useCallback(async () => {
    setShowScanner(true);
    scannerActiveRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const checkFrame = () => {
        if (!scannerActiveRef.current || !videoRef.current || !streamRef.current) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (imageData) {
            const tryDetect = (rawValue: string | null) => {
              if (rawValue) { handleQrDetected(rawValue); return true; }
              return false;
            };
            if ("BarcodeDetector" in window) {
              const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
              detector.detect(imageData).then((codes: any[]) => {
                if (codes.length > 0 && !tryDetect(codes[0].rawValue)) {}
                else if (codes.length === 0) {
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  if (code) tryDetect(code.data);
                }
              }).catch(() => {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) tryDetect(code.data);
              });
            } else {
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) tryDetect(code.data);
            }
          }
        }
        if (scannerActiveRef.current) requestAnimationFrame(checkFrame);
      };
      checkFrame();
    } catch {
      setError("Camera access denied. Check browser permissions.");
      setShowScanner(false);
      scannerActiveRef.current = false;
    }
  }, [handleQrDetected]);

  const scanQRCode = useCallback((imageData: ImageData) => {
    const tryDetect = (rawValue: string | null) => {
      if (rawValue) { handleQrDetected(rawValue); return true; }
      return false;
    };
    if ("BarcodeDetector" in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      detector.detect(imageData).then((codes: any[]) => {
        if (codes.length > 0) tryDetect(codes[0].rawValue);
        else {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) tryDetect(code.data);
        }
      }).catch(() => {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) tryDetect(code.data);
      });
    } else {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) tryDetect(code.data);
    }
  }, [handleQrDetected]);

  const stopScanner = useCallback(() => {
    scannerActiveRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => { return () => stopScanner(); }, [stopScanner]);

  // ── Multi-scale QR scanning ──────────────────────────────────────────────
  // Tries the full image, then upscaled, then quadrant/region crops.
  // This finds small QR codes in large receipt screenshots without needing
  // the user to crop manually.

  const scanImageDataForQR = useCallback((imageData: ImageData): string | null => {
    // 1. Try BarcodeDetector (native, handles multi-scale internally)
    if ("BarcodeDetector" in window) {
      // BarcodeDetector is async, but we need sync here for the multi-scale loop.
      // We'll use it separately in scanImageMultiScale.
    }
    // 2. Try jsQR on the full image
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) return code.data;
    return null;
  }, []);

  const scanImageMultiScale = useCallback(async (img: HTMLImageElement): Promise<string | null> => {
    const w = img.width;
    const h = img.height;
    const MAX_DIM = 1920; // cap canvas size to avoid memory/perf issues

    // Helper: render a region of the image to ImageData, capping total size
    const renderRegion = (sx: number, sy: number, sw: number, sh: number, scale: number): ImageData | null => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      let cw = Math.round(sw * scale);
      let ch = Math.round(sh * scale);
      // Cap to MAX_DIM
      if (cw > MAX_DIM || ch > MAX_DIM) {
        const r = Math.min(MAX_DIM / cw, MAX_DIM / ch);
        cw = Math.round(cw * r);
        ch = Math.round(ch * r);
      }
      canvas.width = cw;
      canvas.height = ch;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      return ctx.getImageData(0, 0, cw, ch);
    };

    // Helper: try both BarcodeDetector and jsQR
    const tryScan = async (imageData: ImageData): Promise<string | null> => {
      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const codes = await detector.detect(imageData);
          if (codes.length > 0) return codes[0].rawValue;
        } catch { /* fall through to jsQR */ }
      }
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      return code ? code.data : null;
    };

    // Pass 1: Full image at native resolution (BarcodeDetector handles multi-scale internally)
    {
      const imageData = renderRegion(0, 0, w, h, 1);
      if (imageData) {
        const result = await tryScan(imageData);
        if (result) return result;
      }
    }

    // Pass 2: Bottom 50% at 2x (QR is almost always at the bottom of receipts)
    {
      const imageData = renderRegion(0, Math.floor(h * 0.5), w, Math.ceil(h * 0.5), 2);
      if (imageData) {
        const result = await tryScan(imageData);
        if (result) return result;
      }
    }

    // Pass 3: Center 40% at 3x (last resort for tiny QRs)
    {
      const cw = Math.floor(w * 0.4);
      const ch = Math.floor(h * 0.4);
      const cx = Math.floor((w - cw) / 2);
      const cy = Math.floor((h - ch) / 2);
      const imageData = renderRegion(cx, cy, cw, ch, 3);
      if (imageData) {
        const result = await tryScan(imageData);
        if (result) return result;
      }
    }

    return null;
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Single file: use existing flow with multi-scale scanning
    if (files.length === 1) {
      const file = files[0];
      const img = new Image();
      img.onload = async () => {
        const result = await scanImageMultiScale(img);
        if (result) {
          handleQrDetected(result);
        } else {
          setError("No QR code found in image. Try a clearer photo or crop around the QR code.");
        }
      };
      img.onerror = () => setError("Could not load image file.");
      img.src = URL.createObjectURL(file);
      return;
    }

    // Multiple files: batch mode
    setLoading(true);
    setError(null);
    setResult(null);
    const batchResults: { fileName: string; status: "scanning" | "verifying" | "done" | "error"; data?: VerifyResult; error?: string }[] = [];
    setBatchResults(batchResults.map((r, i) => ({ ...r, fileName: files[i].name, status: "scanning" as const })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const qrValue = await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.onload = async () => {
            const result = await scanImageMultiScale(img);
            resolve(result);
          };
          img.onerror = () => resolve(null);
          img.src = URL.createObjectURL(file);
        });

        if (!qrValue) {
          batchResults[i] = { fileName: file.name, status: "error", error: "No QR found" };
          setBatchResults([...batchResults]);
          continue;
        }

        batchResults[i] = { fileName: file.name, status: "verifying" };
        setBatchResults([...batchResults]);

        let verifyResult: VerifyResult;
        if (isBoaQrPayload(qrValue)) {
          const resp = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bank: "boa", qrData: qrValue.trim() }),
          });
          verifyResult = await resp.json();
        } else {
          const detected = detectBank(qrValue);
          const bankCode = detected || "cbe";
          const resp = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bank: bankCode, reference: qrValue.trim() }),
          });
          verifyResult = await resp.json();
        }

        batchResults[i] = { fileName: file.name, status: "done", data: verifyResult };
        setBatchResults([...batchResults]);
      } catch {
        batchResults[i] = { fileName: file.name, status: "error", error: "Scan failed" };
        setBatchResults([...batchResults]);
      }
    }

    setLoading(false);
  }, [handleQrDetected, scanImageMultiScale]);

  // ── Photo upload / camera capture with OCR fallback ────────────────────
  // 1. Try multi-scale QR detection first.
  // 2. If no QR, run tesseract.js OCR on the image.
  // 3. Parse the extracted text for a reference number and auto-detect the bank.

  const handlePhoto = useCallback(async (file: File) => {
    setPhotoProcessing(true);
    setError(null);
    setResult(null);
    setOcrProgress(null);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);

    const img = new Image();
    img.onload = async () => {
      // 1. QR first
      const qrValue = await scanImageMultiScale(img);
      if (qrValue) {
        handleQrDetected(qrValue);
        setPhotoProcessing(false);
        return;
      }

      // 2. OCR fallback
      try {
        const text = await extractTextFromImage(file, (p) => setOcrProgress(p));
        const parsed = parseReceiptText(text);
        if (parsed) {
          setBank(parsed.bank as BankCode);
          setReference(parsed.reference);
          setPhotoExtracted({ reference: parsed.reference, bank: parsed.bank as BankCode });
          setInputMode("reference");
          setShowScanner(false);
          stopScanner();
        } else {
          setError("Could not read a reference number from this photo. Try a clearer image, or paste the reference manually.");
        }
      } catch (e) {
        setError("Could not read the photo. Make sure it is not blurry and the transaction number is visible.");
      } finally {
        setPhotoProcessing(false);
        setOcrProgress(null);
      }
    };
    img.onerror = () => {
      setPhotoProcessing(false);
      setError("Could not load image file.");
    };
    img.src = previewUrl;
  }, [scanImageMultiScale, handleQrDetected, stopScanner]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handlePhoto(files[0]);
  }, [handlePhoto]);

  const capturePhotoFromVideo = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      handlePhoto(file);
    }, "image/jpeg", 0.92);
  }, [handlePhoto]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Smart fallback for geo-blocked banks ──────────────────────────────
  // When Telebirr/M-Pesa verification fails (server can't reach the bank),
  // the user can verify from their own browser. Two paths:
  //   1. Copy-paste (mobile): open receipt, select all, copy, paste here
  //   2. Bookmarklet (desktop): one-time install, then one click per receipt

  const handleFallbackVerify = useCallback(async () => {
    if (!pasteContent.trim() || !bank) return;
    setFallbackLoading(true);
    setFallbackError(null);
    setFallbackResult(null);
    try {
      const resp = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank, content: pasteContent.trim(), url: fallbackBankUrl }),
      });
      const data: VerifyResult = await resp.json();
      if (!data.success) {
        setFallbackError(data.error || "Could not parse receipt.");
      } else {
        setFallbackResult(data);
      }
    } catch {
      setFallbackError("Network error. Try again.");
    } finally {
      setFallbackLoading(false);
    }
  }, [bank, pasteContent, fallbackBankUrl]);

  // Generate the bookmarklet JS as a javascript: URL
  const bookmarkletCode = `(function(){
    var url=location.href;
    var bank='telebirr';
    var isMpesa=url.indexOf('safaricom.et')!==-1||url.indexOf('m-pesa')!==-1;
    if(isMpesa)bank='mpesa';
    else if(url.indexOf('ethiotelecom.et')!==-1)bank='telebirr';
    var html;
    if(isMpesa){
      html=document.body.textContent||document.body.innerText||'';
    }else{
      html=document.documentElement.outerHTML;
    }
    var o=document.createElement('div');
    o.id='cheki-overlay';
    o.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif';
    var b=document.createElement('div');
    b.style.cssText='background:#fff;border-radius:12px;padding:24px;max-width:380px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2)';
    b.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><div style="width:18px;height:18px;border:2.5px solid #16a34a;border-top-color:transparent;border-radius:50%;animation:cheki-spin 0.8s linear infinite"></div><span style="font-size:15px;font-weight:600;color:#1a1a1a">cheki is verifying...</span></div><style>@keyframes cheki-spin{to{transform:rotate(360deg)}}</style>';
    o.appendChild(b);
    document.body.appendChild(o);
    o.addEventListener('click',function(e){if(e.target===o)o.remove();});
    fetch('https://chekiapp.vercel.app/api/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bank:bank,html:html,url:url})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){
        var rows=[];
        if(d.senderName)rows.push(['From',d.senderName]);
        if(d.receiverName)rows.push(['To',d.receiverName]);
        if(d.bankAccountName)rows.push(['Account Name',d.bankAccountName]);
        if(d.bankAccountNumber)rows.push(['Account',d.bankAccountNumber]);
        if(d.amount!=null)rows.push(['Amount',(d.amount.toLocaleString?d.amount.toLocaleString():d.amount)+' '+(d.currency||'ETB')]);
        if(d.totalPaid!=null)rows.push(['Total Paid',(d.totalPaid.toLocaleString?d.totalPaid.toLocaleString():d.totalPaid)+' ETB']);
        if(d.date)rows.push(['Date',d.date]);
        if(d.reference)rows.push(['Reference',d.reference]);
        if(d.invoiceNumber&&d.invoiceNumber!==d.reference)rows.push(['Invoice',d.invoiceNumber]);
        if(d.transactionStatus)rows.push(['Status',d.transactionStatus]);
        if(d.paymentMode)rows.push(['Mode',d.paymentMode]);
        var rh=rows.map(function(r){return '<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #f0f0f0"><span style="color:#888;flex-shrink:0">'+r[0]+'</span><span style="color:#1a1a1a;font-weight:500;text-align:right;word-break:break-word">'+r[1]+'</span></div>';}).join('');
        b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#16a34a"/><path d="M7 12.5l3 3 7-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg><span style="font-size:16px;font-weight:700;color:#1a1a1a">Receipt verified</span></div><div style="border-top:1px solid #eee;padding-top:8px">'+rh+'</div><div style="display:flex;gap:8px;margin-top:16px"><a href="https://chekiapp.vercel.app" target="_blank" style="flex:1;text-align:center;padding:10px;border:1px solid #16a34a;border-radius:8px;background:#fff;color:#16a34a;font-size:13px;font-weight:600;text-decoration:none">Open cheki</a><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="flex:1;padding:10px;border:none;border-radius:8px;background:#16a34a;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Done</button></div>';
      }else{
        b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><svg width="20" height="20" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"/></svg><span style="font-size:15px;font-weight:600;color:#dc2626">Could not verify</span></div><p style="font-size:13px;color:#666;margin-bottom:16px;line-height:1.5">'+(d.error||'Make sure you are on the bank receipt page.')+'</p><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="width:100%;padding:10px;border:none;border-radius:8px;background:#f3f4f6;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">Close</button>';
      }
    })
    .catch(function(){
      b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:15px;font-weight:600;color:#dc2626">Network error</span></div><p style="font-size:13px;color:#666;margin-bottom:16px">Could not reach cheki. Check your internet.</p><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="width:100%;padding:10px;border:none;border-radius:8px;background:#f3f4f6;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">Close</button>';
    });
  })();`;

  const bookmarkletUrl = `javascript:${encodeURIComponent(bookmarkletCode)}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletUrl);
    setBookmarkletCopied(true);
    setTimeout(() => setBookmarkletCopied(false), 3000);
  };

  const features = [
    { icon: BoltIcon, title: "1-3 second verification", body: "Fetch receipts from bank endpoints in real time. Fast enough for checkout counters." },
    { icon: Key01Icon, title: "No API key, no signup", body: "Start verifying immediately. No account, no business plan, no credit limit." },
    { icon: Layers01Icon, title: "Batch verification", body: "Verify up to 50 receipts in a single API call. Perfect for end-of-day reconciliation." },
    { icon: ReceiptTextIcon, title: "Python library", body: "pip install cheki. Server-side verification from Ethiopian networks. CLI included." },
    { icon: ContainerIcon, title: "Self-host with Docker", body: "Run cheki on your own infrastructure. Bypass geo-blocks with an Ethiopian IP." },
    { icon: CodeIcon, title: "Structured JSON", body: "Every bank returns the same response shape. Write the integration once." },
    { icon: Search01Icon, title: "Auto-detect bank", body: "Paste a reference or URL and cheki identifies the bank automatically." },
    { icon: QrCodeScanIcon, title: "QR + photo OCR", body: "Scan QR codes, upload a screenshot, or take a photo of a receipt. OCR reads the transaction number if no QR is visible." },
    { icon: BookOpen01Icon, title: "Open source", body: "MIT licensed. Read the code, contribute, fork it. No black box." },
  ];

  return (
    <>
      <Nav />
      <main>
        {/* Hero + Verify Form */}
        <section className="container" style={{ paddingTop: "24px", paddingBottom: "32px" }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "28px", alignItems: "start" }}>
            {/* Left: Hero copy */}
            <div className="hero-copy">
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Free and open source
              </p>
              <h1 style={{
                fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 800, letterSpacing: "-0.03em",
                lineHeight: 1.08, color: "var(--ink)", marginBottom: "14px",
              }}>
                {t("hero.title")}
              </h1>
              <p style={{ color: "var(--ink-2)", fontSize: "16px", lineHeight: 1.5, maxWidth: "440px", marginBottom: "20px" }}>
                {t("hero.subtitle")}
              </p>
              <div className="hide-mobile" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a href="/docs" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>API Docs</a>
                <a href="/guides" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>Guides</a>
                <a href="/compare" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>Compare services</a>
              </div>
            </div>

            {/* Right: Verify form */}
            <div className="verify-card" style={{
              background: "var(--surface)", borderRadius: "14px", padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px var(--border)",
            }}>
              {/* Input mode tabs */}
              <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "1px solid var(--border)" }}>
                {[
                  { mode: "reference" as const, label: "Reference" },
                  { mode: "url" as const, label: "Receipt URL" },
                  { mode: "photo" as const, label: "Photo" },
                ].map((tab) => (
                  <button
                    key={tab.mode}
                    onClick={() => { setInputMode(tab.mode); setReference(""); setQrData(""); setShowQrPaste(false); setResult(null); setError(null); setPhotoPreview(null); setPhotoProcessing(false); setPhotoExtracted(null); setShowScanner(false); stopScanner(); }}
                    style={{
                      padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                      border: "none", borderBottom: inputMode === tab.mode ? "2px solid var(--green)" : "2px solid transparent",
                      background: "transparent", color: inputMode === tab.mode ? "var(--green)" : "var(--ink-3)",
                      cursor: "pointer", transition: "all 0.15s", marginBottom: "-1px",
                    }}
                  >{tab.label}</button>
                ))}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />

              {/* Photo extraction banner (shown in Reference mode after a photo was read) */}
              {photoExtracted && inputMode === "reference" && (
                <div className="fade-in" style={{ marginBottom: "14px", padding: "12px 14px", borderRadius: "8px", background: "var(--green-light)", border: "1px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon icon={CheckmarkCircle01Icon} size={18} color="var(--green)" />
                    <span style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 500 }}>
                      Read from photo: <strong style={{ fontFamily: "var(--mono)" }}>{photoExtracted.reference}</strong> · {banks.find((b) => b.code === photoExtracted.bank)?.name}
                    </span>
                  </div>
                  <button onClick={() => { setInputMode("photo"); setPhotoExtracted(null); setReference(""); setResult(null); setError(null); }} style={{ fontSize: "12px", color: "var(--green-dark)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>Use another photo</button>
                </div>
              )}

              {/* Photo capture / scanner overlay */}
              {showScanner && (
                <div style={{ marginBottom: "16px", borderRadius: "12px", overflow: "hidden", border: "2px solid var(--green)", position: "relative" }}>
                  <video ref={videoRef} style={{ width: "100%", display: "block", minHeight: "240px", background: "#000" }} playsInline muted />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px" }}>
                    <svg width="220" height="220" viewBox="0 0 220 220" fill="none" style={{ opacity: 0.9 }}>
                      <path d="M20 40V20H40" stroke="white" strokeWidth="3" strokeLinecap="round" />
                      <path d="M200 40V20H180" stroke="white" strokeWidth="3" strokeLinecap="round" />
                      <path d="M20 180V200H40" stroke="white" strokeWidth="3" strokeLinecap="round" />
                      <path d="M200 180V200H180" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p style={{ position: "absolute", top: "14px", left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: "13px", fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Center the receipt, then tap the shutter</p>
                  <button onClick={() => { setShowScanner(false); stopScanner(); }} style={{ position: "absolute", top: "10px", right: "10px", width: "32px", height: "32px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  <button onClick={capturePhotoFromVideo} style={{ position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)", width: "56px", height: "56px", borderRadius: "50%", border: "4px solid #fff", background: "rgba(255,255,255,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#fff" }} />
                  </button>
                </div>
              )}

              {/* Photo mode UI */}
              {inputMode === "photo" && (
                <div className="fade-in" style={{ marginBottom: "16px" }}>
                  {!photoPreview && !showScanner && (
                    <div>
                      <button onClick={() => startScanner()} style={{ width: "100%", padding: "28px 16px", borderRadius: "12px", border: "1px dashed var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <Icon icon={Camera01Icon} size={28} color="var(--green)" />
                        <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>Take a photo</span>
                        <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Use camera or phone</span>
                      </button>
                      <button onClick={() => photoInputRef.current?.click()} style={{ width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "14px", fontWeight: 500 }}>
                        <Icon icon={Upload01Icon} size={18} color="var(--ink-3)" /> Upload a screenshot
                      </button>
                      <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "12px", textAlign: "center", lineHeight: 1.5 }}>QR code is scanned first. If none is visible, OCR reads the transaction number.</p>
                    </div>
                  )}

                  {photoPreview && (
                    <div className="fade-in" style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
                      <img src={photoPreview} alt="Receipt preview" style={{ width: "100%", maxHeight: "260px", objectFit: "contain", background: "#000", display: "block" }} />
                      {photoProcessing && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: "10px" }}>
                          <span className="spin" style={{ width: "26px", height: "26px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
                          <span style={{ fontSize: "13px", fontWeight: 600 }}>{ocrProgress ? `${ocrProgress.status} ${Math.round(ocrProgress.progress * 100)}%` : "Scanning QR..."}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {photoPreview && !photoProcessing && (
                    <button onClick={() => { setPhotoPreview(null); setPhotoExtracted(null); if (photoInputRef.current) photoInputRef.current.value = ""; }} style={{ fontSize: "12px", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "0", marginTop: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Icon icon={Camera01Icon} size={12} color="var(--ink-3)" /> Take another photo
                    </button>
                  )}
                  <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
                </div>
              )}

              {inputMode !== "photo" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {inputMode === "reference" && (
                    <div>
                      <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>{t("hero.bankLabel")}</label>
                      <BankSelector value={bank} onChange={(code) => { setBank(code as BankCode); setResult(null); setError(null); }} />
                    </div>
                  )}

                  {isGeoBlocked && inputMode === "reference" && (
                  <div className="fade-in" style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--amber-light)", border: "1px solid #fde68a", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <Icon icon={Alert01Icon} size={16} color="#92400e" />
                    <p style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.5 }}>
                      This bank blocks requests from outside Ethiopia.{" "}
                      <a href="https://github.com/1RB/cheki#self-hosting" target="_blank" rel="noopener" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>Self-host</a>, or just click Verify and we&apos;ll guide you through a 10-second browser fallback.
                    </p>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                    {inputMode === "url" ? "Receipt URL or link" : t("hero.referenceLabel")}
                  </label>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()} placeholder={inputMode === "url" ? "Paste receipt link..." : t("hero.referencePlaceholder")} style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }} spellCheck={false} autoCapitalize="characters" />
                  {reference && inputMode === "reference" && detectBank(reference) && (
                    <p style={{ fontSize: "12px", color: "var(--green)", marginTop: "6px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Icon icon={Search01Icon} size={12} color="var(--green)" /> Detected: {banks.find((b) => b.code === detectBank(reference))?.name}
                    </p>
                  )}
                  {reference && inputMode === "url" && reference.startsWith("http") && (
                    <p style={{ fontSize: "12px", color: "var(--green)", marginTop: "6px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Icon icon={Search01Icon} size={12} color="var(--green)" /> Bank will be auto-detected from URL
                    </p>
                  )}
                </div>

                {/* QR paste collapsible (for BOA inter-bank transfers) */}
                {showQrPaste && (
                  <div className="fade-in">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>BOA QR code payload</label>
                    <textarea value={qrData} onChange={(e) => setQrData(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !loading && handleVerify()} placeholder="Paste the encrypted QR payload from a BOA receipt..." style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)", minHeight: "100px", resize: "vertical" }} spellCheck={false} />
                    <button onClick={() => { setShowQrPaste(false); setQrData(""); }} style={{ fontSize: "12px", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: "4px" }}>Cancel</button>
                  </div>
                )}

                {!showQrPaste && inputMode === "reference" && (
                  <button onClick={() => { setShowQrPaste(true); setBank("boa"); }} style={{ fontSize: "12px", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "0", textAlign: "left", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Icon icon={QrCode01Icon} size={12} color="var(--ink-3)" /> Or paste BOA QR payload
                  </button>
                )}

                {needsAccount && inputMode === "reference" && (
                  <div className="fade-in">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>{selectedBank.accountLabel || t("hero.accountLabel")}</label>
                    <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()} placeholder={`Last ${selectedBank.accountDigits} digits minimum`} style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }} spellCheck={false} />
                  </div>
                )}

                {needsPhone && inputMode === "reference" && (
                  <div className="fade-in">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>Payer phone number</label>
                    <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="2519XXXXXXXXX" style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }} spellCheck={false} />
                  </div>
                )}

                <button onClick={handleVerify} disabled={loading || (inputMode === "reference" && isDisabled) || (!showQrPaste && !reference.trim()) || (showQrPaste && !qrData.trim())} style={{
                  width: "100%", padding: "14px 24px", fontSize: "15px", fontWeight: 600, border: "none", borderRadius: "8px",
                  background: loading || (inputMode === "reference" && isDisabled) || (!showQrPaste && !reference.trim()) || (showQrPaste && !qrData.trim()) ? "var(--border)" : "var(--green)",
                  color: loading || (inputMode === "reference" && isDisabled) || (!showQrPaste && !reference.trim()) || (showQrPaste && !qrData.trim()) ? "var(--ink-3)" : "#fff",
                  cursor: loading || (inputMode === "reference" && isDisabled) || (!showQrPaste && !reference.trim()) || (showQrPaste && !qrData.trim()) ? "not-allowed" : "pointer",
                  transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px",
                }}>
                  {loading ? (<><span className="spin" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} /><span key="loading" className="t-text-swap-enter">{t("hero.verifying")}</span></>) : (inputMode === "reference" && isDisabled) ? <span key="disabled" className="t-text-swap-enter">{t("banks.inDevelopment")}</span> : <span key="idle" className="t-text-swap-enter">{t("hero.verifyButton")}</span>}
                </button>
              </div>
            ) : null}

            {history.length > 0 && !result && !loading && (
                <div style={{ marginTop: "14px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Recent checks</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {history.map((h, i) => (
                      <button key={i} onClick={() => { setReference(h.ref); setInputMode("reference"); }} style={{ padding: "5px 10px", fontSize: "12px", fontFamily: "var(--mono)", border: "1px solid var(--border)", borderRadius: "20px", background: "var(--surface)", color: "var(--ink-2)", cursor: "pointer" }}>{h.ref.length > 20 ? h.ref.slice(0, 20) + "..." : h.ref}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Result */}
        {result && result.success && (
          <section className="container-narrow" style={{ marginBottom: "32px", padding: "0 24px" }}>
            <div ref={resultRef}><ReceiptCard result={result} copied={copied} onCopy={copyResult} /></div>
          </section>
        )}

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <section className="container-narrow" style={{ marginBottom: "32px", padding: "0 24px" }}>
            <div className="fade-up" style={{ padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>Batch verification</h3>
                <button onClick={() => setBatchResults([])} style={{ fontSize: "12px", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {batchResults.map((r, i) => (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: r.status === "done" && r.data?.success ? "var(--green-light)" : r.status === "error" ? "var(--red-light)" : "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: r.data?.success ? "8px" : 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--mono)", wordBreak: "break-all" }}>{r.fileName}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: r.status === "done" && r.data?.success ? "var(--green)" : r.status === "error" ? "var(--red)" : "var(--border)", color: r.status === "done" && r.data?.success || r.status === "error" ? "#fff" : "var(--ink-3)" }}>
                        {r.status === "scanning" ? "Scanning..." : r.status === "verifying" ? "Verifying..." : r.status === "error" ? "Failed" : r.data?.success ? "Verified" : "Not found"}
                      </span>
                    </div>
                    {r.data?.success && (
                      <div style={{ fontSize: "12px", color: "var(--ink-2)", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {r.data.senderName && <span>From: {r.data.senderName}</span>}
                        {r.data.receiverName && <span>To: {r.data.receiverName}</span>}
                        {r.data.amount != null && <span style={{ fontWeight: 600 }}>{r.data.amount} {r.data.currency || "ETB"}</span>}
                        {r.data.reference && <span style={{ fontFamily: "var(--mono)", color: "var(--ink-3)" }}>{r.data.reference}</span>}
                      </div>
                    )}
                    {r.status === "error" && r.error && (
                      <p style={{ fontSize: "12px", color: "var(--red)", marginTop: "4px" }}>{r.error}</p>
                    )}
                    {r.status === "done" && !r.data?.success && r.data?.error && (
                      <p style={{ fontSize: "12px", color: "var(--red)", marginTop: "4px" }}>{r.data.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Error / Fallback */}
        {error && !showFallback && (
          <section className="container-narrow" style={{ marginBottom: "32px", padding: "0 24px" }}>
            <div className="t-shake" style={{ padding: "16px 20px", borderRadius: "8px", background: "var(--red-light)", border: "1px solid #fecaca" }}>
              <p style={{ color: "var(--red)", fontSize: "14px", fontWeight: 500 }}>{error}</p>
              {error && bank === "boa" && (error.includes("Invalid reference") || error.includes("Receipt not found") || error.includes("not found or invalid")) && (
                <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "8px" }}>This is likely an inter-bank transfer (BOA to CBE or another bank). BOA's API doesn't index these. Try scanning the QR code on the receipt instead.</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icon icon={QrCode01Icon} size={14} color="var(--ink)" /> Upload QR image
                    </button>
                    <button onClick={() => { setShowQrPaste(true); setBank("boa"); }} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icon icon={QrCode01Icon} size={14} color="var(--ink)" /> Paste QR payload
                    </button>
                    <button onClick={() => showScanner ? (setShowScanner(false), stopScanner()) : startScanner()} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icon icon={Camera01Icon} size={14} color="var(--ink)" /> Scan with camera
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Smart Fallback for geo-blocked banks */}
        {showFallback && (
          <section className="container-narrow" style={{ marginBottom: "32px", padding: "0 24px" }}>
            <div className="fade-up" style={{ borderRadius: "12px", background: "var(--amber-light)", border: "1px solid #fde68a", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #fde68a" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <Icon icon={Alert01Icon} size={20} color="#92400e" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#92400e", marginBottom: "4px" }}>
                      {selectedBank.name} blocks cheki's server
                    </p>
                    <p style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.5 }}>
                      The receipt endpoint only allows Ethiopian IP addresses. But your browser can reach it. Verify in 10 seconds:
                    </p>
                  </div>
                  <button onClick={() => setShowFallback(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e", fontSize: "18px", padding: "0 4px", lineHeight: 1 }}>x</button>
                </div>
              </div>

              {/* Step 1: Open receipt */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #fde68a" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Step 1: Open your receipt</p>
                <a href={fallbackBankUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600, textDecoration: "none", width: "fit-content" }}>
                  <Icon icon={ArrowRight01Icon} size={16} color="#fff" />
                  Open receipt page
                </a>
                <p style={{ fontSize: "11px", color: "#92400e", marginTop: "6px", fontFamily: "var(--mono)", wordBreak: "break-all", opacity: 0.7 }}>{fallbackBankUrl}</p>
              </div>

              {/* Step 2: Bring data back, tabs */}
              <div style={{ padding: "14px 20px" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Step 2: Bring the data back to cheki</p>

                {/* Tab switcher */}
                <div style={{ display: "flex", gap: "0", marginBottom: "14px", borderBottom: "1px solid #fde68a" }}>
                  <button onClick={() => setFallbackTab("paste")} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 600, border: "none", borderBottom: fallbackTab === "paste" ? "2px solid #92400e" : "2px solid transparent", background: "transparent", color: fallbackTab === "paste" ? "#92400e" : "#b45309", cursor: "pointer", marginBottom: "-1px" }}>
                    Copy and Paste {isMobile ? "(recommended)" : ""}
                  </button>
                  <button onClick={() => setFallbackTab("bookmarklet")} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 600, border: "none", borderBottom: fallbackTab === "bookmarklet" ? "2px solid #92400e" : "2px solid transparent", background: "transparent", color: fallbackTab === "bookmarklet" ? "#92400e" : "#b45309", cursor: "pointer", marginBottom: "-1px" }}>
                    Bookmarklet {!isMobile ? "(recommended)" : ""}
                  </button>
                </div>

                {/* Paste tab */}
                {fallbackTab === "paste" && (
                  <div className="fade-in">
                    <div style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.6, marginBottom: "10px" }}>
                      <p style={{ marginBottom: "4px" }}>1. Open the receipt page (Step 1 above)</p>
                      <p style={{ marginBottom: "4px" }}>2. Long press on the page, then Select All, then Copy</p>
                      <p style={{ marginBottom: "10px" }}>3. Come back here and paste into the box below</p>
                    </div>
                    <textarea
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      placeholder="Paste the receipt page content here..."
                      style={{ width: "100%", padding: "12px 14px", fontSize: "13px", border: "1px solid #fde68a", borderRadius: "8px", background: "#fff", color: "var(--ink)", fontFamily: "var(--mono)", minHeight: "120px", resize: "vertical" }}
                      spellCheck={false}
                    />
                    <button
                      onClick={handleFallbackVerify}
                      disabled={fallbackLoading || !pasteContent.trim()}
                      style={{ width: "100%", marginTop: "10px", padding: "12px 20px", fontSize: "14px", fontWeight: 600, border: "none", borderRadius: "8px", background: fallbackLoading || !pasteContent.trim() ? "#d4d4d4" : "var(--green)", color: fallbackLoading || !pasteContent.trim() ? "#999" : "#fff", cursor: fallbackLoading || !pasteContent.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px" }}
                    >
                      {fallbackLoading ? (<><span className="spin" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} /> Parsing...</>) : "Verify pasted content"}
                    </button>
                    {fallbackError && (
                      <div className="t-shake" style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "8px", background: "var(--red-light)", border: "1px solid #fecaca" }}>
                        <p style={{ fontSize: "13px", color: "var(--red)" }}>{fallbackError}</p>
                      </div>
                    )}
                    {fallbackResult && fallbackResult.success && (
                      <div className="fade-up" style={{ marginTop: "10px" }}>
                        <ReceiptCard result={fallbackResult} copied={copied} onCopy={copyResult} />
                      </div>
                    )}
                  </div>
                )}

                {/* Bookmarklet tab */}
                {fallbackTab === "bookmarklet" && (
                  <div className="fade-in">
                    <div style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.6, marginBottom: "12px" }}>
                      <p style={{ marginBottom: "6px", fontWeight: 600 }}>One-time setup (30 seconds):</p>
                      <p style={{ marginBottom: "4px" }}>1. Drag the button below to your bookmarks bar</p>
                      <p style={{ marginBottom: "4px" }}>2. Open any Telebirr or M-Pesa receipt page</p>
                      <p style={{ marginBottom: "10px" }}>3. Click the "Verify with cheki" bookmark</p>
                    </div>

                    {/* Draggable bookmarklet */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                      <a
                        href={bookmarkletUrl}
                        onClick={(e) => { e.preventDefault(); copyBookmarklet(); }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "10px 18px", borderRadius: "8px",
                          background: "var(--green)", color: "#fff",
                          fontSize: "14px", fontWeight: 600, textDecoration: "none",
                          cursor: "grab", userSelect: "none",
                          border: "2px dashed rgba(255,255,255,0.4)",
                        }}
                        title="Drag me to your bookmarks bar"
                      >
                        <Icon icon={CheckmarkCircle01Icon} size={16} color="#fff" />
                        Verify with cheki
                      </a>
                      <span style={{ fontSize: "11px", color: "#92400e", opacity: 0.7 }}>
                        {isMobile ? "Long press, copy, then add as bookmark" : "Drag to bookmarks bar"}
                      </span>
                    </div>

                    {bookmarkletCopied && (
                      <div className="fade-in" style={{ padding: "8px 12px", borderRadius: "6px", background: "var(--green-light)", border: "1px solid var(--green-light)", marginBottom: "10px" }}>
                        <p style={{ fontSize: "12px", color: "var(--green-dark)", fontWeight: 500 }}>
                          Copied. On mobile: create a new bookmark, paste this as the URL. On desktop: drag to your bookmarks bar.
                        </p>
                      </div>
                    )}

                    <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.5)", border: "1px solid #fde68a" }}>
                      <p style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.5 }}>
                        After installing, the bookmarklet reads the receipt page and sends it to cheki for parsing. An overlay appears on the page showing the verified result. No data is stored.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* How it works - terminal-style list, not cards */}
        <section className="container" style={{ paddingTop: "32px", marginTop: "24px" }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px" }}>
            The banks publish receipts on public URLs
          </h2>
          <p style={{ color: "var(--ink-2)", fontSize: "16px", maxWidth: "600px", marginBottom: "20px", lineHeight: 1.5 }}>
            Every Ethiopian bank and mobile wallet publishes transaction receipts at a publicly accessible URL. No authentication required. cheki fetches these URLs, parses the response, and returns clean JSON. That is all receipt verification services do. The difference is that cheki does it for free and shows you the source URL.
          </p>
          <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f57" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#febc2e" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#28c840" }} />
              <span style={{ fontSize: "12px", color: "var(--ink-3)", marginLeft: "8px", fontFamily: "var(--mono)" }}>cheki --list-endpoints</span>
            </div>
            <div className="endpoint-list" style={{ padding: "6px 0" }}>
              {banks.filter((b) => b.status === "live").map((b, i, arr) => (
                <a
                  key={b.code}
                  href={`/banks/${b.code}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr auto",
                    gap: "12px",
                    padding: "10px 16px",
                    alignItems: "center",
                    textDecoration: "none",
                    borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--border)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: b.color, marginRight: "8px", verticalAlign: "middle" }} />
                    {b.shortName}
                  </span>
                  <span style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.endpointFormat}
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "3px", background: b.geoBlocked ? "var(--amber-light)" : "var(--green-light)", color: b.geoBlocked ? "#92400e" : "var(--green-dark)", whiteSpace: "nowrap" }}>
                    {b.geoBlocked ? "ET only" : "Global"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* The Scam / Comparison - single panel, inline columns */}

        <section className="container" style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "20px" }}>
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="bento-grid">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={i === 0 ? "bento-wide" : ""}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: i === 0 ? "row" : "column",
                  alignItems: i === 0 ? "center" : "flex-start",
                  gap: i === 0 ? "16px" : "10px",
                }}
              >
                <div style={{ marginBottom: i === 0 ? 0 : "10px", flexShrink: 0 }}><Icon icon={f.icon} size={i === 0 ? 32 : 24} color="var(--green)" /></div>
                <div>
                  <h3 style={{ fontSize: i === 0 ? "18px" : "15px", fontWeight: 700, marginBottom: "4px" }}>{f.title}</h3>
                  <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Guides discovery - featured + list layout */}
        <section className="container" style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Guides and articles
            </h2>
            <a href="/guides" style={{ fontSize: "14px", color: "var(--green)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
              All {articles.length} articles →
            </a>
          </div>
          <div className="bento-grid">
            {articles
              .filter((a) => ["boa-qr-code-receipts", "free-receipt-verification-no-api-key", "contribute-new-bank", "cbe-receipt-qr-code", "payment-fraud-ethiopia", "check-et-vs-verify-et-vs-cheki"].includes(a.slug))
              .slice(0, 6)
              .map((a, i) => (
                <a
                  key={a.slug}
                  href={`/guides/${a.slug}`}
                  className={i === 0 ? "bento-wide" : ""}
                  style={{
                    padding: i === 0 ? "28px" : "20px",
                    borderRadius: "12px",
                    background: i === 0 ? "var(--surface)" : "var(--surface)",
                    border: i === 0 ? "1px solid var(--green-light)" : "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: i === 0 ? "12px" : "8px",
                    textDecoration: "none",
                    minHeight: i === 0 ? "auto" : "100%",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: i === 0 ? "var(--green)" : "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {a.category.replace("-", " ")}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>{a.readTime}</span>
                  </div>
                  <h3 style={{ fontSize: i === 0 ? "22px" : "15px", fontWeight: 700, lineHeight: 1.3 }}>{a.title}</h3>
                  <p style={{ fontSize: i === 0 ? "15px" : "13px", color: "var(--ink-2)", lineHeight: 1.5, flex: 1 }}>{a.excerpt}</p>
                  <span style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>{i === 0 ? "Read full article →" : "Read →"}</span>
                </a>
              ))}
          </div>
        </section>

        {/* Supported Banks */}
        <section className="container" style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "10px" }}>
            {banks.length} banks and wallets supported
          </h2>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", marginBottom: "20px" }}>
            {banks.filter((b) => b.status === "live").length} live now, {banks.filter((b) => b.status === "soon").length} in development. All use public endpoints.
          </p>
          <div className="bank-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {banks.map((b) => (
              <a key={b.code} href={`/banks/${b.code}`} style={{ padding: "12px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" }}>
                <BankLogoByName code={b.code} size={32} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.shortName}</p>
                  <p style={{ fontSize: "10px", color: b.status === "live" ? "var(--green)" : "var(--ink-3)" }}>{b.status === "live" ? "Live" : "In development"}</p>
                </div>
              </a>
            ))}
          </div>
          <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--ink-3)" }}>
            {banks.filter((b) => b.status === "soon").length - 4} more banks researching. <a href="/banks" style={{ color: "var(--green)", fontWeight: 600 }}>Help us add them →</a>
          </p>
        </section>
        <section className="container" style={{ marginTop: "40px" }}>
          <div style={{ padding: "28px", borderRadius: "16px", background: "var(--ink)", color: "#fff" }}>
            <div className="grid-2" style={{ alignItems: "center", gap: "24px" }}>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Open source</p>
                <h2 style={{ fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, marginBottom: "14px", letterSpacing: "-0.02em" }}>
                  Built by the community, for the community
                </h2>
                <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: "20px" }}>
                  cheki is MIT licensed and lives on GitHub. No company owns it. No one can shut it down. If a bank changes their endpoint, anyone can submit a fix.
                </p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Icon icon={StarIcon} size={16} color="#fff" /> Star on GitHub
                  </a>
                  <a href="https://github.com/1RB/cheki/blob/main/README.md#contributing" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Icon icon={GithubIcon} size={16} color="#fff" /> Contribute
                  </a>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: "License", value: "MIT" },
                  { label: "Language", value: "TypeScript + Python" },
                  { label: "Framework", value: "Next.js 16" },
                  { label: "Architecture", value: "Hexagonal / Ports" },
                  { label: "Tests", value: "87 (vitest)" },
                  { label: "Banks", value: `${banks.length} (${banks.filter((b) => b.status === "live").length} live)` },
                  { label: "CLI", value: "cheki verify, info, health" },
                  { label: "Self-hosting", value: "Docker included" },
                  { label: "SDK", value: "TS, Python, Dart, PHP, Go" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{item.label}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}

function AnimatedAmount({ value }: { value: string }) {
  // transitions.dev number pop-in: split into digit spans with stagger
  const chars = [...value];
  let digitIdx = 0;
  return (
    <span className="t-digit-group is-animating">
      {chars.map((ch, i) => {
        if (/\d/.test(ch)) {
          const stagger = Math.min(digitIdx % 3, 2);
          digitIdx++;
          return <span key={i} className="t-digit" data-stagger={stagger}>{ch}</span>;
        }
        return <span key={i}>{ch}</span>;
      })}
    </span>
  );
}

function ReceiptCard({ result, copied, onCopy }: { result: VerifyResult; copied: boolean; onCopy: () => void }) {
  // transitions.dev: panel reveal + success check animations
  const [revealed, setRevealed] = useState(false);
  const [checkState, setCheckState] = useState<"out" | "in">("out");
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    const timer = setTimeout(() => setCheckState("in"), 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []);

  if (!result.verified) return null;
  const rows: { label: string; value: string | undefined; mono?: boolean }[] = [
    { label: "Bank", value: result.bank },
    { label: "Reference", value: result.reference, mono: true },
    { label: "Invoice No", value: result.invoiceNumber, mono: true },
    { label: "Status", value: result.transactionStatus || "Verified" },
    { label: "Amount", value: result.amount != null ? `${result.amount.toLocaleString()} ${result.currency || "ETB"}` : undefined, mono: true },
    { label: "Sender", value: result.senderName },
    { label: "Sender Account", value: result.senderAccount, mono: true },
    { label: "Receiver", value: result.receiverName },
    { label: "Receiver Account", value: result.receiverAccount, mono: true },
    { label: "Bank Account", value: result.bankAccountNumber, mono: true },
    { label: "Bank Account Name", value: result.bankAccountName },
    { label: "Date", value: result.date, mono: true },
    { label: "Branch", value: result.branch },
    { label: "Reason", value: result.reason },
    { label: "Payment Mode", value: result.paymentMode },
    { label: "Payment Channel", value: result.paymentChannel },
  ];

  // Fee breakdown section (Telebirr)
  const hasFees = result.settledAmount != null || result.serviceFee != null || result.totalPaid != null;
  const feeRows: { label: string; value: string | undefined; mono?: boolean; bold?: boolean }[] = [
    { label: "Settled Amount", value: result.settledAmount != null ? `${result.settledAmount.toLocaleString()} ETB` : undefined, mono: true },
    { label: "Stamp Duty", value: result.stampDuty != null ? `${result.stampDuty} ETB` : undefined, mono: true },
    { label: "Discount", value: result.discountAmount != null ? `${result.discountAmount} ETB` : undefined, mono: true },
    { label: "Service Fee", value: result.serviceFee != null ? `${result.serviceFee} ETB` : undefined, mono: true },
    { label: "Service Fee VAT", value: result.serviceFeeVat != null ? `${result.serviceFeeVat} ETB` : undefined, mono: true },
    { label: "Total Paid", value: result.totalPaid != null ? `${result.totalPaid.toLocaleString()} ETB` : undefined, mono: true, bold: true },
  ];
  const visibleFeeRows = feeRows.filter((r) => r.value);
  const visibleRows = rows.filter((r) => r.value);

  return (
    <section className="t-panel-slide" data-open={revealed} style={{ borderRadius: "12px", overflow: "hidden", background: "var(--receipt-bg)", border: "1px solid var(--dotted)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "20px 24px", borderBottom: "2px dotted var(--dotted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="t-success-check" data-state={checkState}>
            <Icon icon={CheckmarkCircle01Icon} size={24} color="var(--green)" />
          </span>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>receipt verified</span>
        </div>
        <button onClick={onCopy} style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 500, border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface)", color: copied ? "var(--green)" : "var(--ink-2)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
          <Icon icon={copied ? CopyCheckIcon : Copy01Icon} size={14} color={copied ? "var(--green)" : "var(--ink-2)"} />
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div style={{ padding: "8px 24px" }}>
        {visibleRows.map((row, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0" }}>
              <span style={{ fontSize: "13px", color: "var(--ink-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: "15px", color: "var(--ink)", textAlign: "right", fontFamily: row.mono ? "var(--mono)" : "var(--sans)", fontWeight: row.mono ? 500 : 400, wordBreak: "break-word" }}>{row.label === "Amount" && row.value ? <AnimatedAmount value={row.value} /> : row.value}</span>
            </div>
            {i < visibleRows.length - 1 && <hr className="dotted-line" />}
          </div>
        ))}
      </div>
      {visibleFeeRows.length > 0 && (
        <div style={{ padding: "8px 24px", borderTop: "2px dotted var(--dotted)" }}>
          <p style={{ fontSize: "11px", color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 0 4px" }}>Fee breakdown</p>
          {visibleFeeRows.map((row, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0" }}>
                <span style={{ fontSize: "13px", color: "var(--ink-3)", fontWeight: 500, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: "14px", color: row.bold ? "var(--ink)" : "var(--ink-2)", textAlign: "right", fontFamily: "var(--mono)", fontWeight: row.bold ? 700 : 400 }}>{row.value}</span>
              </div>
              {i < visibleFeeRows.length - 1 && <hr className="dotted-line" />}
            </div>
          ))}
          {result.amountInWords && (
            <p style={{ fontSize: "12px", color: "var(--ink-3)", fontStyle: "italic", padding: "10px 0 4px", textTransform: "capitalize" }}>{result.amountInWords}</p>
          )}
        </div>
      )}
      {result.sourceUrl && (
        <div style={{ padding: "16px 24px", borderTop: "2px dotted var(--dotted)", background: "rgba(0,0,0,0.02)" }}>
          <p style={{ fontSize: "11px", color: "var(--ink-3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Source (public bank endpoint)</p>
          <p style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-2)", wordBreak: "break-all" }}>{result.sourceUrl}</p>
        </div>
      )}
    </section>
  );
}
