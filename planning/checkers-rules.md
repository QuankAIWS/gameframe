# American Checkers Rules Profile

## Scope

`american-checkers` is the first nontrivial reusable game module in Scribbles GameFrame. It uses an 8x8 board, twelve pieces per player, deterministic legal-action enumeration, the shared authoritative match session, and the versioned agent-decision boundary.

The first player ID occupies the black seat and moves first. The second player ID occupies the red seat.

## Board and pieces

- Only the 32 dark squares are playable.
- Black begins on rows 0 through 2 and moves toward row 7.
- Red begins on rows 5 through 7 and moves toward row 0.
- Each side begins with twelve men.
- A piece has a stable ID, color, rank, and square.
- Kings are short-range kings rather than flying kings.

## Quiet movement

- A man moves one empty diagonal square forward.
- A king moves one empty diagonal square forward or backward.
- A quiet move is illegal whenever any capture is available to the active player.

## Captures

- Capturing is mandatory.
- Men capture only in their forward diagonal directions.
- Kings capture forward or backward.
- A capture jumps one adjacent opposing piece and lands on the empty square immediately beyond it.
- If the same piece can capture again after landing, the capture sequence must continue.
- When several capture sequences are available, the player may choose any complete sequence. American Checkers does not require selection of the sequence that captures the greatest number of pieces.
- Captured pieces are removed while the sequence is being evaluated, allowing subsequent jumps to use the resulting board.

## Promotion

- A man reaching the opponent's back row becomes a king.
- Promotion ends the turn immediately.
- A newly crowned king does not continue a capture sequence until its next turn, even if a backward capture would otherwise be available.

## Turn action representation

One authoritative `CheckersAction` represents one complete turn:

```ts
{
  type: "move",
  pieceId: "black-7",
  from: 17,
  path: [35, 53],
  capturedPieceIds: ["red-4", "red-9"]
}
```

- `from` is the piece's square before the turn.
- `path` contains every landing square in order.
- `capturedPieceIds` contains every captured piece in order.
- Quiet moves contain one landing square and no captured IDs.
- Capture actions contain the complete terminal sequence rather than one network command per jump.

This representation keeps revisions, event replay, idempotency, agent requests, and browser submission aligned. The later browser may collect a path incrementally for presentation, but it submits only a currently enumerated complete action.

## Win conditions

The active player wins after a legal turn when the opponent:

- has no remaining pieces; or
- has pieces but no legal move or capture.

A blocked player loses; the position is not a stalemate draw.

## Deterministic draw policy

Formal and casual American Checkers environments vary in how draws are administered. GameFrame therefore records an explicit deterministic platform policy:

- Three occurrences of the same board position with the same active color produce a draw.
- Eighty consecutive plies without a capture or promotion produce a draw.
- A capture or promotion resets the no-progress counter.
- A win caused by elimination or blockade takes precedence over an automatic draw check on the same transition.

The draw counters are authoritative state and must survive snapshot restoration and event replay.

## Observation and agent boundary

A player observation contains:

- a 64-square board projection;
- the player's assigned color;
- the active player ID;
- game status;
- the complete current legal-action list;
- whether a capture is mandatory; and
- the no-progress counter.

The deterministic Checkers player chooses only from the supplied legal-action list. Future mock and Scribbles Runtime providers use the existing versioned decision-provider contract; GameFrame still validates the selected action against the current legal list before commit.

## GF-0006 acceptance boundary

GF-0006 proves:

- initial setup and movement;
- mandatory capture enforcement;
- complete multi-jump enumeration;
- promotion and king behavior;
- elimination and blockade wins;
- repetition and no-progress draws;
- state cloning and deterministic self-play; and
- compatibility with the generic game and agent contracts.

GF-0006 does not claim a finished Checkers browser, deployed Checkers service, Discord delivery, Cloudflare deployment, or remote Scribbles Runtime agent. Those belong to the later full-stack proof.
