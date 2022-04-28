require("dotenv").config();
const mongodb = require("mongodb");
const dbUrl = process.env.DB_URL;
const MongoClient = mongodb.MongoClient;

module.exports = { mongodb, dbUrl, MongoClient };
