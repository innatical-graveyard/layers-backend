const fs = require("fs");

if (process.argv[2] === "resource") {
  process.argv[3];
  fs.writeFileSync(
    "./resources/" + process.argv[3] + ".ts",
    `import * as trpc from "@trpc/server";
import type { Context } from "./_app";

const ${process.argv[3]} = trpc.router<Context>();

export default ${process.argv[3]};
`
  );
  const routes = fs.readFileSync("./resources/_routes.ts", {
    encoding: "utf-8",
  });

  const newRoutes = routes.substr(0, routes.lastIndexOf(";")).split("\n");
  newRoutes.splice(
    1,
    0,
    `import ${process.argv[3]}Router from "./${process.argv[3]}";`
  );

  newRoutes.push(`  .merge("${process.argv[3]}.", ${process.argv[3]}Router);`);
  fs.writeFileSync("./resources/_routes.ts", newRoutes.join("\n"));
}
