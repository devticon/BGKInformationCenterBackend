import { Client } from "@microsoft/microsoft-graph-client";
import { gun } from "./index";
import { MsSubscribeRequest } from "./interface";
import { getOnce } from "./utils";

const subscriptions = new Map<string, any>();
const notificationUrl = `${process.env.APP_URL}/webhook`;
const syncedMessages = [];

async function createClientByUserId(userId: string) {
  const auth = await getOnce(`users/${userId}/auth`);
  if (!auth) {
    throw new Error("cannot add message (no auth)");
  }
  return createClient(auth.accessToken);
}

function createClient(accessToken: string) {
  console.log("client", accessToken);
  return Client.initWithMiddleware({
    authProvider: {
      async getAccessToken() {
        return accessToken;
      },
    },
    defaultVersion: "beta",
  });
}

async function fetchLists(client: Client) {
  const lists = await client.api("/sites/root/lists").get();
  for (const list of lists.value) {
    const details = await client.api(`/sites/root/lists/${list.id}/list`).get();
    // await createSubscription(client, `/sites/root/lists/${list.id}`);
    gun
      .get("me/sharepoint/lists")
      .get(list.id)
      .put({ ...list, ...details });

    const items = await client.api(`/sites/root/lists/${list.id}/items`).get();
    for (const item of items.value) {
      try {
        const itemDetails = await client
          .api(`/sites/root/lists/${list.id}/items/${item.id}`)
          .get();
        gun
          .get("me/sharepoint/lists")
          .get(list.id)
          .get("items")
          .get(item.id)
          .put(itemDetails);
      } catch (e) {
        console.log(e);
      }
    }
  }
}

async function createSubscription(client: Client, resource: string) {
  const subscription = {
    changeType: "created,updated",
    notificationUrl,
    resource,
    expirationDateTime: new Date(Date.now() + 60 * 60 * 58),
    clientState: "secretClientValue",
    latestSupportedTlsVersion: "v1_2",
    includeResourceData: false,
  };

  try {
    if (!subscriptions.has(resource)) {
      console.log("setup subscription", resource);
      const { id } = await client.api("/subscriptions").post(subscription);
      subscriptions.set(resource, {
        id,
        userId: client["userId"],
      });
    }
  } catch (e) {
    if (e.code === "ExtensionError") {
      return console.log("subscription already exist", resource);
    } else {
      console.log(e);
    }
  }
}
async function getUser(client: Client) {
  return client.api("/me").get();
}

async function subscribeChat(client: Client) {
  const teams = await client.api(`/me/joinedTeams`).get();
  for (const team of teams.value) {
    gun.get("teams").get(team.id).put(team);
    gun.get("me/teams").get(team.id).put(team);
    try {
      const channels = await client.api(`/teams/${team.id}/channels`).get();
      const members = await client.api(`/groups/${team.id}/members`).get();
      for (const member of members.value) {
        delete member.provisionedPlans;
        delete member.onPremisesProvisioningErrors;
        delete member.identities;
        delete member.deviceKeys;
        delete member.assignedPlans;
        delete member.assignedLicenses;
        delete member.proxyAddresses;
        delete member.otherMails;
        delete member.imAddresses;
        delete member.infoCatalogs;
        delete member.businessPhones;
        gun.get(`teams`).get(team.id).get("members").get(member.id).put(member);
      }
      for (const channel of channels.value) {
        await createSubscription(
          client,
          `/teams/${team.id}/channels/${channel.id}/messages`
        );
        gun
          .get(`teams`)
          .get(team.id)
          .get("channels")
          .get(channel.id)
          .put(channel);
        const messages = await client
          .api(`/teams/${team.id}/channels/${channel.id}/messages`)
          .get();

        gun
          .get(`teams`)
          .get(team.id)
          .get("channels")
          .get(channel.id)
          .get("messages-to-sync")
          .map()
          .on(async (message) => {
            if (
              message &&
              message.content &&
              message.userId &&
              !syncedMessages.includes(message._["#"])
            ) {
              console.log("new message to sync", { msg: message.content });
              syncedMessages.push(message._["#"]);
              const p = message._["#"].split("/");
              const id = p.pop();
              gun.get(p.join("/")).get(id).put(null);
              try {
                await (await createClientByUserId(message.userId))
                  .api(`/teams/${team.id}/channels/${channel.id}/messages`)
                  .post({ body: { content: message.content } });
              } catch (e) {
                console.log(e.body);
              }
            }
          });
        for (const message of messages.value) {
          putMessage(message);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  // await createSubscription(client, `/sites/root/lists/${list.id}`);
  // await createSubscription(client, "/teams/getAllMessages");
}

async function getSubscriptions(client: Client) {
  const _subscriptions = await client.api("/subscriptions").get();
  await Promise.all(
    _subscriptions.value.map((s) => {
      console.log("delete subscription", s.resource);
      return client.api(`/subscriptions/${s.id}`).delete();
    })
  );
}

export function putMessage(message: any) {
  message.content = message.body.content;
  message.contentType = message.body.contentType;
  delete message.reactions;
  delete message.attachments;
  delete message.mentions;
  delete message.body;
  gun
    .get(`teams`)
    .get(message.channelIdentity.teamId)
    .get("channels")
    .get(message.channelIdentity.channelId)
    .get("messages")
    .get(message.id)
    .put(message, (ack) => {
      if (ack.err) {
        throw new Error(ack.err);
      }
    });
}
export async function applyMessage(subscriptionId: string, resource: string) {
  console.log("message for server", resource);
  const mapped = resource
    .replace(/\(/gm, "/")
    .replace(/\)/gm, "")
    .replace(/'/gm, "");
  const subscribe = Array.from(subscriptions.values()).find(
    (s) => s.id === subscriptionId
  );
  if (subscribe) {
    const client = await createClientByUserId(subscribe.userId);
    const message = await client.api(mapped).get();
    putMessage(message);
    console.log("new message", { path: mapped });
  } else {
    console.log("no subscribe");
  }
}
export async function msSubscribe(request: MsSubscribeRequest) {
  const client = createClient(request.accessToken);
  const user = await getUser(client);
  client["userId"] = user.id;
  console.log("ms subscribe", user.mail);
  gun.get(`users`).get(user.id).put({ user, auth: request });

  await getSubscriptions(client);

  fetchLists(client);
  subscribeChat(client);
  return user;
}
