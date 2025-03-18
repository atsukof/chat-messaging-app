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

// members
app.get('/members', async (req, res) => {
    requireLogin(req, res);
    const username = req.session.user.username;
    const getRoomListQuery = fs.readFileSync(abs_path('/queries/get_room_list.sql'), 'utf8');
    let rooms;

    try {
        [rooms] = await database.query(getRoomListQuery, [username])
    } catch (error) {
        console.error("Error fetching chat rooms:", error);
        res.status(500).send("Server error");
    }
    
    res.render("members", { username, rooms });

});

// logout
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

        // get messages and emoji reactions for the room
        const [messages] = await database.query(getMessagesQuery, [userId, roomId]);
        const [reactedEmojis] = await database.query(getReactedEmojisQuery, [roomId]);
        const [roomName] = await database.query('SELECT name AS room_name FROM room WHERE room_id = ?', [roomId]);

        res.render('room', { roomId, messages, reactedEmojis, userId, username, roomName });

    } catch (error) {
        console.error('Error fetching messages for room:', error);
        res.status(500).send('Server error');
    }
});

// send message
app.post('/room/:room_id/send', async (req, res) => {
    requireLogin(req, res);

    const roomId = req.params.room_id;
    const userId = req.session.user.user_id;
    const { messageText } = req.body;  // message text

    try {
        // get room_user_id
        const [roomUserRows] = await database.query(
            `
            SELECT room_user_id
            FROM room_user
            WHERE room_id = ? AND user_id = ?
            `,
            [roomId, userId]
        );

        if (roomUserRows.length === 0) {
            return res.status(400).send('User is not a member of this room.');
        }

        const roomUserId = roomUserRows[0].room_user_id;
        const sentDatetime = new Date();

        await database.query(
            `
            INSERT INTO message (room_user_id, sent_datetime, text)
            VALUES (?, ?, ?)
            `,
            [roomUserId, sentDatetime, messageText]
        );

        res.redirect(`/room/${roomId}`);
    } catch (error) {
        console.error('Error inserting new message:', error);
        res.status(500).send('Server error');
    }
});

// clear unread messages
app.post('/room/:room_id/clear_unread', async (req, res) => {
    requireLogin(req, res);
    const roomId = req.params.room_id;
    const userId = req.session.user.user_id;
    const getMaxMessageIdQuery = fs.readFileSync(abs_path('/queries/get_max_message_id.sql'), 'utf8');

    try {
        // get the latest message ID in the room
        const [latestResult] = await database.query(getMaxMessageIdQuery, [roomId]);
        const lastMessageId = latestResult[0].last_message_id || 0;

        // update the last_read_message_id for the user in the room
        await database.query(
            `UPDATE room_user SET last_read_message_id = ? WHERE room_id = ? AND user_id = ?`,
            [lastMessageId, roomId, userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Error clearing unread messages:", error);
        res.status(500).json({ success: false });
    }
});


//create new room page
app.get('/create_room', async (req, res) => {
    requireLogin(req, res);

    const username = req.session.user.username;
    const userId = req.session.user.user_id;

    try {

        const [userList] = await database.query(`
            SELECT user_id, username FROM user WHERE user_id != ?
            `, [userId]);

        res.render('create_room', { error: null, username, userId, userList });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Server error');
    }
});


//create new room post
app.post('/create_room', async (req, res) => {
    requireLogin(req, res);
    const { roomName, inviteUsers } = req.body;
    const userId = req.session.user.user_id;

    if (!roomName) {
        return res.redirect('create_room', { error: 'Room name is required'});
    }

    const username = req.session.user.username;

    try {
        const [existingRows] = await database.query('SELECT * FROM room WHERE name = ?', [roomName]);

        if (existingRows.length > 0) {
            const [userList] = await database.query(`
            SELECT user_id, username FROM user WHERE user_id != ?
            `, [userId]);
            return res.render('create_room', { error: 'Room name is already taken.', username, userId, userList });
        }

        // create a new room
        const [roomResult] = await database.query(
            `INSERT INTO room (name) VALUES (?)`,
            [roomName]
        );
        // get room_id of the created room
        const newRoomId = roomResult.insertId;

        // add the current user to the room
        await database.query(
            `INSERT INTO room_user (user_id, room_id, last_read_message_id) VALUES (?, ?, 0)`,
            [userId, newRoomId]
        );

        // add invited users to the room after converting inviteUsers to an array
        if (inviteUsers) {
            const inviteArray = Array.isArray(inviteUsers) ? inviteUsers : [inviteUsers];
            for (let i = 0; i < inviteArray.length; i++) {
                const invitedUserId = inviteArray[i];
                await database.query(
                    `INSERT INTO room_user (user_id, room_id, last_read_message_id) VALUES (?, ?, 0)`,
                    [invitedUserId, newRoomId]
                );
            }   
            res.redirect(`/members`);
            }    
    } catch (error) {
        console.error('Error creating new room:', error);
        res.status(500).send('Server error');
    }
});

//invite users to room
app.get('/invite_people/:room_id', async (req, res) => {
    requireLogin(req, res);
    const username = req.session.user.username;
    const userId = req.session.user.user_id;
    const roomId = req.params.room_id;

    const getInviteListQuery = fs.readFileSync(abs_path('/queries/get_invite_list.sql'), 'utf8');
    let people;

    try {
        // check if room_id exists
        const [roomName] = await database.query(
            'SELECT name AS room_name FROM room WHERE room_id = ?',
            [roomId]
        );
        if (roomName.length === 0) {
            return res.redirect('/members');
        }

        const [peopleToInvite] = await database.query(getInviteListQuery, [roomId, userId])

        res.render("invite_people", { error: null, username, peopleToInvite, userId, roomId, roomName });
    } catch (error) {
        console.error("Error fetching invite list:", error);
        res.status(500).send("Server error");
    }
});

// invite people to room post
app.post('/invite_people/:room_id', async (req, res) => {
    console.log(req.body);

    requireLogin(req, res);

    // inviteUsers: an array of user IDs selected or a single value
    // roomId: sent as a parameter in the URL
    const { inviteUsers } = req.body;
    const roomId = req.params.room_id

    try {
        if (!inviteUsers) {
            return res.redirect(`/room/${roomId}`);
        }

        const invitedUsers = Array.isArray(inviteUsers) ? inviteUsers : [inviteUsers];
        for (let i = 0; i < invitedUsers.length; i++) {
            await database.query(
                `INSERT INTO room_user (user_id, room_id, last_read_message_id) VALUES (?, ?, 0)`,
                [invitedUsers[i], roomId]
            );
        }

        res.redirect(`/room/${roomId}`);
    } catch (error) {
        console.error("Error inviting users:", error);
        res.status(500).send("Server error");
    }
});


app.get("*", (req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});



