require("dotenv").config();

import "isomorphic-fetch";
import Gun from "gun";
import express from "express";
import bodyParser from "body-parser";
import { applyMessage, msSubscribe } from "./msGraphSubscribe";
import { getMany, getOnce } from "./utils";

const port =
  process.env.OPENSHIFT_NODEJS_PORT ||
  process.env.VCAP_APP_PORT ||
  process.env.PORT ||
  process.argv[2] ||
  8764;

const app = express();
app.use(bodyParser.json());
// @ts-ignore
app.use(Gun.serve).use(express.static(__dirname));

app.post("/ms-subscribe", async (req, res) => {
  console.log("login");
  try {
    const user = await msSubscribe(req.body);
    res.json(user);
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/webhook", async (req, res) => {
  if (!req.body.value) {
    return res.send(req.query.validationToken);
  }
  for (const message of req.body.value as any[]) {
    applyMessage(message.subscriptionId, message.resource);
  }
  res.send(req.query.validationToken);
});

const server = app.listen(port, () => {
  console.log(`http listen on ${port}, url: ${process.env.APP_URL}`);
});

export const gun = Gun({
  web: server,
}) as any;

getMany("subscribers").then((users) => {
  users.forEach(async (user: any) => {
    const auth: any = await getOnce(user.auth["#"]);
    msSubscribe(auth).catch((e) => {
      console.log(e);
      gun.get(user["_"]["#"]).set(null);
    });
  });
});
