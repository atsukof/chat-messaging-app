const database = include('databaseConnection');

async function createTables() {
    let createUserSQL = `
		CREATE TABLE IF NOT EXISTS user (
            user_id INT NOT NULL AUTO_INCREMENT,
            username VARCHAR(25) NOT NULL,
            password VARCHAR(100) NOT NULL,
            PRIMARY KEY (user_id),
            UNIQUE INDEX unique_username (username ASC) VISIBLE);
	`;

    let createEmojiSQL = `
    CREATE TABLE IF NOT EXISTS emoji (
        emoji_id int NOT NULL AUTO_INCREMENT,
        name varchar(50) NOT NULL,
        image varchar(50) NOT NULL,
        PRIMARY KEY (emoji_id)
        );

    INSERT INTO emoji (name, image)
    VALUES ('thumbs up', 'thumbsup.png'), ('100 percent', '100.png'), ('happy face', 'happy.png');
    `;

    let createRoomSQL = `
        CREATE TABLE IF NOT EXISTS room (
            room_id int NOT NULL AUTO_INCREMENT,
            name varchar(200) NOT NULL,
            start_datetime datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (room_id),
            UNIQUE KEY Unique_name (name)
            );
    `;

    let createRoomUserSQL = `
        CREATE TABLE IF NOT EXISTS room_user (
            room_user_id int NOT NULL AUTO_INCREMENT,
            user_id int NOT NULL,
            room_id int NOT NULL,
            last_read_message_id int NOT NULL,
            PRIMARY KEY (room_user_id),
            UNIQUE KEY unique_room_user (user_id,room_id),
            KEY room_user_room_idx (room_id),
            CONSTRAINT room_user_room FOREIGN KEY (room_id) REFERENCES room (room_id),
            CONSTRAINT room_user_user FOREIGN KEY (user_id) REFERENCES user (user_id)
        );
    `;


    let createMessageSQL = `
        CREATE TABLE IF NOT EXISTS message (
            message_id int NOT NULL AUTO_INCREMENT,
            room_user_id int NOT NULL,
            sent_datetime datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            text text NOT NULL,
            PRIMARY KEY (message_id),
            KEY message_room_user (room_user_id),
            CONSTRAINT message_room_user FOREIGN KEY (room_user_id) REFERENCES room_user (room_user_id)
        );
    `;

    let createMessageEmojiUserSQL = `
        CREATE TABLE IF NOT EXISTS message_emoji_user (
            message_emoji_user_id int NOT NULL AUTO_INCREMENT,
            message_id int NOT NULL,
            emoji_id int NOT NULL,
            user_id int NOT NULL,
            PRIMARY KEY (message_emoji_user_id),
            UNIQUE KEY message_id (message_id,emoji_id,user_id),
            KEY emoji_id (emoji_id),
            KEY user_id (user_id),
            CONSTRAINT message_emoji_user_ibfk_1 FOREIGN KEY (message_id) REFERENCES message (message_id),
            CONSTRAINT message_emoji_user_ibfk_2 FOREIGN KEY (emoji_id) REFERENCES emoji (emoji_id),
            CONSTRAINT message_emoji_user_ibfk_3 FOREIGN KEY (user_id) REFERENCES user (user_id)
        );
    `;

    try {
        const resultsUser = await database.query(createUserSQL);
        const resultsEmoji = await database.query(createEmojiSQL);
        const resultsRoom = await database.query(createRoomSQL);
        const resultsRoomUser = await database.query(createRoomUserSQL);
        const resultsMessage = await database.query(createMessageSQL);
        const resultsMessageEmojiUser = await database.query(createMessageEmojiUserSQL);


        console.log(resultsUser[0]);
        console.log(resultsEmoji[0]);
        console.log(resultsRoom[0]);
        console.log(resultsRoomUser[0]);
        console.log(resultsMessage[0]);
        console.log(resultsMessageEmojiUser[0]);

        console.log("Successfully tables set up");

        return true;
    }
    catch (err) {
        console.log("Error Creating tables");
        console.log(err);
        return false;
    }
}

module.exports = { createTables };