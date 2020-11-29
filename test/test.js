const Gun = require("gun");
const gun = Gun("https://peaceful-woodland-02086.herokuapp.com/gun");

gun
  .get(
    "teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:2f3eb6a112a749bcb06f2af697cf35bd@thread.tacv2/messages"
  )
  .on((a) => console.log(a));
