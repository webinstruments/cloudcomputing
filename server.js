"use strict";

// Get default settings from environment variables
const SSL = process.env.SSL || "false";
const SERVER_PORT = process.env.EXAMPLE_SERVICE_PORT || process.env.PORT || 8080; // PORT environement variable provided by Heroku
const SERVER_PREFIX = process.env.EXAMPLE_SERVICE_PREFIX || "/api";
const DB_URL = process.env.EXAMPLE_DB_URL || process.env.DATABASE_URL || "postgres://cloudcomputing:cloudcomputing@127.0.0.1:5432/cloudcomputing";

console.log('SSL', SSL, 'SERVERPORT', SERVER_PORT, 'SERVERPREFIX', SERVER_PREFIX, 'DBURL', DB_URL);

/** Postgres database access functions objects */
class PSQL_DB {

    /** Create a database connection
     * @constructs PSQL_DB, a PostgreSQL database connection
     * @param {string} url - complete database connection url
    */
    constructor(url) {
        const { Client } = require('pg');
    	console.log(`Using Database URL: ${url}`);
    	var use_ssl = (SSL == "true" || SSL == 1 ? true : false);
        this.connection = new Client({ 
            connectionString: url, 
            ssl: use_ssl 
        });

        // connect to the database
        this.connect();

        // if connection to DB has been closed unexpected
        this.connection.on('end', (error) => {
            console.log('Connection closed ', error);
            // try to re-connect
            this.connect();
        });
    }

    /** Connect to the database */
    connect() {
        console.log(`Connecting to database  ...`);
        this.connection.connect((error) => {
            if (error) {
                console.log(`Connection to database FAILED!`);
		console.log(error);
                process.exit(1);
            }
            else {
                console.log(`Connection to database established!`);
            }
        });
    }

    getSnippet(id, name, description, author, language, code, tag) {
        let counter = 1;
        let where = 'WHERE';
        let args = [];
        if (id) {
            where += ` AND snippets.id=$${counter++}`;
            args.push(id);
        }
        if (name) {
            where += ` AND name=$${counter++}`;
            args.push(name);
        }
        if (description) {
            where += ` AND description=$${counter++}`;
            args.push(description);
        }
        if (author) {
            where += ` AND author=$${counter++}`;
            args.push(author);
        }
        if (language) {
            where += ` AND language=$${counter++}`;
            args.push(language);
        }
        if (code) {
            where += ` AND code=$${counter++}`;
            args.push(code);
        }
        if (tag) {
            where += ` AND tags.tag=$${counter++}`;
            args.push(tag);
        }
        if (!args.length) {
            where = '';
        }
        where = where.replace('AND', ''); // remove first and
        //tags 2 is needed if snippets are filtered by tag, the tags will be filtered which leads to wrong output
        return this.connection.query(`SELECT distinct snippets.id, name, description, author, language, code, 
                                    (select string_agg(tag, ',') from tags where tags.snippet_id = snippets.id) as tags
                                    FROM snippets 
                                    left join tags on tags.snippet_id = snippets.id ${where}
                                    group by snippets.id, name, description, author, language, code
                                    order by snippets.id`, args);
    }

    updateSnippet(id, name, description, author, language, code) {
        let counter = 1;
        let set = 'SET';
        let args = [];
        if (name) {
            set += ` name=$${counter++},`;
            args.push(name);
        }
        if (description) {
            set += ` description=$${counter++},`;
            args.push(description);
        }
        if (author) {
            set += ` author=$${counter++},`;
            args.push(author);
        }
        if (language) {
            set += ` language=$${counter++},`;
            args.push(language);
        }
        if (code) {
            set += ` code=$${counter++},`;
            args.push(code);
        }
        if (!args.length || !id)
            return null;
        args.push(id);
        set = set.substr(0, set.length - 1);
        return this.connection.query(`UPDATE snippets ${set} where id=$${counter}`, args);
    }

    deleteTags(snippetId) {
        return this.connection.query('DELETE FROM tags where snippet_id = $1 RETURNING *', [snippetId])
    }

    deleteSnippet(snippetId) {
        return this.connection.query('DELETE FROM snippets where id = $1 RETURNING *', [snippetId])
    }

