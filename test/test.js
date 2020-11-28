const Gun = require("gun");
const gun = Gun("http://localhost:8764/gun");

gun
  .get(
    "teams/14db0bf0-34a7-4b10-a894-ab916d9bcad6/channels/19:b3b5489345fe475a8e885088309ec555@thread.tacv2"
  )
  .once(async (msg) => {
    console.log(msg);
  });
