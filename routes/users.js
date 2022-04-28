var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
var { v4: uuidv4 } = require("uuid");

var { mongodb, MongoClient, dbUrl } = require("../dbConfig");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("ok");
});

//Register a new user
router.post("/register", async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  try {
    const { username, password } = req.body;
    const users = client.db("PicStack").collection("users");
    const user = await users.findOne({ username: username });
    if (user) {
      res.json({ status: 400, message: "User already exists" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        username,
        password: hashedPassword,
        createdAt: new Date(),
        userId: uuidv4(),
        posts: [],
        bookmarks: [],
        followers: [],
        following: [],
      };
      const result = await users.insertOne(newUser);
      if (result.acknowledged) {
        res.json({ status: 201, message: "User created successfully" });
      } else {
        res.json({ status: 500, message: "User creation failed" });
      }
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//Login a user
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const client = await MongoClient.connect(dbUrl);
  try {
    const users = client.db("PicStack").collection("users");
    const user = await users.findOne({ username: username });
    if (user) {
      const comparedPassword = await bcrypt.compare(password, user.password);
      if (comparedPassword) {
        const token = jwt.sign(
          { userId: user.userId, userName: user.username },
          process.env.TOKEN_SECRET_KEY
        );
        res.json({
          status: 200,
          auth: true,
          message: "Login successful",
          token: token,
          user: { username: user.username, userId: user.userId },
        });
      } else {
        res.json({ status: 400, auth: false, message: "Invalid credentials" });
      }
    } else {
      res.json({ status: 400, auth: false, message: "User doesn't exist" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

module.exports = router;
