//https://www.npmjs.com/package/express-fileupload

const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const bodyParser = require('body-parser');
var path = require('path');
var bcrypt = require('bcrypt');
const saltRounds = 10;
var fs = require('fs');
var mysql = require('mysql');
var cookie = require('cookie');
console.log(__dirname);
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

var conn = mysql.createConnection({
	host: "localhost",
	user: "sql_admin",
	password: "appsec"
});

conn.connect(function(err){
	if (err) throw err;
	console.log("Connected to mysql database");
});

app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(3000, function(){
	console.log('Example app listening on port 3000!');
})

function queryDatabase(sql, callback){
	
	conn.query(sql, function(error, results,fields){
			if(error) throw error;
			
			callback(results);
	});
}

function compareHash(password, hash, callback){
	
	bcrypt.compare(password, hash, function(err, res, redirect_user) {
					if(res == true){
						console.log(res);
						callback(true);
					}
					else{
						console.log('incorrect password');
						callback(false);
					}
				});
}

function parseCookie(req, callback){
	console.log(req.headers.cookie);
	
	if(req.headers.cookie === undefined)
	{
		callback(undefined);
	}
	
	var cook = cookie.parse(req.headers.cookie);
	console.log(cook);
	callback(cook);
}

app.post('/upload', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		if(!cook)
			res.redirect('/login');
		
		username = cook.username;
	});

	if(!req.files)
		return res.status(400).send('No files were uploaded');
	
	let fileToUpload = req.files.picture;
	var picName = fileToUpload.name;
	var filepath = 'images/' + picName;
	
	var comment = req.body.comment;
	
	fileToUpload.mv( 'public/' + filepath, function(err){
		if(err)
			return res.status(500).send(err);
	});
	
	var sql = 'INSERT INTO photoapp.photos(username,file_path,comment,insert_date_time,update_date_time) values('
		+ conn.escape(username) + ',' + conn.escape(filepath) + ',' + conn.escape(comment) + ',' + conn.escape(new Date()) + ',' + conn.escape(new Date()) + ')';
		
	console.log(sql);
	
	queryDatabase(sql, function(insert_results){
					if(insert_results){
						res.redirect(req.headers.origin + '/home');
					}
				});
	
});

app.get('/upload', function(req, res){
	res.sendFile(path.join(__dirname, '/web/' , 'upload.html'));
});

app.get('/home', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		}
		
		username = cook.username;
	});
	
	var start = parseInt(req.params.start, 10);
	var limit = 200;
	var pictures = [];
	console.log('Getting pictures');
	getPicturesByUserName( username ,function(results){
		var lastId = start;
		for(var i = 0 ; i < results.length ; i++){
			var picture = results[i];
			
			if(picture.comment === null)
				picture.comment = '';
			
			pictures.push({
				file_path : '/' + picture.file_path,
				comment: picture.comment
			})
			lastId = picture.id;
		}
		console.log(pictures);
		res.render('pages/home',{
		pictures: pictures
	});
		
	});
});

app.get('/home/editPictures', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		}
		
		username = cook.username;
	});
	
	var start = parseInt(req.params.start, 10);
	var limit = 200;
	var pictures = [];
	console.log('Getting pictures');
	getPicturesByUserName( username ,function(results){
		var lastId = start;
		for(var i = 0 ; i < results.length ; i++){
			var picture = results[i];
			
			if(picture.comment === null)
				picture.comment = '';
			
			pictures.push({
				file_path : '/' + picture.file_path,
				comment: picture.comment,
				id: picture.id
			})
			lastId = picture.id;
		}
		console.log(pictures);
		res.render('pages/edit',{
		pictures: pictures
	});
		
	});
});

app.get('/home/editPictures', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		}
		
		username = cook.username;
	});
	
	var start = parseInt(req.params.start, 10);
	var limit = 200;
	var pictures = [];
	console.log('Getting pictures');
	getPicturesByUserName( username ,function(results){
		var lastId = start;
		for(var i = 0 ; i < results.length ; i++){
			var picture = results[i];
			
			if(picture.comment === null)
				picture.comment = '';
			
			pictures.push({
				file_path : '/' + picture.file_path,
				comment: picture.comment
			})
			lastId = picture.id;
		}
		console.log(pictures);
		res.render('pages/home',{
		pictures: pictures
	});
		
	});
});

app.get('/login', function(req,res){
	res.sendFile(path.join(__dirname, '/web', 'login.html'));
});

