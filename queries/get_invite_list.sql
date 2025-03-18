SELECT
    u.user_id
    , u.username
    , ru.room_user_id
FROM user u
    LEFT JOIN room_user ru
		ON u.user_id = ru.user_id AND ru.room_id = ?
WHERE
	u.user_id != ? AND ru.room_user_id IS NULL
;