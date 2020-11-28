const Gun = require("gun");
const gun = Gun("https://peaceful-woodland-02086.herokuapp.com/gun");

gun
  .get(
    "teams/14db0bf0-34a7-4b10-a894-ab916d9bcad6/channels/19:b3b5489345fe475a8e885088309ec555@thread.tacv2/messages/1606600337967"
  )
  .on(async (msg) => {
    console.log(msg);
  });
