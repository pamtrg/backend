
var cors = require('cors')
const express = require('express');
const ProxyAgent = require('proxy-agent')
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');
const { clientBlocked } = require('./limiter');
const mongoose = require('mongoose')
const app = express();
const httpServer = createServer(app);
mongoose.connect('mongodb://localhost:27017/tiktok-chat')
.then(() => {
    console.log('Database connection successful')
  })
  .catch(err => {
    console.error('Database connection error')
  })
app.use(cors())



let CommentModel = require('./models/comment')
let UserModel = require('./models/user')
let GiftModel = require('./models/gift')
let LikeModel = require('./models/like')
let LiveIdModel = require('./models/liveId')
let ChannelModel = require('./models/channel')
// Enable cross origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        
    
    }
});
app.get('/get_user_lists', async (req, res) => {
    console.info(req.query.livechat_id)
    if(typeof req.query.livechat_id !== 'undefined'){
        let userModel = await UserModel.find({liveId: req.query.livechat_id})
            .populate({
                path: 'liveId',
                populate: {
                    path: 'channelId',
                }
            })
            .sort({commentCount: 'desc'}).limit(100).exec()
        res.json(userModel)
        
    }else {
        res.json("Error channel_id")
    }
})

app.get('/filters', async (req, res) => {
    if(typeof req.query.q !== 'undefined'){
        let userModel = await UserModel.find({$text:{ $search: req.query.q}})
            .sort({commentCount: 'desc'}).limit(100).exec()
        res.json(userModel)
    }else {
        res.json("Error channel_id")
    }
})
app.get('/get_comment_lists', async (req, res) => {
    if(typeof req.query.user_id !== 'undefined'){
        let commentModel = await CommentModel.find({userId: req.query.user_id})
        .populate('userId')
        .limit(100)
        .exec()

        res.json(commentModel)
    }else {
        res.json("Error user_id")
    }
})

app.get('/get_channels', async (req, res) => {
    let channelModel = await ChannelModel.find({})
    .limit(100)
    .exec()
    res.json(channelModel)
})

app.get('/get_live_chat_ids', async (req, res) => {
    if(typeof req.query.channel_id !== 'undefined'){
        let liveIdModel = await LiveIdModel.find({channelId: req.query.channel_id})
        .limit(100)
        .exec()
        res.json(liveIdModel)
    }else {
        res.json("Error channel_id")
    }
})



