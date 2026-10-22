"use client";

/**
 * The receipt checker. Rendered on the homepage (any bank, auto-detected) and
 * on every live /banks/[code] page (locked to that bank).
 *
 * Flow: one smart input -> live detection -> one request -> one verdict.
 *   - Enter submits; a link, BOA QR payload or image pasted anywhere on the
 *     page is checked straight away.
 *   - A Telebirr receipt QR (photo, camera or paste) is swapped for the
 *     transaction number inside it and checked as if it had been typed. The
 *     QR itself proves nothing; Telebirr's record decides.
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
import { detectBankFromUrl, isUrl } from "@/lib/adapters/url-detector";
import { isBoaQrPayload } from "@/lib/qr/decode";
import { isTelebirrQrPayload, parseTelebirrQr } from "@/lib/qr/telebirr";
import { accountFieldKeys, browserReceiptUrl, detectInput, liveBanks, type Detection } from "@/lib/verify/detect";
import { postJson } from "@/lib/verify/client";
import { presentVerdict, type FraudCheck } from "@/lib/verify/verdict";
import { addVerified, clearRecent, findPrevious, loadRecent, removeRecent, type RecentCheck } from "@/lib/verify/history";
import { secondaryFormats } from "@/lib/manifest/formats";
import { useReceiptDetection } from "./use-receipt-detection";
import { VerifyInput } from "./VerifyInput";
import { VerdictCard } from "./VerdictCard";
import { buildShareLink, parseShareHash, type ShareInput } from "@/lib/verify/share-link";
import { VerdictSkeleton } from "./VerdictSkeleton";
import { RecentChecks } from "./RecentChecks";
import { Icon, ArrowUpRight01Icon } from "@/components/Icon";
import { BankLogoByName } from "@/components/BankLogo";

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
  /** The reference as entered (or read out of the link). */
  reference?: string;
  /** What was entered, for the re-check link. */
  share?: ShareInput;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/**
 * True when the verdict's top is not comfortably on screen: under the sticky
 * header, in the lower half of the visible area (mobile, where the card
 * renders under the input), or with less than its head and amount (~220px)
 * showing. A verdict beside the input (desktop) stays put. Exported for tests.
 */
