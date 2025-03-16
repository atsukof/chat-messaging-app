SELECT
	m.message_id
    , m.text
    , m.sent_datetime
    , u.username AS sender_name
    , u.user_id AS sender_id
    , r.name AS room_name
    , ru_2.last_read_message_id
    , IF(m.message_id > ru_2.last_read_message_id, 1, 0) AS unread
FROM message AS m
	INNER JOIN room_user AS ru ON m.room_user_id = ru.room_user_id
	INNER JOIN user AS u ON ru.user_id = u.user_id
    INNER JOIN room AS r ON ru.room_id = r.room_id
    LEFT JOIN room_user AS ru_2 ON ru.room_id = ru_2.room_id AND ru_2.user_id = ?
WHERE ru.room_id = ?
ORDER BY m.sent_datetime ASC
;