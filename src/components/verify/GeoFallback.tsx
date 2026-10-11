"use client";

/**
 * Browser-first check for banks whose receipt host only answers Ethiopian
 * networks (Telebirr, M-Pesa). Loaded lazily, only when such a receipt is
 * detected. The user opens the receipt in their own browser and brings the
 * page back by pasting it, or with the bookmarklet. cheki then reads the text
 * (/api/parse); the result is "parsed", which the verdict shows amber: read,
 * not confirmed with the bank.
 */
import { useState, useSyncExternalStore } from "react";
import type { VerifyResult } from "@/lib/banks";
import type { Translate } from "@/lib/i18n/translate";
import { postJson } from "@/lib/verify/client";
import { Icon, Copy01Icon, CopyCheckIcon } from "@/components/Icon";

// The bookmarklet runs on the bank's page. Every value it prints goes through
// esc() before innerHTML, including the API's error message.
const BOOKMARKLET_CODE = `(function(){
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
    b.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><div style="width:18px;height:18px;border:2.5px solid #16a34a;border-top-color:transparent;border-radius:50%;animation:cheki-spin 0.8s linear infinite"></div><span style="font-size:15px;font-weight:600;color:#1a1a1a">cheki is reading this receipt...</span></div><style>@keyframes cheki-spin{to{transform:rotate(360deg)}}</style>';
    o.appendChild(b);
    document.body.appendChild(o);
    o.addEventListener('click',function(e){if(e.target===o)o.remove();});
    fetch('https://cheki.et/api/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bank:bank,html:html,url:url})})
    .then(function(r){return r.json();})
    .then(function(d){
      var esc=function(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
      if(d.success&&(d.verified||d.parsed)){
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
        var rh=rows.map(function(r){return '<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #f0f0f0"><span style="color:#888;flex-shrink:0">'+esc(r[0])+'</span><span style="color:#1a1a1a;font-weight:500;text-align:right;word-break:break-word">'+esc(r[1])+'</span></div>';}).join('');
        b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#d97706"/><path d="M12 7v6M12 16.5v.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg><span style="font-size:16px;font-weight:700;color:#1a1a1a">Read from this page, not checked by cheki</span></div><div style="border-top:1px solid #eee;padding-top:8px">'+rh+'</div><div style="display:flex;gap:8px;margin-top:16px"><a href="https://cheki.et" target="_blank" style="flex:1;text-align:center;padding:10px;border:1px solid #16a34a;border-radius:8px;background:#fff;color:#16a34a;font-size:13px;font-weight:600;text-decoration:none">Open cheki</a><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="flex:1;padding:10px;border:none;border-radius:8px;background:#16a34a;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Done</button></div>';
      }else{
        b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><svg width="20" height="20" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"/></svg><span style="font-size:15px;font-weight:600;color:#dc2626">Could not read this receipt</span></div><p style="font-size:13px;color:#666;margin-bottom:16px;line-height:1.5">'+esc(d.error||'Make sure you are on the bank receipt page.')+'</p><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="width:100%;padding:10px;border:none;border-radius:8px;background:#f3f4f6;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">Close</button>';
      }
    })
    .catch(function(){
      b.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:15px;font-weight:600;color:#dc2626">Network error</span></div><p style="font-size:13px;color:#666;margin-bottom:16px">Could not reach cheki. Check your internet.</p><button onclick="document.getElementById(\\'cheki-overlay\\').remove()" style="width:100%;padding:10px;border:none;border-radius:8px;background:#f3f4f6;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">Close</button>';
    });
  })();`;


const BOOKMARKLET_URL = `javascript:${encodeURIComponent(BOOKMARKLET_CODE)}`;

const noop = () => () => {};
function useIsMobile(): boolean {
  return useSyncExternalStore(noop, () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent), () => true);
}

interface Props {
  bankCode: string;
  bankName: string;
  receiptUrl?: string;
  t: Translate;
  onResult: (result: VerifyResult) => void;
}

export default function GeoFallback({ bankCode, bankName, receiptUrl, t, onResult }: Props) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"paste" | "bookmarklet" | null>(null);
  const active = tab ?? (isMobile ? "paste" : "bookmarklet");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A paste that cannot be read is a problem with the paste, not a verdict on
  // the receipt, so it stays here as a hint instead of becoming a red card.
  const read = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await postJson("/api/parse", { bank: bankCode, content: content.trim(), url: receiptUrl });
      if (data.success === true) onResult(data);
      else setError((data.error || "").replace(/^\s*\[[^\]]{1,60}\]\s*/, "") || t("verify.photo.failed"));
    } finally {
      setBusy(false);
    }
  };

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="gf">
      <div className="gf-tabs" role="tablist" aria-label={t("verify.browser.title", { bank: bankName })}>
        {(["paste", "bookmarklet"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`gf-tab-${k}`}
            aria-selected={active === k}
            aria-controls={`gf-panel-${k}`}
            className="gf-tab"
            onClick={() => setTab(k)}
          >
            {k === "paste" ? t("verify.browser.paste") : t("verify.browser.bookmarklet")}
          </button>
        ))}
      </div>

      {active === "paste" ? (
        <div role="tabpanel" id="gf-panel-paste" aria-labelledby="gf-tab-paste" className="gf-panel">
          <p className="gf-steps">{t("verify.browser.pasteSteps")}</p>
          <label htmlFor="gf-content" className="sr-only">{t("verify.browser.pastePlaceholder")}</label>
          <textarea
            id="gf-content"
            className="gf-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("verify.browser.pastePlaceholder")}
            spellCheck={false}
          />
          <button type="button" className="vc-btn vc-btn--primary gf-read" onClick={read} disabled={busy || !content.trim()} aria-busy={busy}>
            {busy ? t("verify.browser.readingPaste") : t("verify.browser.read")}
          </button>
          {error && <p className="vi-hint" data-error role="alert">{error}</p>}
        </div>
      ) : (
        <div role="tabpanel" id="gf-panel-bookmarklet" aria-labelledby="gf-tab-bookmarklet" className="gf-panel">
          <p className="gf-steps">{t("verify.browser.bookmarkletSteps")}</p>
          <div className="gf-bm-row">
            <a
              href={BOOKMARKLET_URL}
              className="gf-bm"
              onClick={(e) => {
                e.preventDefault();
                copyBookmarklet();
              }}
              title={t("verify.browser.bookmarkletButton")}
            >
              {t("verify.browser.bookmarkletButton")}
            </a>
            <button type="button" className="vc-btn vc-btn--small" onClick={copyBookmarklet}>
              <Icon icon={copied ? CopyCheckIcon : Copy01Icon} size={14} />
              {copied ? t("verify.actions.copied") : t("verify.actions.copy")}
            </button>
          </div>
          {copied && <p className="gf-steps" role="status">{t("verify.browser.bookmarkletCopied")}</p>}
          <p className="gf-note">{t("verify.browser.bookmarkletPrivacy")}</p>
        </div>
      )}
    </div>
  );
}
