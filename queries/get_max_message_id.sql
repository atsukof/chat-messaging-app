SELECT MAX(message_id) AS last_message_id
FROM room_user ru
	INNER JOIN message m ON ru.room_user_id = m.room_user_id
WHERE ru.room_id = ?;