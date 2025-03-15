
WITH user_data AS (
SELECT
    u.user_id
    , u.username
    , ru.room_user_id
    , ru.room_id
    , last_read_message_id
    , r.name AS room_name
FROM user u
    JOIN room_user ru ON u.user_id = ru.user_id
    LEFT JOIN room r ON ru.room_id = r.room_id
    LEFT JOIN message m ON ru.room_user_id = m.room_user_id
WHERE u.username = ?
)

, unread_count AS (
SELECT
    ru.room_id
    , SUM(IF(m.message_id > ud.last_read_message_id, 1, 0)) AS unread_count
    , MAX(m.sent_datetime) AS latest_message_datetime
FROM message m
    LEFT JOIN room_user ru ON m.room_user_id = ru.room_user_id
    INNER JOIN user_data ud ON ud.room_id = ru.room_id
GROUP BY ru.room_id
)

SELECT
    ud.user_id
    , ud.username
    , ud.room_id
    , ud.room_name
    , uc.unread_count
    , uc.latest_message_datetime
FROM user_data ud
    LEFT JOIN unread_count uc ON ud.room_id = uc.room_id
    ;