import { describe, expect, it } from "vitest";
import {
  batchOf,
  initialPanelState,
  isBusy,
  isFolded,
  outcomeOf,
  panelReducer,
  type PanelEvent,
  type PanelPhase,
  type PanelState,
} from "@/lib/verify/panel-machine";

type O = { id: string };
type S = PanelState<O, string>;
type E = PanelEvent<O, string>;

const idle: S = { phase: "idle", run: 1, batch: null };
const idleBatch: S = { phase: "idle", run: 1, batch: ["a.png", "b.png"] };
const reading: S = { phase: "reading", run: 1 };
const checking: S = { phase: "checking", run: 1, bank: "CBE" };
const done: S = { phase: "done", run: 1, outcome: { id: "x" }, editing: false };
const editing: S = { phase: "done", run: 1, outcome: { id: "x" }, editing: true };

const STATES: Record<string, S> = { idle, idleBatch, reading, checking, done, editing };
const step = (s: S, e: E) => panelReducer<O, string>(s, e);

/**
 * The transition table: for every state, what each event leads to. "same"
 * means the event does not apply there and the state object is returned
 * unchanged (React skips the render).
 */
const TABLE: { event: E; expect: Record<keyof typeof STATES, PanelPhase | "same"> }[] = [
  { event: { type: "read", run: 2 }, expect: { idle: "reading", idleBatch: "reading", reading: "reading", checking: "reading", done: "reading", editing: "reading" } },
  { event: { type: "readEnd", run: 1 }, expect: { idle: "same", idleBatch: "same", reading: "idle", checking: "same", done: "same", editing: "same" } },
  { event: { type: "check", run: 2, bank: "BOA" }, expect: { idle: "checking", idleBatch: "checking", reading: "checking", checking: "checking", done: "checking", editing: "checking" } },
  { event: { type: "answer", run: 1, outcome: { id: "y" } }, expect: { idle: "same", idleBatch: "same", reading: "same", checking: "done", done: "same", editing: "same" } },
  { event: { type: "browserAnswer", run: 2, outcome: { id: "y" } }, expect: { idle: "done", idleBatch: "done", reading: "done", checking: "done", done: "done", editing: "done" } },
  { event: { type: "batch", run: 2, files: ["c.png", "d.png"] }, expect: { idle: "idle", idleBatch: "idle", reading: "idle", checking: "idle", done: "idle", editing: "idle" } },
  { event: { type: "clearBatch" }, expect: { idle: "same", idleBatch: "idle", reading: "same", checking: "same", done: "same", editing: "same" } },
  { event: { type: "edit" }, expect: { idle: "same", idleBatch: "same", reading: "same", checking: "same", done: "done", editing: "same" } },
  { event: { type: "input" }, expect: { idle: "same", idleBatch: "same", reading: "same", checking: "same", done: "idle", editing: "idle" } },
  { event: { type: "reset", run: 2 }, expect: { idle: "idle", idleBatch: "idle", reading: "idle", checking: "idle", done: "idle", editing: "idle" } },
];

describe("panel machine: transition table", () => {
  for (const row of TABLE) {
    for (const [name, state] of Object.entries(STATES)) {
      const want = row.expect[name];
      it(`${name} + ${row.event.type} -> ${want}`, () => {
        const next = step(state, row.event);
        if (want === "same") expect(next).toBe(state);
        else expect(next.phase).toBe(want);
      });
    }
  }

  it("covers every event type", () => {
    const covered = new Set(TABLE.map((r) => r.event.type));
    const all: E["type"][] = ["read", "readEnd", "check", "answer", "browserAnswer", "batch", "clearBatch", "edit", "input", "reset"];
    expect([...covered].sort()).toEqual([...all].sort());
  });

  it("starts idle with nothing on screen", () => {
    const s = initialPanelState<O, string>();
    expect(s).toEqual({ phase: "idle", run: 0, batch: null });
    expect(isBusy(s) || isFolded(s) || outcomeOf(s) !== null || batchOf(s) !== null).toBe(false);
  });
});

describe("panel machine: stale async work", () => {
  it("drops a bank answer from an earlier run (the user started another check)", () => {
    const s = step(checking, { type: "check", run: 2, bank: "BOA" });
    expect(step(s, { type: "answer", run: 1, outcome: { id: "old" } })).toBe(s);
    expect(outcomeOf(step(s, { type: "answer", run: 2, outcome: { id: "new" } }))).toEqual({ id: "new" });
  });

  it("drops a bank answer that lands after a photo read, a batch or a reset began", () => {
    for (const e of [{ type: "read", run: 2 }, { type: "batch", run: 2, files: ["a"] }, { type: "reset", run: 2 }] as E[]) {
      const s = step(checking, e);
      expect(step(s, { type: "answer", run: 1, outcome: { id: "late" } })).toBe(s);
    }
  });

  it("drops a finished photo read once a check took over (paste during OCR)", () => {
    const s = step(reading, { type: "check", run: 2, bank: "CBE" });
    expect(step(s, { type: "readEnd", run: 1 })).toBe(s);
    expect(isBusy(s)).toBe(true);
  });

  it("a browser answer supersedes a check in flight", () => {
    const s = step(checking, { type: "browserAnswer", run: 2, outcome: { id: "browser" } });
    expect(step(s, { type: "answer", run: 1, outcome: { id: "server" } })).toBe(s);
    expect(outcomeOf(s)).toEqual({ id: "browser" });
  });
});

describe("panel machine: what each state shows", () => {
  it("a verdict and a batch are never on screen together", () => {
    for (const s of Object.values(STATES)) expect(outcomeOf(s) !== null && batchOf(s) !== null).toBe(false);
    const afterAnswer = step(step(idleBatch, { type: "check", run: 2, bank: "CBE" }), { type: "answer", run: 2, outcome: { id: "x" } });
    expect(batchOf(afterAnswer)).toBeNull();
  });

  it("folds only a verdict that is not being edited", () => {
    expect(isFolded(done)).toBe(true);
    expect(isFolded(step(done, { type: "edit" }))).toBe(false);
    expect(isFolded(checking) || isFolded(idle) || isFolded(reading)).toBe(false);
  });

  it("a new answer always arrives folded", () => {
    const s = step(step(editing, { type: "check", run: 2, bank: "CBE" }), { type: "answer", run: 2, outcome: { id: "y" } });
    expect(isFolded(s)).toBe(true);
    expect(isFolded(step(editing, { type: "browserAnswer", run: 2, outcome: { id: "y" } }))).toBe(true);
  });

  it("only checking and reading are busy; the bank name lives on the check", () => {
    expect(Object.entries(STATES).filter(([, s]) => isBusy(s)).map(([n]) => n).sort()).toEqual(["checking", "reading"]);
    const s = step(idle, { type: "check", run: 2, bank: "Dashen" });
    expect(s.phase === "checking" && s.bank).toBe("Dashen");
  });

  it("typing during a check or a read leaves it running", () => {
    expect(step(checking, { type: "input" })).toBe(checking);
    expect(step(reading, { type: "input" })).toBe(reading);
  });

  it("rejects an unknown event at runtime", () => {
    expect(() => step(idle, { type: "nope" } as unknown as E)).toThrow(/Unhandled panel event/);
  });
});
