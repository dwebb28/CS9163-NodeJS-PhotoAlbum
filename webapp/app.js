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
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }));

//establish the database connection details
var conn = mysql.createConnection({
	host: "localhost",
	user: "sql_admin",
	password: "appsec"
});

//connect to the database
conn.connect(function(err){
	if (err) throw err;
	console.log("Connected to mysql database");
});

//have app listening on port 3000
app.listen(3000, function(){
	console.log('Example app listening on port 3000!');
})

//generic function to query the database by passing in sql string
function queryDatabase(sql, callback){
	
	conn.query(sql, function(error, results,fields){
			if(error) throw error;
			
			callback(results);
	});
}

//function used to compare the hash values of two password hashes
//used on the login page
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

//used to parse the cookie
function parseCookie(req, callback){
	console.log(req.headers.cookie);
	
	if(req.headers.cookie === undefined)
	{
		callback(undefined);
	} else{
		var cook = cookie.parse(req.headers.cookie);
		console.log(cook);
		callback(cook);
	}
}

//used to physically upload the pictures onto the server
//does some error checking
//saves the picture's path and comments into the database
app.post('/upload', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		if(!cook)
		{
			res.redirect('/login');
		}
		else{
			username = cook.username;
			
			//check to make sure files were uploaded
			if(!req.files || Object.keys(req.files) == 0)
			{
				return res.status(400).send('No files were uploaded');
			}
			else{
				let fileToUpload = req.files.picture;
				var picName = fileToUpload.name;
				
				//make sure that the file being uploaded is actuallly a valid file type supported
				if( !(picName.toLowerCase().endsWith('.jpg')) && !(picName.toLowerCase().endsWith('.png')) && !(picName.toLowerCase().endsWith('.gif') ))
				{
					res.status(400).send('Invalid file type');
				}
				else{
					var filepath = 'images/' + picName;
				
					var comment = req.body.comment;
					
					//save the picture to the server
					fileToUpload.mv( 'public/' + filepath, function(err){
						if(err){
							return res.status(500).send(err);
						}
						else
						{
							var sql = 'INSERT INTO photoapp.photos(username,file_path,comment,insert_date_time,update_date_time) values('
									+ conn.escape(username) + ',' + conn.escape(filepath) + ',' + conn.escape(comment) + ',' + conn.escape(new Date()) + ',' + conn.escape(new Date()) + ')';
						
							console.log(sql);
							
							//save the picture information to the database for future retrieval
							queryDatabase(sql, function(insert_results){
											if(insert_results){
												res.redirect('/home');
											}
										});
						}
					});
					
					
				}
				
			}
		}
	});
});

//get the upload page
app.get('/upload', function(req, res){
	//parse cookie
	parseCookie(req, function(cook){
		if(!cook)
			//if cookie not valid
			res.redirect('/login');
		else
			res.sendFile(path.join(__dirname, '/web/' , 'upload.html'));
	});
	
});

//get the home page for that user logged in
app.get('/home', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			//if cookie is invalid
			res.redirect('/login');
		}
		else{
			username = cook.username;
			var start = parseInt(req.params.start, 10);
			var limit = 200;
			var pictures = [];
			console.log('Getting pictures');
			
			//get all pictures for this user
			getPicturesByUserName( username ,function(results){
				var lastId = start;
				
				//for all of the results of the query, create objects
				//with the filepath and the comment, that will be used
				//in the ejs file to insert them as images into the page
				for(var i = 0 ; i < results.length ; i++){
					var picture = results[i];
					
					if(picture.comment === null)
						picture.comment = '';
					
					pictures.push({
						file_path : '/' + picture.file_path,
						comment: picture.comment
					})
				}
				
				//render the page and insert the list of pictures
				res.render('pages/home',{
				pictures: pictures
			});
		
			});
		}
	});	
});

//Once logged in a user can create edit their own pictures
app.get('/home/editPictures', function(req, res){
	
	var username;
	parseCookie(req, function(cook){
		
		if(!cook){
			res.redirect('/login');
		} else
		{
			//get the username from the cookie
			username = cook.username;
			var start = parseInt(req.params.start, 10);
			var limit = 200;
			var pictures = [];
			console.log('Getting pictures');
			
			//for all of the results of the query, create objects
			//with the filepath and the comment, that will be used
			//in the ejs file to insert them as images into the page
			getPicturesByUserName( username ,function(results){
				var lastId = start;
				for(var i = 0 ; i < results.length ; i++){
					var picture = results[i];
					
					if(picture.comment === null)
						picture.comment = '';
					
					//create objects with the file path to be rendered
					//provide the comment to be put into an editable textbox for updates
					//provide the id, for deletion to call the delete function
					pictures.push({
						file_path : '/' + picture.file_path,
						comment: picture.comment,
						id: picture.id
					})
				}
				console.log(pictures);
				res.render('pages/edit',{
				pictures: pictures
			});				
			});
		}
		
		
	});
	
	
});

