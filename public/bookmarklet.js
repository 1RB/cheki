// cheki bookmarklet - verifies Ethiopian bank receipts directly from the bank's page
//
// Usage: drag this to your bookmarks bar. When on a Telebirr or M-Pesa receipt page,
// click it to verify the receipt through cheki's API.
//
// The bookmarklet reads the page HTML (same-origin, no CORS issues) and sends it
// to cheki's /api/parse endpoint, which parses it server-side and returns structured data.
//
// This bypasses geo-blocking because the user's browser fetched the page, not cheki's server.

(function () {
  const API = "https://chekiapp.vercel.app/api/parse";
  const url = window.location.href;
  const html = document.documentElement.outerHTML;

  // Auto-detect bank from URL
  let bank = null;
  if (url.includes("ethiotelecom.et")) bank = "telebirr";
  else if (url.includes("safaricom.et") || url.includes("m-pesa"))
    bank = "mpesa";
  else {
    alert("cheki: This doesn't look like a Telebirr or M-Pesa receipt page.");
    return;
  }

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "cheki-overlay";
  overlay.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;"><span style="font-weight:800;font-size:20px;color:#16a34a;">cheki</span><span style="font-size:10px;font-weight:600;color:#16a34a;border:1px solid #dcfce7;padding:2px 6px;border-radius:4px;background:#dcfce7;">OSS</span></div><div style="color:#666;font-size:14px;">Verifying receipt...</div><div style="margin-top:16px;height:3px;background:#f0f0f0;border-radius:2px;overflow:hidden;"><div style="height:100%;background:#16a34a;width:30%;animation:cheki-spin 1s linear infinite;"></div></div><style>@keyframes cheki-spin{0%{margin-left:-30%}100%{margin-left:100%}}</style></div>';
  document.body.appendChild(overlay);

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bank, html, url }),
  })
    .then((r) => r.json())
    .then((data) => {
      const o = document.getElementById("cheki-overlay");
      if (!o) return;

      if (data.success && data.verified) {
        const fields = [];
        if (data.senderName)
          fields.push(["Sender", data.senderName]);
        if (data.receiverName)
          fields.push(["Receiver", data.receiverName]);
        if (data.amount != null)
          fields.push(["Amount", `${data.amount.toLocaleString()} ${data.currency || "ETB"}`]);
        if (data.date) fields.push(["Date", data.date]);
        if (data.reference)
          fields.push(["Reference", data.reference]);
        if (data.invoiceNumber)
          fields.push(["Invoice", data.invoiceNumber]);
        if (data.transactionStatus)
          fields.push(["Status", data.transactionStatus]);

        const rows = fields
          .map(
            ([label, value]) =>
              `<tr><td style="padding:8px 12px;color:#999;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #f0f0f0;">${label}</td><td style="padding:8px 12px;color:#222;font-size:14px;font-weight:500;border-bottom:1px solid #f0f0f0;text-align:right;">${value}</td></tr>`
          )
          .join("");

        o.innerHTML =
          '<div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;"><span style="font-weight:800;font-size:20px;color:#16a34a;">cheki</span><span style="font-size:10px;font-weight:600;color:#16a34a;border:1px solid #dcfce7;padding:2px 6px;border-radius:4px;background:#dcfce7;">OSS</span><span style="margin-left:auto;padding:4px 10px;border-radius:6px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:700;">VERIFIED</span></div><table style="width:100%;border-collapse:collapse;margin-top:8px;">' +
          rows +
          '</table><div style="margin-top:16px;display:flex;gap:8px;"><button onclick="document.getElementById(\'cheki-overlay\').remove()" style="flex:1;padding:10px;border:1px solid #e5e5e5;border-radius:8px;background:#fff;color:#666;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button><a href="https://chekiapp.vercel.app" target="_blank" style="flex:1;padding:10px;border:none;border-radius:8px;background:#16a34a;color:#fff;font-size:13px;font-weight:600;text-decoration:none;text-align:center;cursor:pointer;font-family:inherit;">Open cheki</a></div></div>';
      } else {
        o.innerHTML =
          '<div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;"><span style="font-weight:800;font-size:20px;color:#dc2626;">cheki</span></div><div style="color:#666;font-size:14px;line-height:1.5;">' +
          (data.error || "Could not verify this receipt.") +
          '</div><div style="margin-top:16px;"><button onclick="document.getElementById(\'cheki-overlay\').remove()" style="width:100%;padding:10px;border:1px solid #e5e5e5;border-radius:8px;background:#fff;color:#666;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button></div></div>';
      }
    })
    .catch((e) => {
      const o = document.getElementById("cheki-overlay");
      if (!o) return;
      o.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;"><span style="font-weight:800;font-size:20px;color:#dc2626;">cheki</span></div><div style="color:#666;font-size:14px;">Network error: ' +
        e.message +
        '</div><div style="margin-top:16px;"><button onclick="document.getElementById(\'cheki-overlay\').remove()" style="width:100%;padding:10px;border:1px solid #e5e5e5;border-radius:8px;background:#fff;color:#666;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button></div></div>';
    });
})();
