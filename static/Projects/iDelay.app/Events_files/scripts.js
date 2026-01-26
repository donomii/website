(function($) {
	var
		eventList = undefined, // Container for event instances
		nameEditElt = undefined, // Event name edit field
		startDateElt = undefined, // Start date edit field
		endDateElt = undefined, // End date edit field
		addButton = undefined, // Add event button
		editEventButton = undefined, // Edit event details button
		deleteEventButton = undefined, // Delete selected event button
		jsonDisplay = undefined, // JSON edit control
		jsonDialog = undefined, // JSON I/O dialog box
		showJSONButton, // Convert events to JSON and display it
		editJSONButton, // Receive new events in JSON format
		ganttChart = undefined // Simple Gantt chart
	;
	// Controller code begins here (but is sadly not only here - FIXME).
	// Forget the currently-selected event, if any
	Events.forgetSelected = function() {
		if (Events.currentEvent) {
			Events.currentEvent.deselect();
			Events.currentEvent = undefined;
		}
		editEventButton.button('option', 'disabled', true);
		deleteEventButton.button('option', 'disabled', true);
	};
	// Clicking an existing event selects it for editing/deletion
	Events.selectEvent = function() {
		Events.forgetSelected();
		Events.currentEvent = $(this).data('modelObject');
		Events.currentEvent.select();
		editEventButton.button('option', 'disabled', false);
		deleteEventButton.button('option', 'disabled', false);
	};
	// Display the events database in JSON format, and optionally allow editing of it
	Events.doJSONDialog = function(editable) {
		var title, buttons;
		jsonDisplay.val(JSON.stringify(eventList.toJSON(), null, ' '));
		if (editable) {
			title = 'Edit JSON';
			jsonDisplay.removeAttr('readonly');
			buttons = [
				{
					text: 'Save',
					click: function() {
						// TODO: Show parse errors
						eventList.fromJSON(JSON.parse(jsonDisplay.val()));
						ganttChart.refresh();
						$(this).dialog('close');
					}
				},
				{
					text: 'Cancel',
					click: function() {
						$(this).dialog('close');
					}
				}
			];
		} else {
			title = 'View JSON';
			jsonDisplay.attr('readonly', 'true');
			buttons = [
				{
					text: "Close",
					click: function() {
						$(this).dialog('close');
					}
				}
			];
		}
		jsonDialog.dialog('option', 'title', title);
		jsonDialog.dialog('option', 'buttons', buttons);
		jsonDialog.dialog('open');
		autoGrowTextArea(jsonDisplay);
	};
	// Display the event-details dialog, either to edit an existing event or to create a new event.
	// The given callback will be called with the entered event details in parsed JSON format.
	Events.doEventDialog = function(editExisting, callback) {
		var title, saveLabel, cancelLabel;
		if (editExisting) {
			title = 'Edit Event';
			saveLabel = 'Save changes';
			cancelLabel = 'Discard changes';
			nameEditElt.val(editExisting.getName());
			startDateElt.datetimepicker('setDate', editExisting.getStart());
			endDateElt.datetimepicker('setDate', editExisting.getEnd());
		} else {
			title = 'Add Event';
			saveLabel = 'Add event';
			cancelLabel = 'Cancel';
			nameEditElt.val('');
			startDateElt.add(endDateElt).datetimepicker('setDate', new Date());
		}
		eventDialog.dialog('option', 'title', title);
		eventDialog.dialog('option', 'buttons', [
			{
				text: saveLabel,
				click: function() {
					callback({
						name: nameEditElt.val(),
						start: startDateElt.datepicker('getDate'),
						end: endDateElt.datepicker('getDate')
					});
					$(this).dialog('close');
				}
			},
			{
				text: cancelLabel,
				click: function() {
					$(this).dialog('close');
				}
			}
		]);
		eventDialog.dialog('open');
	};
	$(function() {
		eventList = new Events.Collection($('#events')); // Container for event instances
		// Cache interesting DOM elements
		nameEditElt = $('#eventName'); // Event name edit field
		startDateElt = $('#startDate'); // Start date edit field
		endDateElt = $('#endDate'); // End date edit field
		addButton = $('#addEvent'); // Add event button
		editEventButton = $('#editEvent'); // Edit event details button
		deleteEventButton = $('#deleteEvent'); // Delete selected event button
		jsonDisplay = $('#jsonDisplay'); // JSON edit control
		jsonDialog = $('#jsonDialog'); // JSON I/O dialog box
		eventDialog = $('#eventDialog'); // Event details dialog
		showJSONButton = $('#showJSON'); // Convert event DB to JSON and display it
		editJSONButton = $('#editJSON'); // Receive new events in JSON format
		ganttChart = new Events.Chart($('#ganttChart'), eventList);
		// Enable jQuery UI buttons and select controls
		$('input[type="button"], button').button();
		$('select').menu();
		// Enable jQuery UI plugin's DateTimePicker controls.
		startDateElt.add(endDateElt).datetimepicker({
			dateFormat: 'yy-mm-dd', // ISO 8601
			timeFormat: 'HH:mm:ss z'
		});
		// TODO: Enable jQuery UI selectable widgets
		// $('.eventList tbody').selectable();
		// Initialise jQuery UI dialogs
		jsonDialog.add(eventDialog).dialog({
			autoOpen: false,
			modal: true,
			closeOnEscape: true,
			show: 0.5, // Fade in in 0.5 second
			hide: 0.5, // Fade out in 0.5 second
			width: $(document).width() * 0.75,
			height: $(document).height() * 0.75
		});
		// Attach event handlers
		showJSONButton.on('click', function() {
			Events.doJSONDialog(false);
		});
		editJSONButton.on('click', function() {
			Events.doJSONDialog(true);
		});
		editEventButton.on('click', function() {
			Events.doEventDialog(
				Events.currentEvent,
				function(json) {
					Events.currentEvent.fromJSON(json);
					eventList.save();
					ganttChart.refresh();
				}
			);
		});
		addButton.on('click', function() {
			Events.forgetSelected();
			Events.doEventDialog(
				undefined,
				function(json) {
					eventList.addNewEvent(json);
					ganttChart.refresh();
				}
			);
		});
		deleteEventButton.on('click', function() {
			eventList.removeAt(eventList.indexOf(Events.currentEvent));
			Events.forgetSelected();
		});
		Events.forgetSelected(); // Nothing selected at start
		ganttChart.refresh();
		eventList.startRefreshing();
	});
})(jQuery);
jQuery.noConflict();
