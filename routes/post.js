var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var { v4: uuidv4 } = require("uuid");

const { MongoClient, dbUrl } = require("../dbConfig");

const verifyToken = (req, res, next) => {
  const header = req.headers["authorization"];
  const token = header && header.split(" ")[1];
  if (token == null)
    return res.send({ status: 401, message: "unauthorized", auth: false });
  jwt.verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) => {
    if (err)
      return res.send({ status: 403, message: "forbidded", auth: false });
    else {
      req.userId = decoded.userId;
      req.userName = decoded.userName;
      next();
    }
  });
};

//get posts
router.get("/", async function (req, res, next) {
  const client = await MongoClient.connect(dbUrl);
  try {
    const posts = await client
      .db("PicStack")
      .collection("posts")
      .find()
      .toArray();
    if (posts) {
      res.json({
        status: 200,
        message: "posts fetched successfully",
        data: posts,
      });
    }
  } catch (error) {
    console.log(error);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//get a single post
router.get("/:id", async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  try {
    const post = await client
      .db("PicStack")
      .collection("posts")
      .findOne({ postId: req.params.id });
    if (post) {
      res.json({
        status: 200,
        message: "post fetched successfully",
        data: post,
      });
    }
  } catch (error) {
  } finally {
    client.close();
  }
});

//create a post
router.post("/new", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { caption, image } = req.body;
  try {
    const user = await client
      .db("PicStack")
      .collection("users")
      .findOne({ userId: req.userId });
    if (user) {
      const post = {
        postId: uuidv4(),
        caption,
        image,
        comments: [],
        likes: [],
        createdAt: new Date(),
        postedBy: user.username,
        postedByUserId: user.userId,
      };

      const postToPosts = await client
        .db("PicStack")
        .collection("posts")
        .insertOne(post);
      const postToUser = await client
        .db("PicStack")
        .collection("users")
        .updateOne({ userId: req.userId }, { $push: { posts: post.postId } });

      if (postToPosts.acknowledged && postToUser.acknowledged) {
        res.send({ status: 201, message: "post created successfully" });
      } else {
        res.send({ status: 500, message: "post creation failed" });
      }
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "internal server error" });
  } finally {
    client.close();
  }
});

//delete post
router.delete("/delete/:postId", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);

  try {
    const deleteFromPosts = await client
      .db("PicStack")
      .collection("posts")
      .findOneAndDelete({ postId: req.params.postId });
    const deleteFromUser = await client
      .db("PicStack")
      .collection("users")
      .updateOne(
        { userId: req.userId },
        { $pull: { posts: req.params.postId } }
      );

    if (deleteFromPosts && deleteFromUser) {
      res.send({ status: 200, message: "post deleted successfully" });
    } else {
      res.send({ status: 500, message: "post deletion failed" });
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "internal server error" });
  } finally {
    client.close();
  }
});

