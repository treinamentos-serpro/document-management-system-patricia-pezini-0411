const express = require('express');
const controller = require('../controllers/documents.controller');

const router = express.Router();

router.post('/upload', controller.validateUser, controller.receiveUpload, controller.upload);
router.get('/documents', controller.validateUser, controller.list);
router.get('/documents/:id/download', controller.validateUser, controller.download);
module.exports = router;
