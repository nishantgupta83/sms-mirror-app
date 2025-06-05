// backend/routes/sms.js
router.delete('/:messageId', async (req, res) => {
  await Message.findByIdAndDelete(req.params.messageId);
  res.status(204).send();
});
