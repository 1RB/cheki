"use client";

/**
 * "Help us add <Bank>" box, shown where the BankChecker would sit on the page
 * of a provider that is still in development. Sends a receipt link, a
 * screenshot, or a reference plus phone/account to POST /api/contribute, which
 * forwards it privately to the maintainers. Nothing is stored on cheki.
 *
 * Screenshots are handled on the device first: a QR code holding the receipt
 * link is decoded and only the link is sent. Otherwise the image is redrawn
 * through a canvas to JPEG, which drops EXIF and other metadata, and scaled
 * down before upload.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type LeadMode = "screenshot" | "link";

interface Props {
  code: string;
  shortName: string;
  requiresAccount?: boolean;
  requiresPhone?: boolean;
  accountLabel?: string;
  /** Ask for the full share link first (e.g. Zemen, where the bare reference format is unconfirmed). */
  preferLink?: boolean;
  linkExample?: string;
  /** "link" when the bank's receipt URL template is known, otherwise lead with a screenshot. */
  lead?: LeadMode;
}

interface Shot {
  blob: Blob;
  url: string;
}

const PROBE_URL = "https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md#1-probe-your-own-receipt-locally";
const MAX_EDGE = 1600;
const QR_EDGES = [2000, 1000];
const MAX_UPLOAD = 3 * 1024 * 1024;
const MAX_RAW = 25 * 1024 * 1024;

