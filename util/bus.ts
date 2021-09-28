import { EncryptedMessage } from "@innatical/inncryption";
import { EventEmitter } from "tsee";

export interface MessageEvent {
  type: "message";
  id: string;
  createdAt: string;
  updatedAt?: string;
  payload: EncryptedMessage;
  author: string;
}

export interface SignalEvent {
  type: "signal";
  from: string;
  data: EncryptedMessage;
}

export interface AnswerEvent {
  type: "answer";
  from: string;
}

export interface RingEvent {
  type: "ring";
  channel: string;
}

export type ChannelEvent = MessageEvent | SignalEvent | AnswerEvent;
export type UserEvent = RingEvent;

export const channels = new EventEmitter<{
  [key: string]: (data: ChannelEvent) => void;
}>();

export const users = new EventEmitter<{
  [key: string]: (data: UserEvent) => void;
}>();
