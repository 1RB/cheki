"use client";

/**
 * The receipt checker. Rendered on the homepage (any bank, auto-detected) and
 * on every live /banks/[code] page (locked to that bank).
 *
 * Flow: one smart input -> live detection -> one request -> one verdict.
 *   - Enter submits; a link, BOA QR payload or image pasted anywhere on the
 *     page is checked straight away.
 *   - Telebirr / M-Pesa lead with "Open the receipt" and the paste/bookmarklet
 *     panel. No server request goes out unless the user asks for one.
 *   - Every response goes through readVerifyResponse (src/lib/verify/client.ts)
 *     and every colour through presentVerdict (src/lib/verify/verdict.ts):
 *     green only when verificationState() says "verified".
 *   - Recent checks keep bank-confirmed results only, without names.
 */
import "./verify.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { verificationState, type VerifyResult } from "@/lib/banks";
import { useTranslation } from "@/lib/i18n/use-translation";
import { isUrl } from "@/lib/adapters/url-detector";
import { isBoaQrPayload } from "@/lib/qr/decode";
import { browserReceiptUrl, detectInput, liveBanks, type Detection } from "@/lib/verify/detect";
import { postJson } from "@/lib/verify/client";
import { presentVerdict, type FraudCheck } from "@/lib/verify/verdict";
import { addVerified, clearRecent, findPrevious, loadRecent, removeRecent, type RecentCheck } from "@/lib/verify/history";
import { secondaryFormats } from "@/lib/manifest/formats";
import { useReceiptDetection } from "./use-receipt-detection";
import { VerifyInput } from "./VerifyInput";
import { VerdictCard } from "./VerdictCard";
import { VerdictSkeleton } from "./VerdictSkeleton";
import { RecentChecks } from "./RecentChecks";
import { Icon, ArrowUpRight01Icon } from "@/components/Icon";

const CameraScanner = dynamic(() => import("./CameraScanner"), { ssr: false });
const BatchPanel = dynamic(() => import("./BatchPanel"), { ssr: false });
const GeoFallback = dynamic(() => import("./GeoFallback"), { ssr: false });

type Phase = "idle" | "reading" | "checking" | "done";

interface Props {
  /** Lock the panel to one bank (the /banks/[code] pages). */
  lockedBank?: string;
  /** id of the main input; the homepage keeps "verify-reference". */
  inputId?: string;
}

interface Outcome {
  result: VerifyResult;
  checks: FraudCheck[];
  checkedAt: Date;
  bankCode?: string;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

function reduceMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function VerifyPanel({ lockedBank, inputId = "verify-reference" }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [extra, setExtra] = useState("");
  const [overrideBank, setOverrideBank] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [extraError, setExtraError] = useState<string | null>(null);
  const [history, setHistory] = useState<RecentCheck[]>([]);
  const [camera, setCamera] = useState(false);
  const [batch, setBatch] = useState<File[] | null>(null);
  const [checkingBank, setCheckingBank] = useState<string>("");
  const [forced, setForced] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { detection } = useReceiptDetection(input, { lockedBank, overrideBank, extra });
  const lockedName = lockedBank ? liveBanks.find((b) => b.code === lockedBank)?.shortName : undefined;

  // A mirror of `history` for async handlers (read only in callbacks).
  const historyRef = useRef<RecentCheck[]>([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadRecent());
  }, []);

  const verdict = useMemo(
    () =>
      outcome
        ? presentVerdict(outcome.result, { bankCode: outcome.bankCode, checkedAt: outcome.checkedAt, checks: outcome.checks, t })
        : null,
    [outcome, t]
  );