//no authentication needed, provide the login page
app.get('/login', function(req,res){
	res.sendFile(path.join(__dirname, '/web', 'login.html'));
});

//log the user out- clear their cookie, and redirect back to the login page
app.get('/logout', function(req,res){
	res.clearCookie('username');
	res.redirect('/login');
});

//log the user in
app.post('/login', function(req,res){
	console.log(req.body);
	
		var username = req.body.uname;
		var password = req.body.psw;
		var sql = 'SELECT password_hash FROM photoapp.users WHERE username = ' + conn.escape(username);
		console.log(sql);

		queryDatabase(sql, function(results){
			
			if(results.length > 0){
				console.log('User exists...checking hash');
				var hash = results[0].password_hash;
				
				//pass the hash from the database into this function
				//to compare against the generated hash from the plaintext password
				compareHash(password, hash, function(success){
					
					//if the password hashes match, set the cookie
					//redirect to the home page
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
				
			//if the logins do not match, redirect back to login page
			} else{
				res.redirect('/login');
			}
		});
	
});

//provide the registration page
app.get('/register', function(req,res){
	res.sendFile(path.join(__dirname, '/web/' , 'register.html'));
});

//registration function, creates the password hash, saves to the db and then sets the cookie
//on the users browser
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
					//if successfully saved, set the user's cookie on their browser
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

//delete picture by the picture id
function deletePicture( pictureId, username, callback){
	var sql = 'DELETE FROM photoapp.photos WHERE id = ' + conn.escape(pictureId) + ' and username = ' + conn.escape(username);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

//edit the comment of the picture
function editPicture( pictureId, comment, username, callback){
	var sql = 'UPDATE photoapp.photos SET comment = ' + conn.escape(comment) + ', update_date_time = ' + conn.escape(new Date()) + ' WHERE username = ' + conn.escape(username) + ' AND id = ' + conn.escape(pictureId);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

//get pictures starting at an index, and for a certain amount
//used to only return the first 10, second 10, etc. pictures from the database
function getPictures( start , limit, callback ){
	var sql = 'SELECT * FROM photoapp.photos ORDER BY update_date_time DESC LIMIT ' + conn.escape(start) + ' , ' + conn.escape(limit);
	console.log('sql: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

//Get all pictures by the username, used in the home and edit picture pages
function getPicturesByUserName( username, callback ){
	var sql = 'SELECT * FROM photoapp.photos WHERE username = ' + conn.escape(username) + ' ORDER BY update_date_time DESC';
	console.log('Get Pictures By username: ' + sql);
	queryDatabase(sql, function(results){
		console.log(results);
		callback(results);
	});
}

//default redirect to start at the top of the pictures page
app.get('/pictures', function(req, res){
	res.redirect('/pictures/0');
});

//gets all pictures in chronological order starting from position
//:start in the list
app.get('/pictures/:start', function(req, res){
	var start = parseInt(req.params.start, 10);
	//only want to return 10 at a time at most
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
		//do the logic to determine which picture is the last one
		//helps to create the hyperlink for the next and back pages
		var lastPic = (start + pictures.length);
		var previous = 0;
		if(start >= 10){
			previous = start - 10;
		}
		//render the page and use the insert variables to setup the page
		res.render('pages/pictures',{
		pictures: pictures,
		lastPicture : lastPic,
		previousPageStart : previous
		
	});
		
	});

	
});

//delete picture by id
app.get('/deletePicture/:pictureId', function(req, res){
	
	var pictureId = parseInt(req.params.pictureId);
	var username;
	parseCookie(req, function(cook){
		//authenticate user
		if(!cook){
			res.redirect('/login');
		}
		else{
			username = cook.username;
			deletePicture( pictureId, username ,function(results){
				if(results){
					res.redirect('/home');
				}
			});
		}
	});
});

//edit picture by the picture id
app.post('/editPicture/:pictureId', function(req, res){
	
	var pictureId = parseInt(req.params.pictureId);
	var comment = req.body.comment;
	var username;
	parseCookie(req, function(cook){
		
		//authenticate user
		if(!cook){
			res.redirect('/login');
		}		
		else
		{
			username = cook.username
			editPicture( pictureId, comment , username ,function(results){
			if(results){
				res.redirect('/home');
			}
	});
		}
	});
});

//default redirect
app.get('/*', function(req, res) {
    res.redirect('/home')
});

//default redirect
app.post('/*', function(req, res) {
    res.redirect('/home')
});