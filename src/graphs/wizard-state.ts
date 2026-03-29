import { Annotation } from "@langchain/langgraph";

export const WizardState = Annotation.Root({
  gameId: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  objective: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  targetBuilder: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  iterNum: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 0,
  }),
  screenshotPath: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  analysisJson: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  changesJson: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  buildOk: Annotation<boolean>({
    reducer: (a, b) => b ?? a,
    default: () => false,
  }),
  approved: Annotation<boolean | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  autonomous: Annotation<boolean>({
    reducer: (a, b) => b ?? a,
    default: () => false,
  }),
  maxIterations: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 1,
  }),
  loopCount: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 0,
  }),
  error: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  logs: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

export type WizardStateType = typeof WizardState.State;
