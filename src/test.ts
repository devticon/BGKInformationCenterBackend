import Gun from "gun";
const gun = Gun() as any;

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
gun.get("users").once(console.log);
const path =
  "teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:be68d750843f40aca9c7c6f1fd349598@thread.tacv2";
process.stdin.on("data", (data) => {
  gun.get(path).get("messages-to-sync").set({
    content: data.toString(),
    userId: "1fa117f9-b061-4c10-9309-2f15a875a9c0",
  });
});
// gun
//   .get(path)
//   .get("messages")
//   .map()
//   .on(async (msg: any) => {
//     console.log(msg.createdDateTime, msg.content);
//   });
