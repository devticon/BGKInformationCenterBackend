import Gun from "gun";
const gun = Gun();

export function getOnce(path: string): Promise<any> {
  return new Promise((resolve) =>
    gun.get(path).once((data) => {
      resolve(data);
    })
  );
}

gun
  .get(
    "teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:2f3eb6a112a749bcb06f2af697cf35bd@thread.tacv2/messages"
  )
  .map()
  .on(async (msg: any) => {
    // console.log(msg);
    console.log(msg.createdDateTime, msg.content);
    // const body = await getOnce(msg.body["#"]);
    // console.log(body);
  });