//handle likes
router.put("/:postId/like", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { postId } = req.params;
  try {
    if (req.body.value === 1) {
      const post = await client
        .db("PicStack")
        .collection("posts")
        .updateOne({ postId: postId }, { $push: { likes: req.userId } });
      if (post) {
        res.send({ status: 201, message: "post liked successfully" });
      }
    } else {
      const post = await client
        .db("PicStack")
        .collection("posts")
        .updateOne({ postId: postId }, { $pull: { likes: req.userId } });
      if (post) {
        res.send({ status: 201, message: "post unliked successfully" });
      }
    }
  } catch (error) {
    console.log(error);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//handle bookmark
router.put("/bookmark", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { postId } = req.body;
  try {
    if (req.body.value === 1) {
      const bookmark = await client
        .db("PicStack")
        .collection("users")
        .updateOne({ userId: req.userId }, { $push: { bookmarks: postId } });
      if (bookmark) {
        res.send({ status: 201, message: "post bookmarked successfully" });
      } else {
        res.send({ status: 500, message: "Internal server error" });
      }
    } else {
      const bookmark = await client
        .db("PicStack")
        .collection("users")
        .updateOne({ userId: req.userId }, { $pull: { bookmarks: postId } });
      if (bookmark) {
        res.send({ status: 201, message: "post unbookmarked successfully" });
      } else {
        res.send({ status: 500, message: "Internal server error" });
      }
    }
  } catch (error) {
    console.log(error);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//get user bookmarks
router.get("/get/user/bookmarks", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  try {
    const userBookmarks = await client
      .db("PicStack")
      .collection("users")
      .findOne({ userId: req.userId });

    if (userBookmarks) {
      res.json({
        status: 200,
        message: "bookmarks fetched successfully",
        bookmarks: userBookmarks.bookmarks,
      });
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "internal server error" });
  } finally {
    client.close();
  }
});

//handle comments
router.put("/:postId/comment", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { postId } = req.params;
  const comment = {
    commentId: uuidv4(),
    body: req.body.comment,
    postedBy: req.userName,
    commentUserId: req.userId,
    createdAt: new Date(),
  };
  try {
    const response = await client
      .db("PicStack")
      .collection("posts")
      .updateOne({ postId: postId }, { $push: { comments: comment } });
    console.log(response);
    if (response) {
      res.send({ status: 201, message: "comment posted successfully" });
    } else {
      res.send({ status: 500, message: "Internal server error" });
    }
  } catch (error) {
    console.log(error);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//handle delete comment
router.delete("/comment/:postId/:commentId", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { postId, commentId } = req.params;
  try {
    const response = await client
      .db("PicStack")
      .collection("posts")
      .updateOne(
        { postId: postId },
        { $pull: { comments: { commentId: commentId } } }
      );
    if (response) {
      res.send({ status: 200, message: "comment deleted successfully" });
    }
  } catch (error) {
    console.log(error);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//get specific users posts, followers, following
router.get("/posts/:user", async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  const { user } = req.params;
  try {
    const userPosts = await client
      .db("PicStack")
      .collection("posts")
      .find({ postedBy: user })
      .toArray();
    const userData = await client
      .db("PicStack")
      .collection("users")
      .findOne({ username: user });

    const data = {
      posts: userPosts,
      followers: userData.followers,
      following: userData.following,
    };

    if (userPosts && userData) {
      res.send({
        status: 200,
        message: "posts fetched successfully",
        data: data,
      });
    } else {
      res.send({
        status: 404,
        message: "no posts found",
      });
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//update followers and following
router.put("/followers", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  console.log(req.body);
  try {
    if (req.userName === req.body.userName) {
      res.send({
        status: 400,
        message: "you cannot follow yourself",
      });
      return;
    }

    //if the value is 1 it means the logged in user is requesting to follow the user
    if (req.body.value === 1) {
      //updating currenlty logged in user's followers
      const currentUsersResponse = await client
        .db("PicStack")
        .collection("users")
        .updateOne(
          { userId: req.userId },
          {
            $push: {
              following: req.body.userName,
            },
          }
        );
      //updating the user who is being followed by the logged in user
      const currentUserFollowersResponse = await client
        .db("PicStack")
        .collection("users")
        .updateOne(
          { username: req.body.userName },
          { $push: { followers: req.userName } }
        );
      console.log(currentUsersResponse, currentUserFollowersResponse);
      if (currentUsersResponse && currentUserFollowersResponse) {
        res.send({ status: 201, message: "followed successfully" });
      } else {
        res.send({ status: 500, message: "Internal server error" });
      }
    } else {
      //updating currenlty logged in user's followers
      const currentUsersResponse = await client
        .db("PicStack")
        .collection("users")
        .updateOne(
          { userId: req.userId },
          {
            $pull: {
              following: req.body.userName,
            },
          }
        );
      //updating the user who is being followed by the logged in user
      const currentUserFollowersResponse = await client
        .db("PicStack")
        .collection("users")
        .updateOne(
          { username: req.body.userName },
          { $pull: { followers: req.userName } }
        );

      if (currentUsersResponse && currentUserFollowersResponse) {
        res.send({ status: 201, message: "followed successfully" });
      } else {
        res.send({ status: 500, message: "Internal server error" });
      }
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

//get currently logged in user data

router.get("/current/user", verifyToken, async (req, res) => {
  const client = await MongoClient.connect(dbUrl);
  try {
    const userData = await client
      .db("PicStack")
      .collection("users")
      .findOne({ userId: req.userId });

    if (userData) {
      const getPostImages = await client
        .db("PicStack")
        .collection("posts")
        .find()
        .toArray();
      if (getPostImages) {
        const bookmarks = [];
        const posts = [];
        getPostImages.forEach((post) => {
          if (userData.bookmarks.includes(post.postId)) {
            bookmarks.push({ postId: post.postId, image: post.image });
          }
        });
        getPostImages.forEach((post) => {
          if (userData.posts.includes(post.postId)) {
            posts.push({ postId: post.postId, image: post.image });
          }
        });

        const data = {
          username: userData.username,
          followers: userData.followers,
          following: userData.following,
          posts: posts,
          bookmarks: bookmarks,
          createdAt: userData.createdAt,
        };
        res.send({
          status: 200,
          message: "user data fetched successfully",
          data: data,
        });
      }
    } else {
      res.send({ status: 404, message: "no user found" });
    }
  } catch (e) {
    console.log(e);
    res.send({ status: 500, message: "Internal server error" });
  } finally {
    client.close();
  }
});

module.exports = router;
