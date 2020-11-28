import Gun from "gun";
const gun = Gun("http://localhost:8764") as any;

export function getOnce(path: string): Promise<any> {
  return new Promise((resolve) =>
    gun.get(path).once((data) => {
      resolve(data);
    })
  );
}

// gun.get("message-to-sync").set({
//   teamId,
//   channelId,
//   userId,
//   content,
// });
gun
  .get(
    "teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:be68d750843f40aca9c7c6f1fd349598@thread.tacv2/messages"
  )
  .once(async (msg: any) => {
    console.log(msg);
  });
