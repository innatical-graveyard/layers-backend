import http, { IncomingMessage, ServerResponse } from "http";
import sparkConfig from "../spark.json";
import { handler } from "../resources/_app";

interface Config {
  cors: string[] | boolean;
}

const config: Config = sparkConfig;

const httpHandler = (req: IncomingMessage, res: ServerResponse) => {
  if (config.cors === true) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
  } else if (
    typeof config.cors === "object" &&
    config.cors.includes(req.headers.origin!)
  ) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin!);
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
  }

  handler(req, res);
};

export const viteNodeApp = httpHandler;
