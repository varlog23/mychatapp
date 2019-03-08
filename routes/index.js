const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');

router.get('/',(req,res)=>res.render('welcome'));

// Chat
router.get('/chat', ensureAuthenticated, (req,res)=>res.render('chat',{user: req.user}));

module.exports = router;