import "isomorphic-fetch";
import AWS from "aws-sdk";
import "gun/lib/store";
import Gun from "gun";
import express from "express";
import bodyParser from "body-parser";
import { applyMessage, msSubscribe } from "./msGraphSubscribe";
import { getMany, getOnce } from "./utils";

require("dotenv").config();
AWS.config.region = "eu-central-1";
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
  console.log("ms subscribe");
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
  // console.log("webhook", req.body.value);
  res.send(req.query.validationToken);
});

const server = app.listen(port, () => {
  console.log(`http listen on ${port}`);
});

export const gun = Gun({
  web: server,
}) as any;

getMany("users").then((users) => {
  users.forEach(async (user: any) => {
    const auth: any = await getOnce(user.auth["#"]);
    msSubscribe(auth).catch((e) => {
      console.log(e);
      gun.get(user["_"]["#"]).set(null);
    });
  });
});
