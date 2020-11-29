const Gun = require("gun");
const gun = Gun("https://peaceful-woodland-02086.herokuapp.com//gun");

gun
  .get(
    "3cda5bc2-6ddd-4e74-8c55-dea0cd292593/teams/0106420f-7661-4ce8-9302-6edf33c96c0f/channels/19:be68d750843f40aca9c7c6f1fd349598@thread.tacv2/messages"
  )
  .on((a) => console.log(a));
