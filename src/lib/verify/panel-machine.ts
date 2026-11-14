/**
 * The receipt checker's run state, as one explicit machine.
 *
 * VerifyPanel used to spread this over six pieces of React state (`phase`,
 * `outcome`, `batch`, `checkingBank`, `editing`, plus an AbortController ref)
 * set by hand in each handler. That let it represent combinations no screen
 * was designed for: a verdict and a batch at once, "reading a photo" with a
 * verdict underneath, "checking" with last check's outcome still set, a bank
 * name for a check that is not running. Async work (a bank answer, a QR or
 * OCR read) also had no way to tell it was stale, so a late answer could land
 * on top of whatever the user had started since.
 *
 * Here every state carries exactly the data it shows, and `run` numbers each
 * piece of async work: an answer or a finished read is applied only while
 * the machine is still in the run that started it. Pure, no React.
 *
 *   idle      the form, with nothing on screen below it (or a batch list)
 *   reading   decoding a photo: QR on the device, then OCR
 *   checking  one request to /api/verify is in flight
 *   done      a verdict is on screen; `editing` unfolds the form above it
 */

export type PanelState<O, F = File> =
  | { phase: "idle"; run: number; batch: F[] | null }
  | { phase: "reading"; run: number }
  | { phase: "checking"; run: number; bank: string }
  | { phase: "done"; run: number; outcome: O; editing: boolean };

export type PanelPhase = PanelState<unknown>["phase"];

export type PanelEvent<O, F = File> =
  /** A photo is being read (QR, then OCR). Starts run `run`. */
  | { type: "read"; run: number }
  /** The read for `run` finished, whatever it found: back to the form. */
  | { type: "readEnd"; run: number }
  /** A request to the bank went out for `bank` (its short name). Starts run `run`. */
  | { type: "check"; run: number; bank: string }
  /** The bank answered the request of `run`. */
  | { type: "answer"; run: number; outcome: O }
  /**
   * The user's own browser read the receipt (Telebirr / M-Pesa paste or
   * bookmarklet). Starts and ends run `run` in one step.
   */
  | { type: "browserAnswer"; run: number; outcome: O }
  /** Several images: a batch list replaces whatever was on screen. Starts run `run`. */
  | { type: "batch"; run: number; files: F[] }
  /** The batch list was closed. */
  | { type: "clearBatch" }
  /** "Edit" on a folded verdict. */
  | { type: "edit" }
  /** The user typed in the main field: a verdict gives way to the form. */
  | { type: "input" }
  /** "Check another": everything back to the empty form. Starts run `run`. */
  | { type: "reset"; run: number };

export function initialPanelState<O, F = File>(): PanelState<O, F> {
  return { phase: "idle", run: 0, batch: null };
}

function assertNever(x: never): never {
  throw new Error(`Unhandled panel event: ${JSON.stringify(x)}`);
}

/**
 * The one transition function. An event that does not apply to the current
 * state returns the state unchanged (the same object), so React skips the
 * render.
 */
export function panelReducer<O, F = File>(state: PanelState<O, F>, event: PanelEvent<O, F>): PanelState<O, F> {
  switch (event.type) {
    case "read":
      return { phase: "reading", run: event.run };
    case "readEnd":
      // Only the read that is still running may end it: a check, a batch or
      // a reset started since owns the screen now.
      return state.phase === "reading" && state.run === event.run ? { phase: "idle", run: state.run, batch: null } : state;
    case "check":
      return { phase: "checking", run: event.run, bank: event.bank };
    case "answer":
      return state.phase === "checking" && state.run === event.run
        ? { phase: "done", run: state.run, outcome: event.outcome, editing: false }
        : state;
    case "browserAnswer":
      return { phase: "done", run: event.run, outcome: event.outcome, editing: false };
    case "batch":
      return { phase: "idle", run: event.run, batch: event.files };
    case "clearBatch":
      return state.phase === "idle" && state.batch ? { ...state, batch: null } : state;
    case "edit":
      return state.phase === "done" && !state.editing ? { ...state, editing: true } : state;
    case "input":
      // Typing during a check or a read leaves it running, as before.
      return state.phase === "done" ? { phase: "idle", run: state.run, batch: null } : state;
    case "reset":
      return { phase: "idle", run: event.run, batch: null };
    default:
      return assertNever(event);
  }
}

/** A check or a photo read is running: the submit button is disabled and the skeleton shows. */
export function isBusy(state: PanelState<unknown, unknown>): boolean {
  return state.phase === "checking" || state.phase === "reading";
}

/** After a verdict the input folds to one summary row, until Edit. */
export function isFolded(state: PanelState<unknown, unknown>): boolean {
  return state.phase === "done" && !state.editing;
}

/** The verdict on screen, if any. */
export function outcomeOf<O>(state: PanelState<O, unknown>): O | null {
  return state.phase === "done" ? state.outcome : null;
}

/** The batch list on screen, if any. */
export function batchOf<F>(state: PanelState<unknown, F>): F[] | null {
  return state.phase === "idle" ? state.batch : null;
}
