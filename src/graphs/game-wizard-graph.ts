import { StateGraph, END, START } from "@langchain/langgraph"
import { WizardState } from "./wizard-state"
import type { WizardStateType } from "./wizard-state"
import { getOrchestratorStatus } from "@/services/model-orchestrator"
import { runIteration, getLoopStatus, stopLoop } from "@/services/loop"
import type { LoopOptions } from "@/lib/types"

const routerNode = async (state: WizardStateType): Promise<Partial<WizardStateType>> => {
  return { logs: [`Router: starting iteration ${state.iterNum}`] }
}

const runIterationNode = async (state: WizardStateType): Promise<Partial<WizardStateType>> => {
  try {
    const options: LoopOptions = {
      objective: state.objective,
      targetBuilder: state.targetBuilder,
      autonomous: state.autonomous,
      maxIterations: 1,
      continuous: false,
      autoCommit: false
    }

    await runIteration(options)

    return {
      loopCount: state.loopCount + 1,
      logs: [`Iteration ${state.iterNum} complete`]
    }
  } catch (err: any) {
    return {
      error: err.message,
      logs: [`Error: ${err.message}`]
    }
  }
}

const checkContinueNode = async (state: WizardStateType): Promise<Partial<WizardStateType>> => {
  return { logs: [`Checking continuation: ${state.loopCount}/${state.maxIterations}`] }
}

const shouldContinue = (state: WizardStateType): "continue" | "done" => {
  if (state.autonomous && state.loopCount < state.maxIterations && !state.error) {
    return "continue"
  } else {
    return "done"
  }
}

const workflow = new StateGraph(WizardState)
  .addNode("router", routerNode)
  .addNode("run_iteration", runIterationNode)
  .addNode("check_continue", checkContinueNode)
  .addEdge(START, "router")
  .addEdge("router", "run_iteration")
  .addEdge("run_iteration", "check_continue")
  .addConditionalEdges("check_continue", shouldContinue, {
    continue: "run_iteration",
    done: END
  })

export const gameWizardGraph = workflow.compile()

export async function runWizardGraph(input: {
  gameId: string
  objective: string
  targetBuilder?: string
  autonomous?: boolean
  maxIterations?: number
}): Promise<void> {
  await gameWizardGraph.invoke({
    gameId: input.gameId || "pgr",
    objective: input.objective,
    targetBuilder: input.targetBuilder,
    autonomous: input.autonomous ?? false,
    maxIterations: input.maxIterations ?? 1,
    loopCount: 0,
    iterNum: 0,
    logs: [],
  })
}
