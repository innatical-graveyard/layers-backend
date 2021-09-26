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

export const channels = new EventEmitter<{
  [key: string]: (data: MessageEvent) => void;
}>();
