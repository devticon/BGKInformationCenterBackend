import { Client } from "@microsoft/microsoft-graph-client";
import { gun } from "./index";
import { MsSubscribeRequest } from "./interface";
import { getOnce } from "./utils";

const map = new Map();
const subscriptions = new Map<string, any>();
map.set("me/sharepoint/lists", "{userId}/sharepoint/lists");
map.set("me/sharepoint/lists/{listId}", "{userId}/sharepoint/lists/{listId}");

function createClient(accessToken: string) {
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
    notificationUrl: "https://devticon.loca.lt/webhook",
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
    console.log(e);
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
  for (const _subscription of _subscriptions.value) {
    await client.api(`/subscriptions/${_subscription.id}`).delete();
    console.log("delete subscription", _subscription.resource);
    // subscriptions.set(_subscription.resource, {
    //   id: _subscription.id,
    //   userId: client["userId"],
    // });
  }
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
  const mapped = resource
    .replace(/\(/gm, "/")
    .replace(/\)/gm, "")
    .replace(/'/gm, "");
  const subscribe = Array.from(subscriptions.values()).find(
    (s) => s.id === subscriptionId
  );

  const auth = await getOnce(`users/${subscribe.userId}/auth`);
  if (!auth) {
    return console.error("cannot add message (no auth)");
  }
  const client = createClient(auth.accessToken);
  const message = await client.api(mapped).get();
  putMessage(message);
  console.log("new message", { path: mapped });
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