app.get('/logout', function(req,res){
	res.clearCookie('username');
	res.redirect('/login');
});

app.post('/login', function(req,res){
	console.log(req.body);
	
		var username = req.body.uname;
		var password = req.body.psw;
		var sql = 'SELECT password_hash FROM photoapp.users WHERE username = ' + conn.escape(username);
		console.log(sql);
		var auth_success = false;
		

		queryDatabase(sql, function(results){
			
			if(results.length > 0){
				console.log('User exists...checking hash');
				var hash = results[0].password_hash;
				
				compareHash(password, hash, function(success){
					
					if(success){
						res.setHeader('Set-Cookie', cookie.serialize('username', username, {
							httpOnly: true,
							maxAge: 60 * 60 * 24 * 7 // 1 week 
						}));
						res.statusCode = 301;
						res.redirect(req.headers.origin + '/home');
					}	
					else{
						res.send('Authentication error.');
					}
				});
				
				
			} else{
				res.redirect('/login');
			}
		});
	
});

app.get('/register', function(req,res){
	res.sendFile(path.join(__dirname, '/web/' , 'register.html'));
});

app.post('/register',function(req,res){
	
	var username = req.body.uname;
	var sql = 'SELECT * FROM photoapp.users WHERE username = ' + conn.escape(username);
	console.log(sql);
	
	queryDatabase(sql, function(results){
		
		if(results.length > 0){
			res.send('Registration error.');
		}
		else{
			console.log('user doesn\'t exist');
			bcrypt.hash(req.body.psw, saltRounds, function(err, hash) {
				if(err) throw err;
				
				var insert = 'INSERT INTO photoapp.users(username,password_hash) values(' 
					+ conn.escape(username) + ',' + conn.escape(hash) + ')';
				console.log(insert);
				
				queryDatabase(insert, function(insert_results){
					if(insert_results){
						res.setHeader('Set-Cookie', cookie.serialize('username', username, {
							user: username,
							httpOnly: true,
							maxAge: 60 * 60 * 24 * 7 // 1 week 
						}));
						res.statusCode = 301;
						res.redirect(req.headers.origin + '/home');
					}
				});
				
			});
		}
	});
});


function deletePicture( pictureId, username, callback){
	var sql = 'DELETE FROM photoapp.photos WHERE id = ' + conn.escape(pictureId) + ' and username = ' + conn.escape(username);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

function editPicture( pictureId, comment, username, callback){
	var sql = 'UPDATE photoapp.photos SET comment = ' + conn.escape(comment) + ' WHERE username = ' + conn.escape(username) + ' AND id = ' + conn.escape(pictureId);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

function getPictures( start , limit, callback ){
	var sql = 'SELECT * FROM photoapp.photos ORDER BY update_date_time DESC LIMIT ' + conn.escape(start) + ' , ' + conn.escape(limit);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

function getPicturesByUserName( username, callback ){
	var sql = 'SELECT * FROM photoapp.photos WHERE username = ' + conn.escape(username);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

app.get('/pictures', function(req, res){
	res.redirect('/pictures/0');
});

app.get('/pictures/:start', function(req, res){
	var start = parseInt(req.params.start, 10);
	var limit = 10;
	var pictures = [];
	console.log('Getting pictures');
	getPictures( start, limit ,function(results){
		for(var i = 0 ; i < results.length ; i++){
			var picture = results[i];
			
			if(picture.comment === null)
				picture.comment = '';
			
			pictures.push({
				file_path : '/' + picture.file_path,
				comment: picture.comment
			})
		}
		console.log(pictures);
		var lastPic = (start + pictures.length);
		var previous = 0;
		if(start >= 10){
			previous = start - 10;
		}
		
		res.render('pages/pictures',{
		pictures: pictures,
		lastPicture : lastPic,
		previousPageStart : previous
		
	});
		
	});

	
});

app.get('/deletePicture/:pictureId', function(req, res){
	
	var pictureId = parseInt(req.params.pictureId);
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		}		
		username = cook.username;
	});

	deletePicture( pictureId, username ,function(results){
		if(results){
			res.redirect('/home');
		}
	});
});

app.post('/editPicture/:pictureId', function(req, res){
	
	var pictureId = parseInt(req.params.pictureId);
	var comment = req.body.comment;
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		}		
		username = cook.username;
	});

	editPicture( pictureId, comment , username ,function(results){
		if(results){
			res.redirect('/home');
		}
	});
});