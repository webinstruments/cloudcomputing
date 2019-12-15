DROP TABLE IF EXISTS snippets;
DROP TABLE IF EXISTS tags;

CREATE TABLE snippets (
  id SERIAL PRIMARY KEY,
  name varchar(255) DEFAULT NULL,
  description varchar(255) DEFAULT NULL,
  author varchar(255) DEFAULT NULL,
  language varchar(255) DEFAULT NULL,
  code varchar(255) DEFAULT NULL
);

create TABLE tags (
  id SERIAL PRIMARY KEY,
  tag varchar(255) DEFAULT NULL,
  snippet_id integer references snippets(id) ON DELETE CASCADE
);