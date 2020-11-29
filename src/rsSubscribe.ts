import { gun } from "./index";

let Parser = require("rss-parser");
let parser = new Parser();

export interface RssChannel {
  source: string;
  name: string;
  icon: string;
}
export async function rsSubscribe(channels: RssChannel[]) {
  const _feed: Record<string, any> = {};
  let _feedArr: any[] = [];
  await Promise.all(
    channels.map((channel) => {
      return parser.parseURL(channel.source).then((feed) => {
        feed.items.forEach((f) => {
          _feedArr.push({
            ...f,
            channel_name: channel.name,
            channel_source: channel.source,
            channel_icon: channel.icon,
            id: channel.source + "_" + (f.id || f.guid || f.link),
          });
        });
      });
    })
  );

  _feedArr = _feedArr.sort(function (a, b) {
    return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
  });
  for (const _i of _feedArr) {
    _feed[_i.id] = _i;
  }
  gun.get("rss").put(_feed);
}