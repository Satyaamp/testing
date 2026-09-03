const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const auth = require('../middleware/auth.middleware');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.delete);
router.patch('/:id/visibility', auth, ctrl.toggleVisibility);

module.exports = router;
