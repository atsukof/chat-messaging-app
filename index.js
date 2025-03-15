require('./utils');
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('./mongoose')
const bcrypt = require('bcrypt');
const saltRounds = 12;

const app = express();
app.set('view engine', 'ejs');

const database = include('./databaseConnection');
const db_utils = include('database/db_utils');
const db_users = include('database/users');
const success = db_utils.printMySQLVersion();

const store = new MongoDBStore({
    uri: process.env.MONGODB_URI,
    collection: 'sessions',
    crypto: {
        secret: process.env.SESSION_SECRET
    }
});

store.on('error', function (error) {
    console.log('Mongo DB error:', error);
});

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        saveUninitialized: false,
        store: store,
        cookie: {
            maxAge: 1000 * 60 * 60,
            httpOnly: true,
        },
    })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname + "/public")); // use public folder for static files

// temporary users array
const users = [];

// check if user is logged in
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/');
    }
}

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        res.render("index", {
            isLoggedIn: true,
            username: req.session.user.username
        });
    } else {
        res.render("index", {
            isLoggedIn: false
        });
    }
});

// login
app.get('/login', (req, res) => {
    res.render("login", { error: null, username: '' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'All fields are required', username });
    }

    try {
        const [rows] = await database.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.render('login', { error: 'Invalid username or password', username });
        }

        const hashedPassword = rows[0].password;
        const isMatch = await bcrypt.compare(password, hashedPassword); // check if password is correct

        if (!isMatch) {
            return res.render('login', { error: 'Invalid username or password', username });
        }

        req.session.user = { username };
        res.redirect('/');

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


//signup
app.get('/signup', (req, res) => {
    res.render("signup", { error: null, username: '' });
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('signup', { error: 'All fields are required', username });
    }

    try {
        const [existingRows] = await database.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingRows.length > 0) {
            return res.render('signup', { error: 'Username is already taken.', username });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await database.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

        req.session.user = { username };
        res.redirect('/');

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }

});

//members
app.get('/members', (req, res) => {
    requireLogin(req, res);
    const username = req.session.user.username;
    const images = ['ukiyoe1.webp', 'ukiyoe2.webp', 'ukiyoe3.webp'];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.render("members", { username, randomImage });

});

//logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Failed to logout');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});


app.get("*", (req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});



