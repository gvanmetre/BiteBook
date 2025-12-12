/* index.js */

// Declarations
const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const db = mongoose.connection;
const User = require('./models/User');
const crypto = require('crypto');
const port = process.env.PORT || 8383;
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL);
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('MongoDB connection successful!');
});

// View Engine
app.set('view engine', 'ejs');

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.set('trust proxy', true);

// Express session
app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({ 
			mongoUrl: process.env.MONGODB_URL,
			crypto: {
				secret: process.env.SESSION_SECRET
			}
		})
	})
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure the Local Strategy
passport.use(new LocalStrategy(User.authenticate()));

// Serialize and deserialize user (required for session support)
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Serve static files
app.use(express.static('public'));

// Define routes
const routes = require('./routes/routes');
app.use('/', routes);

// Handle 404 errors
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Handle 500 errors
app.use(function(err, req, res, next) {
    //console.error(`Error: ${err.message}\nFrom: IP: ${ip}\nRequest Page: ${requestPage}\n${err.stack}`);
    res.status(err.status || 500);
    res.redirect('/');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});