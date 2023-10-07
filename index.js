const express = require('express');
const exphbs = require('express-handlebars');
const db = require('./db');
const cookieparser = require('cookie-parser');
const expsession = require('express-session');
const bcrypt = require('bcrypt');
const Handlebars = require('handlebars');

Handlebars.registerHelper('eq', function (a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

const app = express();
const PORT = 3000;
const hbs = exphbs.create({
  defaultLayout: 'main',
  extname: 'hbs'
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const secret = 'qwerty';
app.use(cookieparser(secret));
app.use(expsession({
  secret: secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 120000
  }
}));

function requireUser(req, res, next) {
  if (req.session.user) {
    next();
  }
  else {
    res.render('error', { title: 'Error 404', text: 'To access this page, you must log in.' });
  }
}

app.get('/', function (req, res) {
  const sqlSelArt = 'SELECT articles.*, users.username FROM articles JOIN users ON articles.user_id = users.id';
  db.query(sqlSelArt, function (error, articles) {
    if (error) throw error;
    if (articles) {
      res.render('index', { title: 'Home', articles, user: req.session.user });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Articles not found' });
    }
  });
});

app.get('/articles/:id', function (req, res) {
  const id = req.params.id;
  const sqlFindArt = 'SELECT articles.*, users.username FROM articles JOIN users ON articles.user_id = users.id WHERE articles.id=?';
  db.query(sqlFindArt, [id], function (error, articles) {
    if (error) throw error;
    const article = articles[0];
    if (article) {
      const sqlFindCom = 'SELECT * FROM comments WHERE articleId=?';
      db.query(sqlFindCom, [id], function (error, comments) {
        if (error) throw error;
        if (comments) {
          res.render('article', { title: `Article ${article.title}`, article, comments });
        }
        else {
          res.render('article', { title: `Article ${article.title}`, article, notComment: 'There are no comments yet' });
        }
      });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Article not found' });
    }
  });
});

app.get('/admin', requireUser, function (req, res) {
  const sqlSelArt = 'SELECT articles.*, users.username FROM articles JOIN users ON articles.user_id=users.id';
  db.query(sqlSelArt, function (error, articles) {
    if (error) throw error;
    if (articles) {
      res.render('admin', { title: 'Admin panel', articles, add: req.session.add, edit: req.session.edit, delete: req.session.delete, user: req.session.user });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Articles not found' });
    }
  });
});

app.get('/add', function (req, res) {
  const sqlSelUser = 'SELECT * FROM users';
  db.query(sqlSelUser, function (error, users) {
    if (error) throw error;
    if (users) {
      res.render('add', { title: 'Add article', users });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Users not found' });
    }
  });
});

app.post('/add', function (req, res) {
  const title = req.body.title;
  const subcontent = req.body.subcontent;
  const content = req.body.content;
  const author = req.body.user_id;
  const sqlAddArt = 'INSERT INTO articles (title, subcontent, content, user_id) VALUES(?, ?, ?, ?)';
  db.query(sqlAddArt, [title, subcontent, content, author], function (error, result) {
    if (error) throw error;
    req.session.add = `Article ${title} added success!`;
    res.redirect('/admin');
  });
});

app.get('/edit/:id', function (req, res) {
  const id = req.params.id;
  const sqlEditArt = 'SELECT articles.*, users.username FROM articles JOIN users ON articles.user_id = users.id WHERE articles.id=?';
  db.query(sqlEditArt, [id], function (error, articles) {
    if (error) throw error;
    const article = articles[0];
    if (article) {
      const sqlSelUser = 'SELECT * FROM users';
      db.query(sqlSelUser, function (error, users) {
        if (error) throw error;
        if (users) {
          const user = users.find(user => user.id === article.user_id);
          if (user) {
            res.render('edit', { title: `Edit ${article.title}`, articles, article, users, user, });
          }
          else {
            res.render('error', { title: 'Error 404', text: 'User not found' });
          }
        }
        else {
          res.render('error', { title: 'Error 404', text: 'Users not found' });
        }
      });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Article not found' });
    }
  });
});

app.post('/edit/:id', function (req, res) {
  const id = req.params.id;
  const title = req.body.title;
  const subcontent = req.body.subcontent;
  const content = req.body.content;
  const author = req.body.user_id;
  const sqlAddArt = 'UPDATE articles SET title=?, subcontent=?, content=?, user_id=?  WHERE id=?';
  db.query(sqlAddArt, [title, subcontent, content, author, id], function (error, result) {
    if (error) throw error;
    req.session.add = `Article ${title} edit success!`;
    res.redirect('/admin');
  });
});

app.get('/delete/:id', function (req, res) {
  const id = req.params.id;
  const sqlFindArt = 'SELECT * FROM articles WHERE id=?';
  db.query(sqlFindArt, [id], function (error, articles) {
    if (error) throw error;
    const article = articles[0];
    if (article) {
      const sqlDelArt = 'DELETE FROM articles WHERE id=?';
      db.query(sqlDelArt, [id], function (error, result) {
        if (error) throw error;
        req.session.delete = `Article ${article.title} delete success!`;
        res.redirect('/admin');
      });
    }
    else {
      res.render('error', { title: 'Error 404', text: 'Article not found' });
    }
  });
});

app.get('/register', function (req, res) {
  res.render('register', { title: 'Register page' });
});

app.post('/register', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  if (username && password) {
    const sqlFindUser = 'SELECT * FROM users WHERE username=?';
    db.query(sqlFindUser, [username], function (error, users) {
      if (error) throw error;
      if (users.length > 0) {
        res.render('error', { title: 'Error registration', text: 'User with this name already exists' });
      }
      else {
        bcrypt.genSalt(10, function (error, salt) {
          if (error) throw error;
          bcrypt.hash(password, salt, function (error, hash) {
            if (error) throw error;
            const sqlAddUser = 'INSERT INTO users (username, password) VALUES(?,?)';
            db.query(sqlAddUser, [username, hash], function (error, result) {
              if (error) throw error;
              req.session.add = `User ${username} added success!`;
              res.redirect('/');
            });
          });
        });
      }
    });
  }
  else {
    res.render('error', { title: 'Error 404', text: 'Enter username and paswword' });
  }
});

app.get('/login', function (req, res) {
  res.render('login', { title: 'Login page' });
});

app.post('/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  if (username && password) {
    const sqlFindUser = 'SELECT * FROM users WHERE username=?';
    db.query(sqlFindUser, [username], function (error, users) {
      if (error) throw error;
      const user = users[0];
      if (user) {
        bcrypt.compare(password, user.password, function (error, result) {
          if (error) throw error;
          if (result) {
            req.session.user = username;
            res.redirect('/');
          }
          else {
            res.render('error', { title: 'Error 404', text: 'Incorrect password' });
          }
        });
      }
      else {
        res.render('error', { title: 'Error 404', text: 'User not found' });
      }
    });
  }
  else {
    res.render('error', { title: 'Error 404', text: 'Enter username and paswword' });
  }
});

app.get('/logout', function (req, res) {
  req.session.destroy(function (error) {
    if (error) throw error;
    res.redirect('/');
  });
});

app.post('/comments', function (req, res) {
  const id = req.body.id;
  const author = req.body.author;
  const commentText = req.body.commentText;
  const sqlAddCom = 'INSERT INTO comments (articleId, commentText, author) VALUES(?, ?, ?)';
  db.query(sqlAddCom, [id, commentText, author], function (error, result) {
    if (error) throw error;
    req.session.add = `Comment added success!`;
    res.redirect(`/articles/${id}`);
  });
});

app.use(function (req, res) {
  res.status(404).render('error', { title: 'Error 404', text: 'Page not found' });
});

app.listen(PORT, function () {
  console.log('server is running on port', PORT);
});