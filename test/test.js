const Gun = require("gun");
const gun = Gun("https://peaceful-woodland-02086.herokuapp.com/gun");

gun.get("3cda5bc2-6ddd-4e74-8c55-dea0cd292593/teams").on((a) => console.log(a));
