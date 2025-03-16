require('./utils');
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('./mongoose')
const bcrypt = require('bcrypt');
const saltRounds = 12;

const fs = require('fs');
const path = require('path');
const { get } = require('http');

const app = express();
app.set('view engine', 'ejs');

const database = include('./databaseConnection');
const db_utils = include('database/db_utils');
const success = db_utils.printMySQLVersion();

const db_users = include('database/users');
const db_create_tables = include('database/create_tables');

async function setupTables() {
    // setup tables if they don't exist
    if (success) {
        try {
            await db_create_tables.createTables();
        } catch (error) {
            console.error('error:', error);
        }
    } else {
        console.error('Failed to connect to MySQL');
    }
}

setupTables();


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
        const [rows] = await database.query('SELECT * FROM user WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.render('login', { error: 'Invalid username or password', username });
        }

        const hashedPassword = rows[0].password;
        const isMatch = await bcrypt.compare(password, hashedPassword); // check if password is correct

        if (!isMatch) {
            return res.render('login', { error: 'Invalid username or password', username });
        }

        // req.session.user = { username };
        req.session.user = {
            user_id: rows[0].user_id,
            username: rows[0].username
        };

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
        const [existingRows] = await database.query('SELECT * FROM user WHERE username = ?', [username]);
        if (existingRows.length > 0) {
            return res.render('signup', { error: 'Username is already taken.', username });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await database.query('INSERT INTO user (username, password) VALUES (?, ?)', [username, hashedPassword]);

        req.session.user = { username };
        res.redirect('/');

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }

});

//members
app.get('/members', async (req, res) => {
    requireLogin(req, res);
    const username = req.session.user.username;
    const images = ['ukiyoe1.webp', 'ukiyoe2.webp', 'ukiyoe3.webp'];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    const getRoomListQuery = fs.readFileSync(abs_path('/queries/get_room_list.sql'), 'utf8');
    let rooms;

    try {
        [rooms] = await database.query(getRoomListQuery, [username])
    } catch (error) {
        console.error("Error fetching chat rooms:", error);
        res.status(500).send("Server error");
    }
    
    res.render("members", { username, randomImage, rooms });

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

// chat room
app.get('/room/:room_id', async (req, res) => {
    requireLogin(req, res);

    const username = req.session.user.username;
    const userId = req.session.user.user_id;
    const roomId = req.params.room_id;

    const getMessagesQuery = fs.readFileSync(abs_path('/queries/get_messages.sql'), 'utf8');
    const getReactedEmojisQuery = fs.readFileSync(abs_path('/queries/get_reacted_emojis.sql'), 'utf8');

    console.log(roomId)

    try {
        // check if user is a member of the room
        const [membership] = await database.query(
            `SELECT ru.room_user_id 
             FROM room_user ru
             WHERE ru.room_id = ? AND ru.user_id = ?`,
            [roomId, userId]
        );

        if (membership.length === 0) {
            return res.status(400).send('Bad Request: You are not a member of this room.');
        }

        console.log(roomId)
        // get messages for the room
        const [messages] = await database.query(getMessagesQuery, [userId, roomId]);
        // get reacted emojis
        const [reactedEmojis] = await database.query(getReactedEmojisQuery, [roomId]);

        res.render('room', { roomId, messages, reactedEmojis, userId, username });

    } catch (error) {
        console.error('Error fetching messages for room:', error);
        res.status(500).send('Server error');
    }
});



app.get("*", (req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});



