export interface AgentDecisionContext<Action, Observation> {
  observation: Observation;
  legalActions: readonly Action[];
  gameId?: string;
  matchId?: string;
  playerId?: string;
  revision?: number;
  deadlineAt?: string;
}

export interface AgentDecision<Action> {
  actionId: string;
  action: Action;
  commentary?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentPlayer<Action, Observation> {
  readonly agentId: string;
  chooseAction(context: AgentDecisionContext<Action, Observation>): Promise<Action>;
  chooseDecision?(
    context: AgentDecisionContext<Action, Observation>,
  ): Promise<AgentDecision<Action>>;
}

export async function chooseAgentDecision<Action, Observation>(
  agent: AgentPlayer<Action, Observation>,
  context: AgentDecisionContext<Action, Observation>,
  fallbackActionId: string,
): Promise<AgentDecision<Action>> {
  if (agent.chooseDecision) {
    return await agent.chooseDecision(context);
  }
  return {
    actionId: fallbackActionId,
    action: await agent.chooseAction(context),
  };
}
