"use client";

/**
 * One smart input: a receipt link, a reference, a BOA QR payload, or an image
 * (paste, drop, upload, camera). Under it, a single fixed-height row says what
 * was detected, with the bank chooser (BankSelect) to override it. The extra field
 * (account suffix or phone) opens only when the detected format needs it.
 *
 * Presentational: the panel owns the state. No refs are read during render.
 */
import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type RefObject } from "react";
import Link from "next/link";
import type { Detection } from "@/lib/verify/detect";
import { accountFieldKeys, liveBanks } from "@/lib/verify/detect";
import type { Translate } from "@/lib/i18n/translate";
import { BankLogoByName } from "@/components/BankLogo";
import { BankSelect } from "@/components/ui/BankSelect";
import { Icon, Camera01Icon, Upload01Icon, Alert01Icon } from "@/components/Icon";

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** A link, QR payload or image pasted into the field is checked right away. */
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  onFiles: (files: File[]) => void;
  onCamera: () => void;
  detection: Detection;
  /** Bank code of a locked bank page; hides the chooser. */
  lockedBank?: string;
  overrideBank: string;
  onOverride: (code: string) => void;
  extra: string;
  onExtraChange: (v: string) => void;
  extraError: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  extraRef: RefObject<HTMLInputElement | null>;
  t: Translate;
  /** Banks listed in the idle hint. */
  idleBanks: string;
}

