const Gun = require("gun");
const gun = Gun("https://devticon.loca.lt/gun");

gun
  .get(
    "1fa117f9-b061-4c10-9309-2f15a875a9c0/users/e095803b-632f-4f20-993c-bf5326c492f2"
  )
  .on((a) => console.log(a));