export function verdictNeedsScroll(rect: { top: number; height: number }, viewportHeight: number, topInset = 0): boolean {
  const room = viewportHeight - topInset;
  return rect.top < topInset || rect.top > topInset + room * 0.5 || rect.top + Math.min(rect.height, 220) > viewportHeight;
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
  /** After a verdict the input folds to one row; Edit unfolds it. */
  const [editing, setEditing] = useState(false);

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
        ? presentVerdict(outcome.result, { bankCode: outcome.bankCode, checkedAt: outcome.checkedAt, checks: outcome.checks, reference: outcome.reference, t })
        : null,
    [outcome, t]
  );

  // Bring a verdict that landed below the fold into view (mobile: the card
  // renders under the input), then hand focus to its heading so screen
  // readers start there. Scrolling never shifts layout, so no CLS.
  useEffect(() => {
    if (phase !== "done" || !outcome || !resultRef.current) return;
    const el = resultRef.current;
    const heading = el.querySelector<HTMLElement>("#vc-title");
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 0;
    const reduced = reduceMotion();
    const settle = () => {
      if (verdictNeedsScroll(el.getBoundingClientRect(), window.innerHeight, navH)) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    };
    heading?.focus({ preventScroll: true });
    // The input folds above the verdict (a 240ms grid-row transition), so
    // measure where the verdict lands, not where it starts. Under reduced
    // motion the fold is instant and the measurement is already final.
    if (reduced) {
      settle();
      return;
    }
    const id = window.setTimeout(settle, 260);
    return () => window.clearTimeout(id);
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
        const phoneOk = /^(251|0)?[79]\d{8}$/.test(digits);
        const accountOk = digits.length >= (d.accountDigits ?? 5);
        if (d.needsPhone ? !phoneOk : !accountOk) {
          setExtraError(d.needsPhone ? t("verify.extra.phoneMissing") : t(accountFieldKeys(d).missing, { digits: d.accountDigits ?? 5 }));
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
      setEditing(false);
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
      // A BOA QR is remembered by the bank's reference, never by its payload.
      const savedRef = d.kind === "boaQr" ? (typeof result.reference === "string" ? result.reference.trim() : "") : d.value;
      const earlier = savedRef ? findPrevious(historyRef.current, bankCode, savedRef) : undefined;
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
      const nextHistory = addVerified(historyRef.current, result, { bank: bankCode, ref: savedRef }, checkedAt);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      const enteredRef = d.kind === "url" ? d.urlReference : d.kind === "reference" || d.kind === "telebirrQr" ? d.value : undefined;
      const share: ShareInput = { input: d.value, bank: bankCode, ...(d.needsAccount || d.needsPhone ? { extra: extraValue } : {}) };
      setOutcome({ result, checks, checkedAt, bankCode, reference: enteredRef, share });
      setPhase("done");
    },
    [extra, lockedBank, overrideBank, t]
  );

  /**
   * Text read from a QR (photo, camera) or pasted. A Telebirr receipt QR is
   * replaced by the transaction number inside it and Telebirr is chosen, so
   * the check is exactly the typed-reference flow: browser-first panel, then
   * the server gate. Nothing from the QR but that number is used or shown.
   * On another bank's page it is left as is and reported as a Telebirr
   * receipt, like a link for another bank.
   */
  const acceptScanned = useCallback(
    async (raw: string, fromQr = false) => {
      const text = raw.trim();
      const telebirr = parseTelebirrQr(text);
      if (telebirr.ok && (!lockedBank || lockedBank === "telebirr")) {
        setInput(telebirr.reference);
        if (!lockedBank) setOverrideBank("telebirr");
        await runCheck(telebirr.reference, { override: "telebirr" });
        setNotice(t("verify.qr.telebirr"));
        return;
      }
      setInput(text);
      await runCheck(text);
      // A CBE Birr receipt QR is its receipt link (receipt number + payer
      // phone), so it is the link flow; say where the two values came from.
      if (fromQr && isUrl(text) && detectBankFromUrl(text)?.bank === "cbebirr") setNotice(t("verify.qr.cbebirr"));
    },
    [lockedBank, runCheck, t]
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
        setPhase("idle");
        await acceptScanned(raw, true);
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
    [acceptScanned, focusInput, lockedBank, t]
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
    if (text && (isUrl(text) || isBoaQrPayload(text) || isTelebirrQrPayload(text))) {
      e.preventDefault();
      acceptScanned(text);
    }
  };

  // Paste anywhere on the page (outside other fields) checks a link, a QR
  // payload or an image. The listener reads the latest handlers from a ref.
  const latest = useRef({ acceptScanned, handleFiles });
  useEffect(() => {
    latest.current = { acceptScanned, handleFiles };
  }, [acceptScanned, handleFiles]);
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
      if (text && (isUrl(text) || isBoaQrPayload(text) || isTelebirrQrPayload(text))) {
        e.preventDefault();
        latest.current.acceptScanned(text);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    // A re-check link has done its job; reloading should not run it again.
    if (window.location.hash && parseShareHash(window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setInput("");
    setExtra("");
    setOverrideBank("");
    setOutcome(null);
    setNotice(null);
    setExtraError(null);
    setBatch(null);
    setForced(false);
    setEditing(false);
    setPhase("idle");
    focusInput();
  }, [focusInput]);

  // A re-check link (cheki.et/#r=…, see src/lib/verify/share-link.ts):
  // fill the form from the fragment and ask the bank again, in this browser.
  // Runs on load and when a new link is opened in the same tab.
  useEffect(() => {
    const open = async () => {
      const shared = parseShareHash(window.location.hash);
      if (!shared) return;
      if (lockedBank && shared.bank && shared.bank !== lockedBank) return;
      setInput(shared.input);
      if (!lockedBank && shared.bank) setOverrideBank(shared.bank);
      setExtra(shared.extra ?? "");
      const d = detectInput(shared.input, { lockedBank, overrideBank: shared.bank });
      await runCheck(shared.input, { extra: shared.extra ?? "", override: shared.bank ?? "" });
      if (!d.browserFirst) setNotice(t("verify.shared.opened"));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
    // Only on mount: runCheck changes with every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareUrl = useMemo(
    () => (outcome?.share && typeof window !== "undefined" ? buildShareLink(outcome.share, window.location.origin) : undefined),
    [outcome]
  );

  const browserUrl = browserReceiptUrl(detection);
  // Telebirr / M-Pesa lead with the browser path until the user asks for a
  // server check; once there is a verdict, the card carries the next step.
  const showBrowserFirst = detection.browserFirst && !forced && phase !== "done";
  const hideSubmit = detection.browserFirst && !forced && phase === "done";
  const olderFormats = detection.bank ? secondaryFormats(detection.bank).filter((f) => f.status !== "current") : [];
  const busy = phase === "checking" || phase === "reading";
  const folded = phase === "done" && !!outcome && !editing;
  const summaryBank = outcome?.bankCode ? liveBanks.find((b) => b.code === outcome.bankCode) : undefined;
  const summaryRef =
    detection.kind === "boaQr" ? t("verify.detect.boaQr") : (outcome?.reference || input.trim().replace(/^https?:\/\//i, ""));
  const idleBanks = useMemo(() => {
    const names = liveBanks.map((b) => b.shortName);
    return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", ");
  }, []);

  return (
    <div className="vp" data-phase={phase}>
      <div className="vp-card" data-folded={folded || undefined}>
      <div className="vp-fold" data-hidden={!folded || undefined} inert={!folded}>
        <div>
          <div className="vp-summary">
            {summaryBank && <BankLogoByName code={summaryBank.code} size={20} />}
            <span className="vp-summary-label">{t("verify.summary.checked")}</span>
            <span className="vp-summary-ref" data-plain={detection.kind === "boaQr" || undefined}>{summaryRef}</span>
            <button
              type="button"
              className="vp-edit"
              onClick={() => {
                setEditing(true);
                focusInput();
              }}
            >
              {t("verify.summary.edit")}
            </button>
          </div>
        </div>
      </div>
      <div className="vp-fold" data-hidden={folded || undefined} inert={folded}>
      <div>
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
              acceptScanned(raw, true);
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
      </div>
      </div>
      </div>

      <div ref={resultRef} className="vp-result">
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
            shareUrl={shareUrl}
          />
        )}
      </div>

      {batch && (
        <BatchPanel
          files={batch}
          t={t}
          onClear={() => setBatch(null)}
          onPick={(reference, bankCode) => {
            setInput(reference);
            if (!lockedBank && bankCode) setOverrideBank(bankCode);
            focusInput();
          }}
        />
      )}

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
