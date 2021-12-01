require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const {GoogleSpreadsheet} = require("google-spreadsheet");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const MemoryStore = require('memorystore')(session);
const {google} = require('googleapis');

const app = express();
const url = 'mongodb://localhost:27017/authDB'
const clientid = process.env.CLIENTID;
const clientsecret = process.env.CLIENTSECRET;
const refreshtoken = process.env.REFRESHTOKEN;
const redirecturi = process.env.REDIRECTURI;

app.listen(3000);
app.use(express.static(__dirname));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

//stablishing a session
app.use(session({
   cookie: { maxAge: 86400000 },
   store: new MemoryStore({
       checkPeriod: 86400000 // prune expired entries every 24h
   }),
   secret: 'secret must be kept secret',
   resave: false,
   saveUninitialized: true,
}));

//Initializing zoom api
var Zoom = require("zoomus")({
   key: process.env.KEY,
   secret: process.env.SECRET
});

app.use(passport.initialize());
app.use(passport.session());

//Initializing drive and spreadsheet api's
const oauth2Client = new google.auth.OAuth2(
   clientid,
   clientsecret,
   redirecturi
 )
 
 oauth2Client.setCredentials({refresh_token:refreshtoken});
 
 const drive = google.drive({
   version:'v3',
   auth:oauth2Client
 });
 
 const sheet = google.sheets({
   version:'v4',
   auth:oauth2Client
 });
 
// connect to mondb 
mongoose.connect(url,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
},err=>{
   if(err) console.log(err);
   console.log("Mongo Connected succesfully");
})

// defines what will be in the collections that uses ****userSchema**** in this case
let userSchema = new mongoose.Schema({
   username:String,
   password:String
})
//meeting details will be stored using this schema
let meetingSchema = new mongoose.Schema({
    meetingid:String,
    meetinghostname:String,
    spreadsheetid:String,
    meetingduration:String
});

//user details will be stored using this schema
let userinmeetingSchema = new mongoose.Schema({
   starttime:Number,
   name:String,
   email:String,
   duration:Number,
   status:String
})

userSchema.plugin(passportLocalMongoose);

