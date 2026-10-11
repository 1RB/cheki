/** next/font/local only works inside the Next compiler; tests get a stub. */
export default function localFont(_opts: unknown) {
  return { className: "font-mock", variable: "font-mock-variable", style: { fontFamily: "Inter" } };
}