    createSnippet(name, description, author, language, code) {
        return this.connection.query('INSERT INTO snippets (name, description, author, language, code) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, author, language, code]);
    }

    createTag(snippetId, tag) {
        return this.connection.query('INSERT INTO tags (snippet_id, tag) VALUES ($1, $2) RETURNING *',
            [snippetId, tag]);
    }
}

/** Class implementing the ReST API */
class CloudComputingAPI {

    parseResult(snippet) {
        return {
            ...snippet,
            tags: snippet.tags && snippet.tags.split(',') || []
        };
    }

    async getSnippets(req, res) {
        try {
            const snippets = await db.getSnippet(
                req.query.id, req.query.name, req.query.description, req.query.author, req.query.language, req.query.code, req.query.tag
            );

            const result = snippets.rows.map(snippet => this.parseResult(snippet));

            return res.json(result);
        } catch (error) {
            console.log(JSON.stringify(error));
            return res.status(500).json({ "error": "database access error" });
        }
    }

    async getSnippet(req, res) {
        try {
            const snippet = await db.getSnippet(req.params.id);
            if (!snippet.rows[0])
                return res.json({ "error": "snippet id not found" });

            return res.json(this.parseResult(snippet.rows[0]));
        } catch (error) {
            console.log(JSON.stringify(error));
            return res.status(500).json({ "error": "database access error" });
        }
    }

    async createSnippet(req, res) {
        try {
            const snippet = await db.createSnippet(
                req.body.name, req.body.description, req.body.author, req.body.language, req.body.code
            );

            const tags = req.body.tags && Array.isArray(req.body.tags) && req.body.tags.map(tag => {
               return db.createTag(snippet.rows[0].id, tag);
            });
            const awaitedTags = (await Promise.all(tags)).map(t => t.rows[0].tag);

            return res.json({
                ...snippet.rows[0],
                tags: awaitedTags
            });

        } catch (err) {
            return res.status(500).json({ error: 'something went wrong' })
        }
    }

    async updateSnippet(req, res) {
        try {
            if (!req.params.id) {
                return res.status(500).json({ error: 'snippet id is missing' });
            }
            const snippet = await db.updateSnippet(
                req.params.id, req.body.name, req.body.description, req.body.author, req.body.language, req.body.code
            );

            if (req.body.tags && Array.isArray(req.body.tags)) {
                await db.deleteTags(req.params.id);
                const tags = req.body.tags.map(tag => db.createTag(req.params.id, tag));
                await Promise.all(tags);
            }

            const updatedSnippet = await db.getSnippet(req.params.id);

            return res.json(this.parseResult(updatedSnippet.rows[0]));

        } catch (err) {
            return res.status(500).json({ error: 'something went wrong' })
        }
    }

    async deleteSnippet(req, res) {
        try {
            const deletedSnippet = await db.deleteSnippet(req.params.id);
            if (deletedSnippet.rowCount)
                return res.json({ successful: true });
            return res.status(404).json({ error: 'snippet id not found' });
        } catch (err) {
            return res.status(500).json({ error: 'something went wrong' })
        }
    }

    /** Create an ReST API
     * @param {number} port - port number to listen
     * @param {string} prefix - resource path prefix
     * @param {Object} db - database connection
    */
    constructor(port, prefix, db) {
        this.port = port;
        this.prefix = prefix;
        this.db = db;

        // Add Express for routing
        const express = require('express');
        const bodyParser = require('body-parser');

        // Define express app
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());

        // Select snippets by params
        this.app.get(this.prefix + '/snippets/', this.getSnippets.bind(this));
        // Select snippet by id
        this.app.get(this.prefix + '/snippets/:id', this.getSnippet.bind(this));
        // Create snippet with json
        this.app.post(this.prefix + '/snippets', this.createSnippet.bind(this));
        // Update snippet with json
        this.app.put(this.prefix + '/snippets/:id', this.updateSnippet.bind(this));
        // Delete snippet
        this.app.delete(this.prefix + '/snippets/:id', this.deleteSnippet.bind(this));

        // Listen on given port for requests
        this.server = this.app.listen(this.port, () => {
            const host = this.server.address().address;
            const port = this.server.address().port;
            console.log("API listening at http://%s:%s%s", host, port, this.prefix);
        });

    }
}

// create database connection
const db = new PSQL_DB(DB_URL);

// create ReST Example API
const api = new CloudComputingAPI(SERVER_PORT, SERVER_PREFIX, db);