  // Bring a verdict that landed below the fold into view.
  useEffect(() => {
    if (phase !== "done" || !resultRef.current) return;
    const rect = resultRef.current.getBoundingClientRect();
    if (rect.top > window.innerHeight - 160 || rect.top < 0) {
      resultRef.current.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    }
  }, [phase, outcome]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  /**
   * Run one check. Values are passed in (not read from state) so a paste can
   * check the text it just received in the same tick.
   */
  const runCheck = useCallback(
    async (value: string, opts: { extra?: string; override?: string; force?: boolean } = {}) => {
      const d: Detection = detectInput(value, { lockedBank, overrideBank: opts.override ?? overrideBank });
      const extraValue = (opts.extra ?? extra).trim();
      setNotice(null);
      setExtraError(null);
      if (d.kind === "empty") {
        inputRef.current?.focus();
        return;
      }
      if (lockedBank && d.bank && d.bank.code !== lockedBank) return;
      if (d.kind === "unknownUrl" || !d.bank) {
        inputRef.current?.focus();
        return;
      }
      if (d.browserFirst && !opts.force) {
        // Telebirr / M-Pesa: the panel below leads; nothing is sent.
        return;
      }
      if (opts.force) setForced(true);
      if (d.needsAccount || d.needsPhone) {
        const digits = extraValue.replace(/\D/g, "");
        const phoneOk = /^(251|0)?9\d{8}$/.test(digits);
        const accountOk = digits.length >= (d.accountDigits ?? 5);
        if (d.needsPhone ? !phoneOk : !accountOk) {
          setExtraError(d.needsPhone ? t("verify.extra.phoneMissing") : t("verify.extra.accountMissing", { digits: d.accountDigits ?? 5 }));
          extraRef.current?.focus();
          return;
        }
      }

      const body: Record<string, unknown> =
        d.kind === "boaQr"
          ? { bank: "boa", qrData: d.value }
          : {
              bank: d.bank.code,
              reference: d.value,
              ...(d.needsPhone ? { phoneNumber: extraValue } : d.needsAccount ? { accountNumber: extraValue } : {}),
            };

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setCheckingBank(d.bank.shortName);
      setPhase("checking");
      setOutcome(null);
      setBatch(null);
      let result: VerifyResult;
      try {
        result = await postJson("/api/verify", body, ctrl.signal);
      } catch {
        return; // aborted by a newer check
      }
      if (ctrl.signal.aborted) return;
      const checkedAt = new Date();
      const checks: FraudCheck[] = [];
      const bankCode = d.bank.code;
      // Local reuse signal: this device already saw the same receipt confirmed.
      const earlier = findPrevious(historyRef.current, bankCode, d.value);
      if (earlier && verificationState(result) === "verified") {
        checks.push({
          id: "seen-before",
          state: "warn",
          label: t("verify.checks.seenBefore"),
          detail: t("verify.checks.seenBeforeDetail", {
            when: new Date(earlier.checkedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
          }),
        });
      }
      const nextHistory = addVerified(historyRef.current, result, { bank: bankCode, ref: d.value }, checkedAt);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setOutcome({ result, checks, checkedAt, bankCode });
      setPhase("done");
    },
    [extra, lockedBank, overrideBank, t]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setCamera(false);
      setNotice(null);
      if (files.length > 1) {
        setOutcome(null);
        setPhase("idle");
        setBatch(files.slice(0, 20));
        return;
      }
      const file = files[0];
      if (!file) return;
      setBatch(null);
      setOutcome(null);
      setPhase("reading");
      const { decodeQrFromImage } = await import("@/lib/qr/decode");
      const raw = await decodeQrFromImage(file);
      if (raw) {
        setInput(raw.trim());
        setPhase("idle");
        await runCheck(raw.trim());
        return;
      }
      try {
        const { extractTextFromImage } = await import("@/lib/ocr");
        const { parsed } = await extractTextFromImage(file);
        setPhase("idle");
        if (parsed?.reference) {
          setInput(parsed.reference);
          if (!lockedBank && parsed.bank) setOverrideBank(parsed.bank === "cbe-new" ? "cbe" : parsed.bank);
          setNotice(t("verify.photo.read"));
          focusInput();
        } else {
          setNotice(t("verify.photo.noRef"));
        }
      } catch (e) {
        setPhase("idle");
        setNotice((e as Error)?.message || t("verify.photo.failed"));
      }
    },
    [focusInput, lockedBank, runCheck, t]
  );

  const onInputPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const images = items.filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
    if (images.length) {
      e.preventDefault();
      handleFiles(images);
      return;
    }
    const text = e.clipboardData?.getData("text")?.trim() ?? "";
    if (text && (isUrl(text) || isBoaQrPayload(text))) {
      e.preventDefault();
      setInput(text);
      runCheck(text);
    }
  };

