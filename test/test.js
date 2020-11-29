const Gun = require("gun");
const gun = Gun("https://devticon.loca.lt/gun");

gun
  .get(
    "1fa117f9-b061-4c10-9309-2f15a875a9c0/teams/0106420f-7661-4ce8-9302-6edf33c96c0f"
  )
  .on((a) => console.log(a));