io.on('connection', (socket) => {
    let tiktokConnectionWrapper;

    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);
    //lay danh sach 100 ng dung
    //lay danh sach message
    socket.on('setUniqueId', async (uniqueId, options) => {
        //save chanel
        let channelModel = await ChannelModel.findOne({username: uniqueId})
            .exec()
        if(channelModel === null) {
            //create
            channelModel = await new ChannelModel({
                username: uniqueId
            }).save()
        }
        // Prohibit the client from specifying these options (for security reasons)
        if (typeof options === 'object') {
            delete options.requestOptions;
            delete options.websocketOptions;
        }

        // Is the client already connected to a stream? => Disconnect
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }

        // Check if rate limit exceeded
        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            socket.emit('tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
            return;
        }

        // Connect to the given username (uniqueId)
        try {
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, true);
            tiktokConnectionWrapper.connect();

            // {
            //     requestOptions: {
            //         httpsAgent: new ProxyAgent('http://116.110.87.199:46463'),
            //         timeout: 1000 // 10 seconds
            //     },
            //     websocketOptions: {
            //         agent: new ProxyAgent('http://116.110.87.199:46463'),
            //         timeout: 1000 // 10 seconds
            //     }
            // }




        } catch (err) {
            socket.emit('tiktokDisconnected', err.toString());
            return;
        }

        // Redirect wrapper control events once
        let LIVECHATID = await new Promise((resolve, reject) => {
            tiktokConnectionWrapper.once('connected', async state => {
                liveIdModel = await LiveIdModel.findOne({liveId: state.roomId})
                .exec()
                if(liveIdModel === null) {
                    //create
                    liveIdModel = await new LiveIdModel({
                        liveId: state.roomId,
                        channelId: channelModel._id
                    }).save()
                }
                ChannelModel.findOne({_id: channelModel._id}).exec().then( result => {
                    result.liveChatCount++;
                    result.save();
                });
                resolve(liveIdModel)
                socket.emit('tiktokConnected', state)
            });
        })
        tiktokConnectionWrapper.once('disconnected', reason => socket.emit('tiktokDisconnected', reason));

        // Notify client when stream ends
        tiktokConnectionWrapper.connection.on('streamEnd', () => socket.emit('streamEnd'));

        // Redirect message events
        tiktokConnectionWrapper.connection.on('roomUser', msg => socket.emit('roomUser', msg));
        
        let USERID = await new Promise(async (resolve, reject) => {
            await tiktokConnectionWrapper.connection.on('member', async msg => {
                userModel = await UserModel.findOne({userId: msg.userId})
                    .exec()
                if(userModel === null) {
                    //create
                    userModel = await new UserModel({
                        userId: msg.userId,
                        liveId: LIVECHATID._id,
                        uniqueId: msg.uniqueId,
                        nickname: msg.nickname,
                        image: msg.profilePictureUrl,
                        /*
                        followRole: 1,
                        userBadges: [],
                        isModerator: false,
                        isNewGifter: false,
                        isSubscriber: false,
                        topGifterRank: null,
                        displayType: 'live_room_enter_toast',
                        label: '{0:user} joined'
                        */
                    }).save()
                }
                LiveIdModel.findOne({_id: LIVECHATID._id}).exec().then( result => {
                    result.UserCount++;
                    result.save();
                });
                socket.emit('member', msg)
                resolve(userModel)
            })
        });
        tiktokConnectionWrapper.connection.on('chat', async msg => {
            //create
            await new CommentModel({
                userId: USERID._id,
                comment: msg.comment,
                //"followRole": 0,
                //"userBadges": [],
                //"isModerator": false,
                //"isNewGifter": false,
                //"isSubscriber": false,
                //"topGifterRank": null,
            }).save()
            console.log('comment', msg);
                //cộng comment vào user
            UserModel.findOne({_id: USERID._id}).exec().then( result => {
                result.commentCount++;
                result.save();
            });
            socket.emit('chat', msg)
        });
        tiktokConnectionWrapper.connection.on('gift', async msg => {
            await new GiftModel({
                userId: USERID._id,
            })
            /**
                giftId: 5655,
                repeatCount: 1,
                userId: '7025547515073512449',
                uniqueId: 'anhs576',
                nickname: 'あらやまはた',
                profilePictureUrl: 'https://p16-sign-va.tiktokcdn.com/tos-useast2a-avt-0068-giso/56af45ee6bb967facb3f17b8fae8dc24~c5_100x100.jpeg?x-expires=1657026000&x-signature=t6nbkI%2BYi9euRjZJGY3KwJ4Ci3Y%3D',
                followRole: 0,
                userBadges: [],
                repeatEnd: false,
                gift: { gift_id: 5655, repeat_count: 1, repeat_end: 0, gift_type: 1 },
                describe: 'Sent Rose',
                giftType: 1,
                diamondCount: 1,
                giftName: 'Rose',
                giftPictureUrl: 'https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png',
                timestamp: 1656854591126,
                receiverUserId: '6868539471827403778',
                
             */
            //console.log('gift', msg);
            socket.emit('gift', msg)
        });
        tiktokConnectionWrapper.connection.on('social', async msg => {
            //followed the host
            //console.log('social', msg);
            socket.emit('social', msg)
        });
        tiktokConnectionWrapper.connection.on('like', async msg => {
            await new LikeModel({
                userId: USERID._id,
                likeCount: msg.likeCount,
                totalLikeCount: msg.totalLikeCount,
            //   followRole: 1,
            //   userBadges: [],
            //   isModerator: false,
            //   isNewGifter: false,
            //   isSubscriber: false,
            //   topGifterRank: null,
            //   displayType: 'pm_mt_msg_viewer',
            //   label: '{0:user} sent likes to the host'

            })
            //console.log('like', msg);
            socket.emit('like', msg)
        });
        tiktokConnectionWrapper.connection.on('questionNew', msg => socket.emit('questionNew', msg));
        tiktokConnectionWrapper.connection.on('linkMicBattle', msg => socket.emit('linkMicBattle', msg));
        tiktokConnectionWrapper.connection.on('linkMicArmies', msg => socket.emit('linkMicArmies', msg));
        tiktokConnectionWrapper.connection.on('liveIntro', msg => socket.emit('liveIntro', msg));
        tiktokConnectionWrapper.connection.on('emote', msg => socket.emit('emote', msg));
        tiktokConnectionWrapper.connection.on('envelope', msg => socket.emit('envelope', msg));
    });

    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });
});

// Emit global connection statistics
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000)

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 8081;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);