  // Paste anywhere on the page (outside other fields) checks a link, a QR
  // payload or an image. The listener reads the latest handlers from a ref.
  const latest = useRef({ runCheck, handleFiles });
  useEffect(() => {
    latest.current = { runCheck, handleFiles };
  }, [runCheck, handleFiles]);
  useEffect(() => {
    const onPaste = (e: globalThis.ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const images = items.filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
      if (images.length) {
        e.preventDefault();
        latest.current.handleFiles(images);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      if (text && (isUrl(text) || isBoaQrPayload(text))) {
        e.preventDefault();
        setInput(text);
        latest.current.runCheck(text);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setInput("");
    setExtra("");
    setOverrideBank("");
    setOutcome(null);
    setNotice(null);
    setExtraError(null);
    setBatch(null);
    setForced(false);
    setPhase("idle");
    focusInput();
  }, [focusInput]);

  const browserUrl = browserReceiptUrl(detection);
  // Telebirr / M-Pesa lead with the browser path until the user asks for a
  // server check; once there is a verdict, the card carries the next step.
  const showBrowserFirst = detection.browserFirst && !forced && phase !== "done";
  const hideSubmit = detection.browserFirst && !forced && phase === "done";
  const olderFormats = detection.bank ? secondaryFormats(detection.bank).filter((f) => f.status !== "current") : [];
  const busy = phase === "checking" || phase === "reading";
  const idleBanks = useMemo(() => {
    const names = liveBanks.map((b) => b.shortName);
    return names.length > 4 ? `${names.slice(0, 4).join(", ")} +${names.length - 4}` : names.join(", ");
  }, []);

  return (
    <div className="vp" data-phase={phase}>
      <form
        className="vp-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) runCheck(input);
        }}
      >
        {camera && (
          <CameraScanner
            t={t}
            onClose={() => setCamera(false)}
            onError={() => {
              setCamera(false);
              setNotice(t("verify.camera.denied"));
            }}
            onResult={(raw) => {
              setCamera(false);
              setInput(raw.trim());
              runCheck(raw.trim());
            }}
            onPhoto={(file) => handleFiles([file])}
          />
        )}

        <VerifyInput
          id={inputId}
          value={input}
          onChange={(v) => {
            setInput(v);
            setNotice(null);
            setForced(false);
            if (phase === "done") setPhase("idle");
          }}
          onPaste={onInputPaste}
          onFiles={handleFiles}
          onCamera={() => {
            setNotice(null);
            setCamera(true);
          }}
          detection={detection}
          lockedBank={lockedBank}
          overrideBank={overrideBank}
          onOverride={setOverrideBank}
          extra={extra}
          onExtraChange={(v) => {
            setExtra(v);
            setExtraError(null);
          }}
          extraError={extraError}
          inputRef={inputRef}
          extraRef={extraRef}
          t={t}
          idleBanks={idleBanks}
        />

        {notice && <p className="vp-notice" role="status">{notice}</p>}

        {showBrowserFirst && detection.bank ? (
          <div className="vp-browser">
            <p className="vp-browser-title">
              {t("verify.browser.title", { bank: detection.bank.shortName })}
              {detection.beta && <span className="vi-beta" title={detection.betaNote}>{t("verify.beta")}</span>}
            </p>
            <p className="vp-browser-body">{t("verify.browser.body", { bank: detection.bank.shortName })}</p>
            {detection.beta && detection.betaNote && <p className="vp-browser-beta">{detection.betaNote}</p>}
            {browserUrl && (
              <a className="vp-submit" href={browserUrl} target="_blank" rel="noopener noreferrer">
                {t("verify.browser.open", { bank: detection.bank.shortName })}
                <Icon icon={ArrowUpRight01Icon} size={18} />
              </a>
            )}
            <GeoFallback
              bankCode={detection.bank.code}
              bankName={detection.bank.shortName}
              receiptUrl={browserUrl}
              t={t}
              onResult={(result) => {
                setOutcome({ result, checks: [], checkedAt: new Date(), bankCode: detection.bank?.code });
                setPhase("done");
              }}
            />
            <button type="button" className="vp-server" onClick={() => runCheck(input, { force: true })}>
              {t("verify.browser.server")}
            </button>
            <p className="vp-server-hint">{t("verify.browser.serverHint")}</p>
          </div>
        ) : hideSubmit ? null : (
          <button type="submit" className="vp-submit" aria-busy={busy || undefined} disabled={busy}>
            {phase === "checking"
              ? t("verify.checking", { bank: checkingBank || t("verify.verdict.theBank") })
              : phase === "reading"
                ? t("verify.reading")
                : lockedName
                  ? t("verify.submitBank", { bank: lockedName })
                  : t("verify.submit")}
          </button>
        )}

        {olderFormats.length > 0 && detection.bank && (
          <details className="vp-older" open={detection.olderFormat || undefined}>
            <summary>{t("verify.older.summary")}</summary>
            {olderFormats.map((f) => {
              const vars = { label: f.label, bank: detection.bank!.shortName, example: f.inputs[0]?.example ?? "" };
              const key =
                f.status === "deprecated"
                  ? "verify.older.deprecated"
                  : !f.parser
                    ? "verify.older.unsupported"
                    : f.inputs.some((i) => i.name === "account")
                      ? "verify.older.legacy"
                      : "verify.older.legacyNoAccount";
              return <p key={f.id}>{t(key, vars)}</p>;
            })}
          </details>
        )}
      </form>

      <div ref={resultRef} className="vp-result" aria-live="polite">
        {busy && <VerdictSkeleton label={phase === "reading" ? t("verify.reading") : t("verify.checking", { bank: checkingBank })} />}
        {phase === "done" && verdict && outcome && (
          <VerdictCard
            key={outcome.checkedAt.getTime()}
            verdict={verdict}
            result={outcome.result}
            checkedAt={outcome.checkedAt}
            t={t}
            onAnother={reset}
            onRetry={() => runCheck(input, { force: true })}
          />
        )}
      </div>

      {batch && <BatchPanel files={batch} t={t} onClear={() => setBatch(null)} />}

      {phase === "idle" && !batch && (
        <RecentChecks
          items={history}
          t={t}
          onUse={(item) => {
            setInput(item.ref);
            if (!lockedBank) setOverrideBank("");
            runCheck(item.ref, { override: "" });
          }}
          onRemove={(item) => setHistory(removeRecent(history, item))}
          onClear={() => setHistory(clearRecent())}
        />
      )}
    </div>
  );
}
