INSERT OR IGNORE INTO channels (id, name, type, topic, position, created_by)
VALUES 
    ('1', 'general', 'text', 'Welcome to #general! Chat with the community.', 0, 'system'),
    ('2', 'random', 'text', 'Memes, jokes, and random thoughts.', 1, 'system'),
    ('3', 'announcements', 'text', 'Important updates and news.', 2, 'system'),
    ('4', 'General Voice', 'voice', 'Crystal clear voice chat with screen share.', 3, 'system')
;
