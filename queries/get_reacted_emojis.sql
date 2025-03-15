SELECT
	meu.message_emoji_user_id
    , meu.message_id
    , meu.emoji_id
    , meu.user_id AS reacter_id
    , ru.user_id AS sender_id
	, ru.room_id
    , e.name AS emoji_name
    , e.image AS emoji_image
FROM message_emoji_user meu
	INNER JOIN message m ON meu.message_id = m.message_id
    INNER JOIN room_user ru ON m.room_user_id = ru.room_user_id
    LEFT JOIN emoji e ON meu.emoji_id = e.emoji_id
WHERE ru.room_id = ?
;