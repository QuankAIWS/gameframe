export type PlayerId = string;
export type MatchId = string;

export type GameLifecycle = "waiting" | "active" | "completed";

export interface GameStatus {
  lifecycle: GameLifecycle;
  winnerPlayerId: PlayerId | null;
  draw: boolean;
}

export interface GameTransition<State> {
  state: State;
  summary: string;
}

export interface GameDefinition<State, Action, Observation> {
  readonly gameId: string;
  createInitialState(playerIds: readonly PlayerId[]): State;
  getStatus(state: State): GameStatus;
  getActivePlayerId(state: State): PlayerId | null;
  listLegalActions(state: State, playerId: PlayerId): readonly Action[];
  isSameAction(left: Action, right: Action): boolean;
  applyAction(state: State, playerId: PlayerId, action: Action): GameTransition<State>;
  getObservation(state: State, playerId: PlayerId): Observation;
  cloneState(state: State): State;
}

export interface ActionEnvelope<Action> {
  actionId: string;
  playerId: PlayerId;
  expectedRevision: number;
  action: Action;
}

export interface MatchEvent<Action> {
  sequence: number;
  revision: number;
  actionId: string;
  playerId: PlayerId;
  action: Action;
  summary: string;
  occurredAt: string;
}

export type ActionRejectionCode =
  | "unknown_player"
  | "match_completed"
  | "not_your_turn"
  | "stale_revision"
  | "illegal_action";

export interface AcceptedAction<State> {
  accepted: true;
  duplicate: boolean;
  revision: number;
  state: State;
  event: MatchEvent<unknown>;
}

export interface RejectedAction {
  accepted: false;
  duplicate: false;
  revision: number;
  code: ActionRejectionCode;
  message: string;
}

export type ActionResult<State> = AcceptedAction<State> | RejectedAction;