function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function decodeImage(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function drawScaled(src: CanvasImageSource, w: number, h: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Returns a QR link found in the image, or a metadata-free JPEG of it. */
async function processScreenshot(file: Blob): Promise<{ link: string } | { blob: Blob }> {
  const img = await decodeImage(file);
  try {
    for (const edge of QR_EDGES) {
      const { canvas, ctx } = drawScaled(img.src, img.w, img.h, edge);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
      if (qr && isHttpUrl(qr.data)) return { link: qr.data.trim() };
      if (Math.max(img.w, img.h) <= edge) break;
    }
    let edge = MAX_EDGE;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { canvas } = drawScaled(img.src, img.w, img.h, edge);
      for (const q of [0.8, 0.65, 0.5]) {
        const blob = await toJpeg(canvas, q);
        if (blob && blob.size <= MAX_UPLOAD) return { blob };
      }
      edge = Math.round(edge * 0.75);
    }
    throw new Error("too large");
  } finally {
    img.close();
  }
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const srOnly: React.CSSProperties = {
  position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px",
  overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0,
};

export function ContributeBox({
  code, shortName, requiresAccount, requiresPhone, accountLabel, preferLink, linkExample, lead = "link",
}: Props) {
  const [link, setLink] = useState("");
  const [reference, setReference] = useState("");
  const [second, setSecond] = useState("");
  const [credit, setCredit] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileFocus, setFileFocus] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [sentCredit, setSentCredit] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const screenshotFirst = lead === "screenshot";
  const needsSecond = Boolean(requiresAccount || requiresPhone);
  const secondLabel = requiresPhone ? "Payer phone number" : accountLabel || "Receiving account number";
  const hasLink = link.trim().length > 0;
  const article = /^[aeiou]/i.test(shortName) ? "an" : "a";

  // Release the preview's object URL when it changes or the box unmounts.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const handleFile = useCallback(async (file: File | Blob | null | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (file.type && !file.type.startsWith("image/")) {
      setError("That file is not an image. Upload a screenshot of the receipt.");
      return;
    }
    if (file.size > MAX_RAW) {
      setError("That image is too large. Crop it and try again.");
      return;
    }
    setReading(true);
    try {
      const result = await processScreenshot(file);
      if ("link" in result) {
        setLink(result.link);
        setShot(null);
        setNotice("Found the receipt link in your screenshot. We'll send just the link.");
      } else {
        setShot({ blob: result.blob, url: URL.createObjectURL(result.blob) });
      }
    } catch {
      setError("We could not read that image. Try a PNG or JPEG screenshot.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  // Paste an image anywhere on the page (Ctrl+V / Cmd+V). Text pastes are left alone.
  useEffect(() => {
    if (done) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      void handleFile(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [done, handleFile]);

  function removeShot() {
    setShot(null);
    fileRef.current?.focus();
  }

  async function copyPageLink() {
    const url = `${window.location.origin}/banks/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied.");
    } catch {
      setCopied(`Copy this link: ${url}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ref = reference.trim();
    if (!hasLink && !ref && !shot) {
      setError(screenshotFirst
        ? "Add a screenshot, paste the receipt link, or enter the reference."
        : "Paste the receipt link, add a screenshot, or enter the reference.");
      return;
    }
    if (!hasLink && !shot && needsSecond && !second.trim()) {
      setError(`Add the ${secondLabel.toLowerCase()}, or paste the full receipt link.`);
      return;
    }
    if (!consent) {
      setError("Tick the box to confirm the receipt is yours to share.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("bank", code);
      if (hasLink) form.append("link", link.trim());
      else if (ref) form.append("reference", ref);
      if (second.trim()) form.append("phoneOrAccount", second.trim());
      if (credit.trim()) form.append("credit", credit.trim());
      form.append("consent", consent ? "true" : "false");
      form.append("website", website);
      if (shot) form.append("image", shot.blob, "receipt.jpg");
      const resp = await fetch("/api/contribute", { method: "POST", body: form });
      const data: { success: boolean; error?: string; message?: string } = await resp.json();
      if (!data.success) {
        setError(data.error || "Something went wrong. Nothing was saved.");
      } else {
        setDone(data.message || "Thanks. Your receipt was sent privately to the maintainers.");
        setSentCredit(credit.trim());
        setLink("");
        setReference("");
        setSecond("");
        setShot(null);
        setNotice(null);
      }
    } catch {
      setError("Network error. Nothing was saved. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)",
    fontSize: "15px", minWidth: 0,
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px",
  };
  const hint: React.CSSProperties = {
    fontSize: "12px", color: "var(--ink-3)", marginTop: "6px", lineHeight: 1.5, overflowWrap: "anywhere",
  };
  const linkBtn: React.CSSProperties = {
    background: "none", border: "none", padding: 0, color: "var(--green-dark)", fontSize: "13px",
    fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px",
  };

  const linkField = (
    <div style={{ marginBottom: "12px" }}>
      <label htmlFor="contrib-link" style={screenshotFirst ? { ...label, fontWeight: 500, color: "var(--ink-3)" } : label}>
        {screenshotFirst ? "Or paste a share link, if your app has one" : `${shortName} receipt share link${preferLink ? " (preferred)" : ""}`}
      </label>
      <input
        id="contrib-link"
        name="link"
        type="url"
        style={field}
        value={link}
        onChange={(e) => { setLink(e.target.value); setNotice(null); }}
        placeholder="https://..."
        autoComplete="off"
        spellCheck={false}
        aria-describedby={!screenshotFirst && linkExample ? "contrib-link-hint" : undefined}
      />
      {!screenshotFirst && linkExample && (
        <p id="contrib-link-hint" style={hint}>
          From the share button. It looks like <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{linkExample}</span>
        </p>
      )}
    </div>
  );

  const shotField = shot ? (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt="Preview of your receipt screenshot" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: "13px", color: "var(--ink-2)" }}>
          Screenshot ready ({formatSize(shot.blob.size)})
        </span>
        <button type="button" onClick={removeShot} style={{ ...linkBtn, flexShrink: 0 }}>
          Remove
        </button>
      </div>
      <p style={hint}>Make sure names and balances are cropped or covered.</p>
    </div>
  ) : (
    <div style={{ marginBottom: "12px" }}>
      <label
        htmlFor="contrib-image"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        style={{
          display: "flex", flexDirection: screenshotFirst ? "column" : "row", alignItems: "center",
          justifyContent: "center", gap: screenshotFirst ? "2px" : "8px", flexWrap: "wrap", textAlign: "center",
          padding: screenshotFirst ? "14px 12px" : "10px 12px", borderRadius: "8px", cursor: reading ? "wait" : "pointer",
          border: `1px dashed ${dragging || fileFocus ? "var(--green-dark)" : "var(--border)"}`,
          outline: fileFocus ? "2px solid var(--green-dark)" : "none", outlineOffset: "2px",
          background: dragging ? "var(--green-light)" : "var(--bg)",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--green-dark)" }}>
          {reading ? "Reading screenshot..." : screenshotFirst ? "Choose a screenshot" : "Or upload a screenshot"}
        </span>
        {screenshotFirst && (
          <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>or drop or paste it here</span>
        )}
      </label>
      <input
        ref={fileRef}
        id="contrib-image"
        name="image"
        type="file"
        accept="image/*"
        style={srOnly}
        disabled={reading}
        aria-describedby="contrib-image-hint"
        onFocus={() => setFileFocus(true)}
        onBlur={() => setFileFocus(false)}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <p id="contrib-image-hint" style={hint}>
        {screenshotFirst
          ? "Crop or cover names and balances first. If it has a QR code, we send only that link."
          : "Drop or paste works too. Crop or cover names and balances first."}
      </p>
    </div>
  );

  return (
    <section
      id="contribute"
      aria-labelledby="contribute-title"
      style={{
        position: "relative", padding: "clamp(16px, 4vw, 22px)", borderRadius: "12px", background: "var(--surface)",
        border: "1px solid var(--border)", marginBottom: "40px", maxWidth: "680px",
      }}
    >
      <h2 id="contribute-title" style={{ fontSize: "19px", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "6px" }}>
        Help us add {shortName}
      </h2>
      <p style={{ color: "var(--ink-2)", fontSize: "14px", lineHeight: 1.55, marginBottom: "12px" }}>
        {screenshotFirst
          ? `${shortName} checks are not live yet, and we have not found its receipt link. A screenshot of one real receipt helps us find it.`
          : `${shortName} checks are not live yet. One real receipt link is enough for us to build and test the parser.`}
      </p>
      <p style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--green-light)", color: "var(--ink-2)", fontSize: "13px", lineHeight: 1.5, marginBottom: "14px" }}>
        <strong style={{ color: "var(--ink)" }}>Private.</strong> Sent only to the maintainers, used to build the parser, deleted after it ships.
      </p>

      {done ? (
        <div>
          <p role="status" style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--green-light)", color: "var(--green-dark)", fontSize: "14px", fontWeight: 600, lineHeight: 1.5 }}>
            {done} {sentCredit ? `We will credit ${sentCredit} when ${shortName} goes live.` : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px 16px", flexWrap: "wrap", marginTop: "12px" }}>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, flex: "1 1 220px" }}>
              Know someone with {article} {shortName} account? Share this page.
            </p>
            <button
              type="button"
              onClick={copyPageLink}
              style={{
                padding: "9px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)",
                color: "var(--ink)", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              }}
            >
              Copy link
            </button>
          </div>
          <p role="status" style={{ ...hint, minHeight: copied ? undefined : 0 }}>{copied}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {screenshotFirst ? (
            <div role="group" aria-labelledby="contrib-lead">
              <p id="contrib-lead" style={label}>Upload a screenshot or paste a share link</p>
              {shotField}
              {linkField}
            </div>
          ) : (
            <>
              {linkField}
              {shotField}
            </>
          )}

          {notice && (
            <p role="status" style={{ margin: "-4px 0 12px", padding: "8px 12px", borderRadius: "8px", background: "var(--green-light)", color: "var(--green-dark)", fontSize: "13px", fontWeight: 600, lineHeight: 1.5 }}>
              {notice}
            </p>
          )}

          <div style={{ marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setShowRef((v) => !v)}
              aria-expanded={showRef}
              aria-controls="contrib-ref-fields"
              style={linkBtn}
            >
              No link? Use the reference instead
              <span aria-hidden="true" style={{ display: "inline-block", marginLeft: "6px", transform: showRef ? "rotate(180deg)" : "none" }}>▾</span>
            </button>
            <div id="contrib-ref-fields" hidden={!showRef} style={{ marginTop: "12px" }}>
              <div style={{ marginBottom: "12px" }}>
                <label htmlFor="contrib-ref" style={label}>Transaction reference</label>
                <input
                  id="contrib-ref"
                  name="reference"
                  style={field}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label htmlFor="contrib-second" style={label}>
                  {needsSecond ? secondLabel : "Phone or account number (optional)"}
                </label>
                <input
                  id="contrib-second"
                  name="phoneOrAccount"
                  style={field}
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={requiresPhone ? "2519XXXXXXXX" : ""}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="contrib-credit" style={label}>Name or handle for credit (optional)</label>
            <input
              id="contrib-credit"
              name="credit"
              style={field}
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
              placeholder="@yourhandle, or leave blank"
            />
          </div>

          {/* Honeypot for bots. Hidden from people and screen readers. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
            <label htmlFor="contrib-website">Website</label>
            <input id="contrib-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <label htmlFor="contrib-consent" style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "14px", cursor: "pointer" }}>
            <input
              id="contrib-consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0 }}
            />
            <span>This receipt is mine to share, and I agree to send it to the cheki maintainers to build the parser.</span>
          </label>

          <button
            type="submit"
            disabled={loading || reading}
            style={{
              width: "100%", padding: "12px 24px", borderRadius: "8px", border: "none",
              background: "var(--green-cta)", color: "var(--green-cta-fg)",
              fontSize: "15px", fontWeight: 600, cursor: loading || reading ? "wait" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send privately"}
          </button>
          <p style={{ ...hint, marginTop: "10px", textAlign: "center" }}>
            Developer?{" "}
            <a href={PROBE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)" }}>
              Test your receipt locally instead.
            </a>
          </p>
        </form>
      )}

      {error && (
        <p role="alert" style={{ marginTop: "14px", padding: "10px 12px", borderRadius: "8px", background: "var(--amber-light)", color: "var(--amber-text)", fontSize: "14px" }}>
          {error}
        </p>
      )}
    </section>
  );
}
