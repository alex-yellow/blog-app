const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'blog'
});

db.connect(function (error) {
    if (error) {
        console.error('Error connection database: ' + error.stack);
        return;
    }
    console.log('Database connection success!');
});

module.exports = db;