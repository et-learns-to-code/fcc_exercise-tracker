const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
mongoose.connect(process.env["MONGO_URI"]);

// parses json data into req.body
app.use(express.json());

// parses url-encoded data into req.body
app.use(express.urlencoded({ extended: false }));

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// defines and creates User Model
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
  },
  { versionKey: false },
);

const User = mongoose.model("User", userSchema);

// defines and creates Exercise Model
const exerciseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date },
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { versionKey: false },
);

const Exercise = mongoose.model("Exercise", exerciseSchema);

// first checks if user exists and fetches id for them
// otherwise, saves new user to the database and generates an id for them
app.post("/api/users", async (req, res) => {
  try {
    username = req.body.username;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.json(existingUser);
    } else {
      const newUser = new User({
        username,
      });
      const savedUser = await newUser.save();
      res.json(savedUser);
    }
  } catch (err) {
    res.json(err.message);
  }
});

// retrieves list of all users
app.get("/api/users", (req, res) => {
  User.find()
    .then((allUsers) => res.json(allUsers))
    .catch((err) => res.json(err.message));
});

// saves exercise log to the database
app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const username = await User.findById(req.params._id).select("-_id");
    if (!username) {
      res.send("User does not exist.");
      return;
    }
    const newExercise = new Exercise({
      description: req.body.description,
      duration: req.body.duration,
      userID: req.params._id,
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });
    const savedExercise = await newExercise.save();
    // retrieves exercise log that was just saved
    const retrievedExercise = await Exercise.findById(savedExercise._id).select(
      "-_id",
    );
    // Mongoose documents contain metadata and state information
    // .toObject() converts the Mongoose documents to a plain Javascript object. Date object is preserved so .toDateString() can be called on it straightaway.
    const {
      description,
      duration,
      date,
      userID: _id,
    } = retrievedExercise.toObject();
    res.json({
      ...username.toObject(),
      description,
      duration,
      date: date.toDateString(),
      _id,
    });
  } catch (err) {
    res.json(err.message);
  }
});

// retrieves exercise logs of a given user
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const username = await User.findById(req.params._id).select("-_id");
    if (!username) {
      res.send("User does not exist.");
      return;
    }

    const { from, to, limit } = req.query;
    // sets up query filter
    const query = { userID: req.params._id };
    const dateQuery = {};
    if (from) {
      dateQuery.$gte = new Date(from);
    }
    if (to) {
      dateQuery.$lte = new Date(to);
    }
    // only attach date query if either 'from' or 'to' parameters filled
    if (from || to) {
      query.date = dateQuery;
    }
    // sets up limit filter
    const options = {};
    if (limit) {
      options.limit = Number(limit);
    }

    const exerciseLogs = await Exercise.find(query, null, options).select(
      "-_id -userID",
    );
    const exerciseCount = exerciseLogs.length;
    // maps over exercise logs to fix time format
    // date returned from Mongoose is a string, so date constructor has to be called on log.date to recreate Date object first
    const formattedLogs = exerciseLogs.map((log) => {
      return {
        description: log.description,
        duration: log.duration,
        date: new Date(log.date).toDateString(),
      };
    });
    res.json({
      ...username.toObject(),
      count: exerciseCount,
      _id: req.params._id,
      log: formattedLogs,
    });
  } catch (err) {
    res.json(err.message);
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