export function VerifyInput({
  id,
  value,
  onChange,
  onPaste,
  onFiles,
  onCamera,
  detection: d,
  lockedBank,
  overrideBank,
  onOverride,
  extra,
  onExtraChange,
  extraError,
  inputRef,
  extraRef,
  t,
  idleBanks,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = `${id}-file`;
  const needsExtra = d.needsAccount || d.needsPhone;
  const lockedName = lockedBank ? liveBanks.find((b) => b.code === lockedBank)?.shortName : undefined;
  const otherBank = Boolean(lockedBank && d.bank && d.bank.code !== lockedBank);
  const ambiguous = Boolean(d.bank) && !d.overridden && !lockedBank && d.kind === "reference" && d.candidates.length > 1;
  // What auto-detect found, for the chooser's closed face ("Auto · CBE").
  // Not while two banks are still possible: the status row asks instead.
  const detected = !d.overridden && !ambiguous && d.bank && d.kind !== "empty" && d.kind !== "unknownUrl" ? d.bank : undefined;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(files);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) onFiles(files);
  };

  let status: React.ReactNode;
  let tone: "quiet" | "ok" | "warn" = "ok";
  if (otherBank && d.bank) {
    tone = "warn";
    status = (
      <>
        <BankLogoByName code={d.bank.code} size={18} />
        <span className="vi-status-text">
          {t("verify.detect.otherBank", { bank: d.bank.shortName })}{" "}
          <Link href="/#verify" prefetch={false} className="vi-link">{t("verify.detect.otherBankLink")}</Link>
        </span>
      </>
    );
  } else if (d.kind === "empty") {
    tone = "quiet";
    status = <span className="vi-status-text">{lockedName ? t("verify.inputHint") : t("verify.detect.idle", { banks: idleBanks })}</span>;
  } else if (d.kind === "unknownUrl") {
    tone = "warn";
    status = (
      <>
        <Icon icon={Alert01Icon} size={16} />
        <span className="vi-status-text">{t("verify.detect.unknownUrl")}</span>
      </>
    );
  } else if (!d.bank) {
    tone = "warn";
    status = <span className="vi-status-text">{t("verify.detect.unknownRef")}</span>;
  } else {
    const name = d.bank.shortName;
    const label =
      d.kind === "boaQr"
        ? t("verify.detect.boaQr")
        : ambiguous
          ? t("verify.detect.ambiguous", { a: d.candidates[0].shortName, b: d.candidates[1].shortName })
          : d.overridden
            ? t("verify.detect.chosen", { bank: name })
            : d.olderFormat
              ? t("verify.detect.older", { bank: name })
              : d.kind === "url"
                ? t("verify.detect.link", { bank: name })
                : t("verify.detect.reference", { bank: name });
    if (ambiguous) tone = "warn";
    status = (
      <>
        <BankLogoByName code={d.bank.code} size={18} />
        <span className="vi-status-text">{label}</span>
        {d.beta && (
          <span className="vi-beta" title={d.betaNote}>{t("verify.beta")}</span>
        )}
      </>
    );
  }

  const statusKey = `${d.kind}:${d.bank?.code ?? ""}:${otherBank}:${d.overridden ? 1 : 0}:${d.olderFormat ? 1 : 0}`;

  return (
    <div className="vi">
      <label htmlFor={id} className="vi-label">
        {t("verify.inputLabel")}
      </label>
      <div
        className="vi-field"
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={id}
          className="vi-input"
          type="text"
          inputMode="url"
          enterKeyHint="go"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          placeholder={lockedName ? t("verify.inputPlaceholderBank", { bank: lockedName }) : t("verify.inputPlaceholder")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
        />
        <div className="vi-tools">
          <button type="button" className="vi-tool" onClick={onCamera} aria-label={t("verify.scan")} title={t("verify.scan")}>
            <Icon icon={Camera01Icon} size={20} />
          </button>
          <button type="button" className="vi-tool" onClick={() => fileRef.current?.click()} aria-label={t("verify.upload")} title={t("verify.upload")}>
            <Icon icon={Upload01Icon} size={20} />
          </button>
          <input ref={fileRef} id={fileId} className="sr-only" type="file" accept="image/*" multiple onChange={onFile} tabIndex={-1} aria-hidden="true" />
        </div>
        {dragging && <div className="vi-drop" aria-hidden="true">{t("verify.dropHere")}</div>}
      </div>

      <div className="vi-row">
        <p id={`${id}-status`} className="vi-status" data-tone={tone} role="status">
          {/* Keyed on what was detected: a new reading cross-fades in instead
              of jumping; the idle hint (first paint) never animates. */}
          <span key={statusKey} className="vi-status-inner" data-fresh={d.kind !== "empty" || undefined}>
            {status}
          </span>
        </p>
        {!lockedBank && (
          <BankSelect
            id={`${id}-bank`}
            value={overrideBank}
            onChange={onOverride}
            banks={liveBanks}
            detected={detected}
            t={t}
          />
        )}
      </div>

      <div className="vi-extra" data-open={needsExtra || undefined} inert={!needsExtra}>
        <div className="vi-extra-inner">
          <label htmlFor={`${id}-extra`} className="vi-label">
            {d.needsPhone ? t("verify.extra.phone") : t(accountFieldKeys(d).label, { digits: d.accountDigits ?? d.bank?.accountDigits ?? 8 })}
          </label>
          <input
            ref={extraRef}
            id={`${id}-extra`}
            className="vi-input vi-input--extra"
            type="text"
            inputMode={d.needsPhone ? "tel" : "numeric"}
            autoComplete="off"
            value={extra}
            onChange={(e) => onExtraChange(e.target.value)}
            placeholder={d.needsPhone ? "2519XXXXXXXX" : t("verify.extra.accountPlaceholder", { digits: d.accountDigits ?? d.bank?.accountDigits ?? 8 })}
            aria-invalid={extraError ? true : undefined}
            aria-describedby={`${id}-extra-hint`}
          />
          <p id={`${id}-extra-hint`} className="vi-hint" data-error={extraError ? true : undefined}>
            {extraError ??
              (d.needsPhone
                ? t("verify.extra.phoneHint", { bank: d.bank?.shortName ?? "" })
                : t("verify.extra.accountHint", { bank: d.bank?.shortName ?? "" }))}
          </p>
        </div>
      </div>
    </div>
  );
}