//create a collection of ****userShema**** type named user 
//In database it will be stored as users 
const User = new mongoose.model("Users",userSchema); 
const Meeting = new mongoose.model("Meetings",meetingSchema);
const UserInMeeting = new mongoose.model("userinmeeting",userinmeetingSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get("/",(req,res)=>{
   res.sendFile(__dirname + "/index.html");    
})

app.get('/register',(req,res)=>{
   res.sendFile(__dirname+"/register.html");
})

app.get('/mainpage',(req,res)=>{
   if(req.isAuthenticated()){
      res.sendFile(__dirname+"/mainPage.html");
   }else{
      res.redirect("/");
   }
})

app.get("/logout",(req,res)=>{
   req.logout();
   res.redirect("/");
})

app.post("/",(req,res)=>{
  User.findOne({username:req.body.username},function(err,found){
      if(!found){
         res.redirect("/");
      }else{
         const user = new User({
            username: req.body.username,
            password: req.body.password
         });
         req.login(user,function(err){
         if(err){
             res.redirect("/");
         }else{
               passport.authenticate("local")(req,res,function(){
                      res.redirect("/mainpage")
               });
          }
        });
      }
  })

});  

app.post("/register",function(req,res){
   User.register({username:req.body.username,active:false},req.body.password,function(err,user){ 
      if(err){
         res.redirect("/register");
        }else{
         passport.authenticate("local")(req,res,function(){
            res.redirect("/mainpage");
         });
        }
      });
});


app.post("/mainpage",async function(req,res){
      
   try{
         //create spreadsheet
         let response = await sheet.spreadsheets.create({
           resource:{
             properties:{
               title:req.body.meetingid
             }
           }
         });
         
         //spreadsheet id will be in spreadID
         const spreadId = response.data.spreadsheetId;
         try{
            await drive.permissions.create({
              fileId:spreadId,
              requestBody:{
                role:'reader',
                type:'anyone'
              }
      
            })
            const result = await drive.files.get({
              fileId:spreadId,
              fields:'webViewLink,webContentLink'
            });
            //Initialize spreadsheet
            const doc = new GoogleSpreadsheet(spreadId);
   
            doc.useOAuth2Client(oauth2Client);
             await doc.loadInfo();
            const sheet = doc.sheetsByIndex[0];
            await sheet.setHeaderRow(["name","email","duration","status"]);
            const meeting = new Meeting({
               meetingid:req.body.meetingid, 
               meetinghostname:req.body.meetinghost,
               meetingduration:req.body.meetingduration,
               spreadsheetid:spreadId
            });
             meeting.save();
        }catch(err){
          console.log(err);
        }
         
       }catch(error){
          console.log(error);
       }   
  
   const html = `<div style="text-align:center;font-size: xx-large;color: lightgreen;">
   <p>Attendence for meeting with MEETING Id ${req.body.meetingid} is stored in drive</p>
   </div>`
   res.send(html);
   
})

//for getting time period of the user in the meet
function findEnterTime(str){
   str = str.split(':')[1];
   return str;
}

app.post("/studententer",function(req,res){

   Meeting.findOne({meetingid:req.body.payload.object.id},async function(err,found){
      if(found){
         const doc = new GoogleSpreadsheet(found.spreadsheetid);
         doc.useOAuth2Client(oauth2Client);
         await doc.loadInfo();
         const sheet = doc.sheetsByIndex[0];
         let enterTimeOfUser = findEnterTime(req.body.payload.object.participant.join_time);
         UserInMeeting.findOne({name:req.body.payload.object.participant.user_name},async function(err,found){
            if(found){
               found.starttime = parseInt(enterTimeOfUser);
            }else{
                     //["name","email","duration","status"]
                     const userdetails = new UserInMeeting({
                           starttime:parseInt(enterTimeOfUser),
                           name:req.body.payload.object.participant.user_name,
                           email:req.body.payload.object.participant.email,
                           duration:req.body.payload.object.duration
                     });
                     userdetails.save();
                     await sheet.addRow({
                        name:req.body.payload.object.participant.user_name,
                        email:req.body.payload.object.participant.email,
                        duration:req.body.payload.object.duration
                     });
                     
                  }
         })
      }else 
        console.log("meeting id was not found");
   })
});

app.post("/studentleave",function(req,res){
   Meeting.findOne({meetingid:req.body.payload.object.id},async function(err,found){
      if(found){
         const totalDuration = found.meetingduration;;
         const doc = new GoogleSpreadsheet(found.spreadsheetid);
         doc.useOAuth2Client(oauth2Client);
         await doc.loadInfo();
         const sheet = doc.sheetsByIndex[0];
         let leaveTimeOfUser = findEnterTime(req.body.payload.object.participant.leave_time);
         UserInMeeting.findOne({name:req.body.payload.object.participant.user_name},async function(err,found){
            if(found){
                //update inside the database
                 found.duration += Math.abs(leaveTimeOfUser-found.starttime);
                 const rows = await sheet.getRows();
                 let row_found = rows.find(function(element) {
                  return element.name == found.name;
                 });
                 if(row_found)
                  await row_found.delete();
                 if(found.duration<totalDuration){
                  await sheet.addRow({
                     name:req.body.payload.object.participant.user_name,
                     email:req.body.payload.object.participant.email,
                     duration:found.duration
                  });
                 } else{
                  await sheet.addRow({
                     name:req.body.payload.object.participant.user_name,
                     email:req.body.payload.object.participant.email,
                     duration:found.duration,
                     status:"P" //mark present is exceeds threshold duration
                  });
                 }
            }else{
                     //["name","email","duration","status"]
                     const userdetails = new UserInMeeting({
                           name:req.body.payload.object.participant.user_name,
                           email:req.body.payload.object.participant.email,
                           duration:req.body.payload.object.duration
                     });
                     userdetails.save();
                     await sheet.addRow({
                  
                        name:req.body.payload.object.participant.user_name,
                        email:req.body.payload.object.participant.email,
                        duration:req.body.payload.object.duration
                     });
                  }
         })
      }else 
        console.log("meeting id was not found");
   }) 
});