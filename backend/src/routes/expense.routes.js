const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const auth = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', auth, ctrl.create);
router.get('/', auth, ctrl.getAll);

router.post('/bulk',auth , ctrl.addBulkExpenses);
// New Route for OCR/Text Parsing (accepts 'image' file or 'text' field)
router.post('/parse', auth, upload.single('image'), ctrl.parseSource);

router.get('/weekly', auth, ctrl.weekly);
router.get('/summary/category', auth, ctrl.summary);
router.get('/balance', auth, ctrl.balance);
router.get('/summary/monthly', auth, ctrl.monthlySummary);
router.get('/yearly', auth, ctrl.yearly);
router.delete('/:id', auth, ctrl.delete);
router.put('/:id', auth, ctrl.update);
router.get('/month', auth, ctrl.getByMonthYear);



module.exports = router;
