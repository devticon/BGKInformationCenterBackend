const Gun = require("gun");
const gun = Gun("https://peaceful-woodland-02086.herokuapp.com/gun");

gun.get("rss").on(async (msg) => {
  console.log(msg);
});
