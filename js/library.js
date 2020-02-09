/*
mergeInto(LibraryManager.library, {
	signalResult: function(uid,rv) {
		if (self.ENVIRONMENT_IS_PTHREAD) {
			self.postMessage({cmd:"objectTransfer",
				Webp2PNG_signalResult:[uid,rv]});
		} else {
			self.dispatchEvent(
				new CustomEvent('webp2png::result', {detail :[uid,rv]}));
		}
	},
});
*/