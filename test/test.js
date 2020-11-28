const Gun = require("gun");
const gun = Gun("http://localhost:8764/gun");

gun.get("me/teams").once(async (msg) => {
  console.log(msg);
});
