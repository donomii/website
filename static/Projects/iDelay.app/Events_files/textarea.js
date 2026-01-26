/**
 * Auto-grow a textarea's height to fill available space.
 * @param textArea jQuery wrapper around DOM textarea
 */
function autoGrowTextArea(textArea) {
	while (
		textArea.outerHeight()
		< textArea[0].scrollHeight
		+ parseFloat(textArea.css("borderTopWidth"))
		+ parseFloat(textArea.css("borderBottomWidth"))
	) {
		textArea.height(textArea.height() + 1);
	};
}
