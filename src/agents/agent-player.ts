export interface AgentDecisionContext<Action, Observation> {
  observation: Observation;
  legalActions: readonly Action[];
}

export interface AgentPlayer<Action, Observation> {
  readonly agentId: string;
  chooseAction(context: AgentDecisionContext<Action, Observation>): Promise<Action>;
}
