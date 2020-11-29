const Gun = require("gun");
const gun = Gun("https://devticon.loca.lt/gun");

gun
  .get(
    "3cda5bc2-6ddd-4e74-8c55-dea0cd292593/teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:2f3eb6a112a749bcb06f2af697cf35bd@thread.tacv2"
  )
  .on((a) => console.log(a));
