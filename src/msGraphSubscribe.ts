import { Client } from "@microsoft/microsoft-graph-client";
import { gun } from "./index";
import { MsSubscribeRequest } from "./interface";
import { getOnce } from "./utils";

const subscriptions = new Map<string, any>();
const notificationUrl = `${process.env.APP_URL}/webhook`;
const syncedMessages = [];

function confirm(message?: string) {
  return (ack: any) => {
    if (ack.err) {
      throw new Error(ack.err + "");
    }
    if (message) {
      console.log(message);
    }
  };
}
async function createClientByUserId(userId: string) {
  const auth = await getOnce(`subscribers/${userId}/auth`);
  if (!auth) {
    throw new Error("cannot add message (no auth)");
  }
  return createClient(auth.accessToken);
}

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

async function fetchUser(client: Client) {
  const users = await client
    .api("/users")
    .select([
      "displayName",
      "id",
      "jobTitle",
      "mail",
      "mobilePhone",
      "officeLocation",
      "preferredLanguage",
      "surname",
      "userPrincipalName",
      "givenName",
    ])
    .get();
  for (const user of users.value) {
    gun.get(`${client["userId"]}/users`).get(user.id).put(user, confirm());
  }
}

async function fetchSites(client: Client) {
  const sites = await client
    .api("/sites?search=devticon")
    .select([
      "id",
      "createdDateTime",
      "lastModifiedDateTime",
      "name",
      "webUrl",
      "displayName",
    ])
    .get();
  const _sites: Record<string, any> = {};
  for (const site of sites.value) {
    _sites[site.id] = site;
  }
  gun.get(`${client["userId"]}/sites`).put(_sites, confirm());
}
async function fetchLists(client: Client) {
  const _lists: Record<string, any> = {};
  const lists = await client.api("/sites/root/lists").get();
  for (const list of lists.value) {
    const details = await client.api(`/sites/root/lists/${list.id}/list`).get();
    _lists[details.id] = details;
    _lists[details.id].items = {};
    const items = await client.api(`/sites/root/lists/${list.id}/items`).get();
    for (const item of items.value) {
      _lists[details.id].items[item.id] = await client
        .api(`/sites/root/lists/${list.id}/items/${item.id}`)
        .get();
    }
  }
  gun.get(`${client["userId"]}/sharepoint/lists`).put(_lists);
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
async function getUser(client: Client): Promise<any> {
  const user = await client
    .api("/me")
    .select([
      "displayName",
      "id",
      "jobTitle",
      "mail",
      "mobilePhone",
      "officeLocation",
      "preferredLanguage",
      "surname",
      "userPrincipalName",
      "givenName",
    ])
    .get();

  user.teams = {};
  return new Promise((resolve) => {
    gun.get(user.id).put(user, (ack) => {
      if (ack.err) {
        console.log(ack);
        throw new Error(ack.err);
      }
      console.log("save current user");
      resolve(user);
    });
  });
}

async function subscribeChat(client: Client) {
  const teams = await client
    .api(`/me/joinedTeams`)
    .select(["id", "displayName", "description"])
    .get();

  const user = await getOnce(client["userId"]);
  for (const team of teams.value) {
    user.teams[team.id] = team;
    team.channels = await client
      .api(`/teams/${team.id}/channels`)
      .get()
      .then(({ value }) => {
        const channels: any = {};
        value.forEach(async (channel) => {
          const path = `/teams/${team.id}/channels/${channel.id}/messages`;
          watchChannelToSyncMessages(team.id, channel.id);
          createSubscription(client, path);
          channel.messages = await client
            .api(`/teams/${team.id}/channels/${channel.id}/messages`)
            .get()
            .then(({ value }) => {
              const messages = {};
              value.forEach(
                (message) => (messages[message.id] = clearMessage(message))
              );
              return messages;
            });
          channels[channel.id] = channel;
        });
        return channels;
      });
    team.members = await getMembers(client, team.id).then(({ value }) => {
      const list = {};
      value.forEach(async (i) => (list[i.id] = i));
      return list;
    });

    gun.get("teams").get(team.id).put(team, confirm());
  }
  gun.get(client["userId"]).put(user, confirm("current user updated"));
}

function getMembers(client: Client, teamId: string) {
  return client
    .api(`/groups/${teamId}/members`)
    .select([
      "displayName",
      "id",
      "jobTitle",
      "mail",
      "mobilePhone",
      "officeLocation",
      "preferredLanguage",
      "surname",
      "userPrincipalName",
      "givenName",
    ])
    .get();
}
function clearMessage(message: any) {
  message.content = message.body.content;
  message.contentType = message.body.contentType;
  message.userId = message.from.user.id;
  message.userDisplayName = message.from.user.displayName;
  delete message.reactions;
  delete message.attachments;
  delete message.mentions;
  delete message.body;
  return message;
}
async function watchChannelToSyncMessages(teamId: string, channelId: string) {
  gun
    .get(`teams`)
    .get(teamId)
    .get("channels")
    .get(channelId)
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
            .api(`/teams/${teamId}/channels/${channelId}/messages`)
            .post({ body: { content: message.content } });
        } catch (e) {
          console.log(e.body);
        }
      }
    });
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
  message.userId = message.from.user.id;
  message.userDisplayName = message.from.user.displayName;
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
  console.time("ms subscribe " + user.mail);
  gun.get(`subscribers`).get(user.id).put({ user, auth: request });

  (async () => {
    // await getSubscriptions(client);
    await Promise.all([
      fetchLists(client).then(() => console.log("lists done sync", user.mail)),
      subscribeChat(client).then(() =>
        console.log("chat done sync", user.mail)
      ),
      fetchUser(client).then(() => console.log("users done sync", user.mail)),
      fetchSites(client).then(() => console.log("sites done sync", user.mail)),
    ]).then(() => console.timeEnd("ms subscribe " + user.mail));
  })();

  return user;
}
