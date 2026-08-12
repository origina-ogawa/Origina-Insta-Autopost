import { useReducer } from "react";
import { ACTORS, type ActorId } from "../theme";
import { useEventPolling, type LogEvent } from "../lib/eventLog";

export type ActorState = {
  phase: string | null;
  event: LogEvent["event"] | null;
  message: string;
  ticket: string | null;
  target: string | null;
  active: boolean;
  /** イベントを受け取るたびに増える値。同じevent種別が連続してもアニメーションを再トリガーするために使う */
  seq: number;
};

export type OfficeState = {
  actors: Record<ActorId, ActorState>;
  recentEvents: LogEvent[];
};

const INITIAL_ACTOR_STATE: ActorState = {
  phase: null,
  event: null,
  message: "",
  ticket: null,
  target: null,
  active: false,
  seq: 0,
};

function initialState(): OfficeState {
  const actors = {} as Record<ActorId, ActorState>;
  for (const actor of ACTORS) actors[actor] = INITIAL_ACTOR_STATE;
  return { actors, recentEvents: [] };
}

function isKnownActor(actor: string): actor is ActorId {
  return (ACTORS as string[]).includes(actor);
}

const RECENT_EVENTS_LIMIT = 8;

function reduce(state: OfficeState, events: LogEvent[]): OfficeState {
  let actors = state.actors;
  let recentEvents = state.recentEvents;

  for (const ev of events) {
    if (!isKnownActor(ev.actor)) continue; // "system"等のフックログは表示対象外

    const prevActor = actors[ev.actor];
    actors = {
      ...actors,
      [ev.actor]: {
        phase: ev.phase,
        event: ev.event,
        message: ev.message,
        ticket: ev.ticket,
        target: ev.target,
        active: ev.event !== "done",
        seq: prevActor.seq + 1,
      },
    };
    recentEvents = [ev, ...recentEvents].slice(0, RECENT_EVENTS_LIMIT);
  }

  if (actors === state.actors && recentEvents === state.recentEvents) return state;
  return { actors, recentEvents };
}

// logs/events.jsonl をポーリングし、actorごとの最新状態と直近イベント一覧を保持する。
export function useOfficeState(): OfficeState {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  useEventPolling(dispatch);
  return state;
}
