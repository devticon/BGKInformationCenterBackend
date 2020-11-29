const Gun = require("gun");
const gun = Gun("https://devticon.loca.lt/gun");

gun.get("1fa117f9-b061-4c10-9309-2f15a875a9c0/teams").on((a) => console.log(a));
