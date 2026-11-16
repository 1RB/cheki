/**
 * SYNTHETIC Siinqee Bank receipt pages, for tests only.
 *
 * Not copied from a real receipt: every name, account number, phone, TIN,
 * reference, amount and date below is made up. Only the shape follows the
 * real receipts the maintainer shared (2026-10-31): the labels, their order,
 * Siinqee's account mask, the dd/mm/yyyy date, "-" for an empty fee, the
 * customer block cheki must never return, and the incoming instant payment
 * (IIPS) variant with "Amount" instead of "Transferred Amount". The markup is
 * invented, twice over (a table and divs), because the parser must not depend
 * on it.
 */

/** A transfer within Siinqee. The lowercase "k" makes the reference case-sensitive. */
export const SYNTH_SIINQEE_REF = "12B004k262950007";
/** An incoming instant payment from another bank. */
export const SYNTH_SIINQEE_IPS_REF = "12BIIPS262950008";
export const SYNTH_SIINQEE_LINK = `https://receipts.siinqeebank.com:871/generate/${SYNTH_SIINQEE_REF}`;

/** Made-up customer details that must never reach a result or `raw`. */
export const SYNTH_CUSTOMER = { name: "TEST CUSTOMER ZERO", phone: "0900000000", tin: "0000000000", branch: "TEST BRANCH" };

const head = `<!DOCTYPE html><html><head><title>C B</title><style>td{padding:2px}</style><script>var x="Reference No 999";</script></head><body>`;
const header = `
  <h2>Siinqee Bank S.C</h2><p>Empowered Together!</p><h3>Customer Receipt</h3><p>Transaction is successful!</p>
  <h4>Company Address &amp; Other Information</h4>
  <p>Address: Addis Ababa City: Addis Ababa Address Line: Test Tower Phone: +251-00-000-0000 Email: info@example.test Website: www.example.test</p>
  <h4>Customer Information</h4>
  <p>Customer Name: ${SYNTH_CUSTOMER.name} Region: ADDIS ABABA City: 00 VAT Registration No: - Customer Phone: ${SYNTH_CUSTOMER.phone} TIN: ${SYNTH_CUSTOMER.tin} Branch: ${SYNTH_CUSTOMER.branch}</p>`;

/** Transfer within Siinqee, as an HTML table (label and value in separate cells). */
export function siinqeeP2pHtml(ref = SYNTH_SIINQEE_REF): string {
  const row = (l: string, v: string) => `<tr><td class="l">${l}</td><td class="v">${v}</td></tr>`;
  return `${head}${header}
  <h4>Transaction Details</h4>
  <table>
    ${row("Reference No", ref)}
    ${row("Payer Account", "100*******001")}
    ${row("Payer Name", SYNTH_CUSTOMER.name)}
    ${row("Transaction Date", "22/10/2026")}
    ${row("Currency", "ETB")}
    ${row("Transaction Description", "ACCOUNT TO ACCOUNT TRANSFER")}
    ${row("Receiver Account", "100*******002")}
    ${row("Receiver Name", "TEST RECEIVER PLC")}
    ${row("Transferred Amount", "1,500.00 ETB")}
    ${row("Charge Amount", "-")}
    ${row("VAT Amount", "-")}
    ${row("Disaster Fund", "-")}
    ${row("Total Amount", "1,500.00 ETB")}
    ${row("Amount in Words", "One Thousand Five Hundred Birr and zero cents")}
  </table></body></html>`;
}

/** Incoming instant payment, as divs with the label and value in one node. */
export function siinqeeIpsHtml(ref = SYNTH_SIINQEE_IPS_REF): string {
  const line = (l: string, v: string) => `<div class="kv">${l} ${v}</div>`;
  return `${head}<div class="receipt">${header}
  <div class="section">Transaction Details</div>
  ${line("Reference No", ref)}
  ${line("Payer Account", "100***011")}
  ${line("Payer Name", "Incoming from Other Bank")}
  ${line("Transaction Date", "22/10/2026")}
  ${line("Currency", "ETB")}
  ${line("Transaction Description", "INCOMING INSTANT PAYMENT SYSTEM")}
  ${line("Receiver Account", "100*******002")}
  ${line("Receiver Name", "TEST RECEIVER PLC")}
  ${line("Amount", "2,250.50 ETB")}
  ${line("Charge Amount", "-")}
  ${line("VAT Amount", "-")}
  ${line("Disaster Fund", "-")}
  ${line("Total Amount", "2,250.50 ETB")}
  ${line("Amount in Words", "Two Thousand Two Hundred Fifty Birr and fifty cents")}
  </div></body></html>`;
}

/**
 * Text as a PDF extractor might give it: everything on few lines, labels run
 * into their values in places, a fee filled in and an unmasked account.
 */
export function siinqeePdfText(ref = SYNTH_SIINQEE_REF): string {
  return [
    "Siinqee Bank S.C Empowered Together! Customer Receipt Transaction is successful!",
    `Customer Information Customer Name: ${SYNTH_CUSTOMER.name} Customer Phone: ${SYNTH_CUSTOMER.phone} TIN: null Branch: ${SYNTH_CUSTOMER.branch}`,
    `Transaction Details Reference No ${ref} Payer Account 1000000000001 Payer Name ${SYNTH_CUSTOMER.name}`,
    "Transaction Date 22/10/2026 Currency ETB Transaction Description ACCOUNT TO ACCOUNT TRANSFER",
    "Receiver Account 100*******002 Receiver NameTEST RECEIVER PLC Transferred Amount 1,500.00 ETBCharge Amount 5.00 ETB",
    "VAT Amount 0.75 ETB Disaster Fund - Total Amount 1,505.75 ETB Amount in Words One Thousand Five Hundred Five Birr",
  ].join("\n");
}

/** A page for another reference than the one asked for. */
export const siinqeeOtherRefHtml = () => siinqeeP2pHtml("12B004k262950099");

/** The receipt layout without the success line. */
export const siinqeeNoSuccessHtml = () => siinqeeP2pHtml().replace("Transaction is successful!", "");

/** What an error page could look like (the real unknown-reference answer has not been seen). */
export const SIINQEE_ERROR_HTML = `<!DOCTYPE html><html><head><title>C B</title></head><body><h1>Error</h1><p>Something went wrong.</p></body></html>`;
