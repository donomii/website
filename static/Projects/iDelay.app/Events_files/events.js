// Create namespace 'Events' if nonexistent.
if (typeof(Events) === "undefined") {
	Events = {
		currentEvent: undefined // Event currently selected for editing, if any
	};
}

(function($) {

	// The Event combined model+view class
	Events.Event = function(element, json) {
		$.extend(this, {
			element: element,
			name: json.name || '',
			nameElt: $('<td>'),
			startTimeElt: $('<td>'),
			endTimeElt: $('<td>'),
			timeRemainingElt: $('<td>'),
		});
		if (json.start instanceof Date) {
			this.start = json.start;
		} else if (typeof(json.start) === "number") {
			this.start = new Date(json.start);
		} else {
			this.start = new Date();
		}
		if (json.end instanceof Date) {
			this.end = json.end;
		} else if (typeof(json.end) === "number") {
			this.end = new Date(json.end);
		} else {
			this.end = new Date();
		}
		// Back-reference from view object to model object
		this.element.data('modelObject', this);
		this.element.addClass('event');
		this.nameElt.addClass('name');
		this.startTimeElt.addClass('startTime');
		this.endTimeElt.addClass('endTime');
		this.timeRemainingElt.addClass('timeRemaining');
		this.nameElt.text(this.name);
		this.startTimeElt.text('' + this.start);
		this.endTimeElt.text('' + this.end);
		this.timeRemainingElt.text(
			humanReadableDuration(
				this.start.getTime() - (new Date()).getTime(),
				humanReadableDuration.oneSecond
			)
		);
		this.element.append(this.nameElt)
		.append(this.startTimeElt)
		.append(this.endTimeElt)
		.append(this.timeRemainingElt);
	};
	
	$.extend(Events.Event.prototype, {
		refresh: function() {
			this.timeRemainingElt.text(
				humanReadableDuration(
					this.start.getTime() - (new Date()).getTime(),
					humanReadableDuration.oneSecond
				)
			);
		},
		getElement: function() {
			return this.element;
		},
		getName: function() {
			return this.name;
		},
		getStart: function() {
			return this.start;
		},
		getEnd: function() {
			return this.end;
		},
		setName: function(newName) {
			this.name = newName;
			this.nameElt.text(this.name);
			return this;
		},
		setStart: function(newStart) {
			this.start = newStart;
			this.startTimeElt.text('' + this.start);
			this.refresh();
			return this;
		},
		setEnd: function(newEnd) {
			this.end = newEnd;
			this.endTimeElt.text('' + this.end);
			return this;
		},
		// Convert this object to parsed JSON.
		toJSON: function() {
			return {
				name: this.name,
				start: this.start.getTime(),
				end: this.end.getTime()
			};
		},
		// Initialise this object from parsed JSON
		fromJSON: function(json) {
			var start = new Date(), end = new Date();
			start.setTime(json.start);
			end.setTime(json.end);
			this.setName(json.name)
			.setStart(start)
			.setEnd(end);
		},
		select: function() {
			this.element.addClass('selectedEvent');
		},
		deselect: function() {
			this.element.removeClass('selectedEvent');
		}
	});
	
	// A collection of Events.Event instances
	Events.Collection = function(outputElement) {
		var json;
		this.output = outputElement;
		this.events = [];
		this.output.empty();
		if (Modernizr.localstorage) {
			json = localStorage['Events.events'];
			try {
				json = JSON.parse(json);
			} catch (err1) {
				console.log("Corrupt saved data: ", json);
				localStorage.removeItem('Events.events');
				return;
			}
			this.fromJSON(json);
		}
	};
	
	$.extend(Events.Collection.prototype, {
		interval: undefined, // Refresh interval timer
		// Refresh each of the event widget's views. Called from the interval.
		refresh: function() {
			$(this.events).each(function(i, event) { event.refresh(); });
			return this;
		},
		// Save the events somewhere persistent, if possible
		save: function() {
			if (Modernizr.localstorage) {
				localStorage['Events.events'] = JSON.stringify(this.toJSON());
				return this;
			}
		},
		_addEvent: function(event) {
			this.events.push(event); // Save model object
			this.output.append(event.getElement()); // Attach DOM view object
			return this;
		},
		_createEvent: function(json) {
			var
				eventElt = $('<tr>'),
				event = new Events.Event(
					eventElt,
					json
				)
			;
			eventElt.on('click', Events.selectEvent); // select current event handler
			return event;
		},
		// Add a new event to the list
		addNewEvent: function(json) {
			var event = this._createEvent(json);
			this._addEvent(event);
			this.save();
			return event;
		},
		indexOf: function(findEvent) {
			return this.output.children().index(findEvent.getElement());
		},
		// Remove event at given index
		removeAt: function(index) {
			var event = this.events[index];
			event.getElement().remove();
			this.events.splice(index, 1);
			this.save();
			return this;
		},
		// Convert the events data to/from JSON
		toJSON: function() {
			var json = [];
			$(this.events).each(function(i, event) { json.push(event.toJSON()); });
			return json;
		},
		fromJSON: function(json) {
			var list = this;
			this.events = [];
			this.output.empty();
			$(json).each(function(i, eventJSON) {
				var event = list._createEvent(eventJSON);
				list._addEvent(event);
			});
			this.save();
			return this;
		},
		startRefreshing: function() {
			var list = this;
			if (typeof(this.interval) !== "undefined") {
				return;
			}
			this.interval = setInterval(function() {
				list.refresh();
			}, 1000);
			return this;
		},
		stopRefreshing: function() {
			if (typeof(this.interval) !== "undefined") {
				cancelInterval(this.interval);
				this.interval = undefined;
			}
			return this;
		},
		each: function() {
			var that = $(this.events);
			return that.each.apply(that, Array.prototype.slice.call(arguments, 0));
		},
		getEarliestStarting: function() {
			var earliest = undefined;
			this.each(function(i, event) {
				if (
					typeof(earliest) === "undefined"
					|| event.getStart().getTime() < earliest.getStart().getTime()
				) {
					earliest = event;
				}
			});
			return earliest;
		},
		getLatestEnding: function() {
			var latest = undefined;
			this.each(function(i, event) {
				if (
					typeof(latest) === "undefined"
					|| event.getEnd().getTime() > latest.getEnd().getTime()
				) {
					latest = event;
				}
			});
			return latest;
		}
	});
	
	// A simple Gantt-style chart of the events in the database
	Events.Chart = function(outputElement, eventList) {
		this.output = outputElement;
		this.eventList = eventList;
	};
	$.extend(Events.Chart.prototype, {
		makeRow: function(earliestStart, latestEnd, event) {
			var row = $('<tr>'), bar = $('<div>'), now = new Date(), w;
			if (now.getTime() < earliestStart.getTime()) {
				// If earliest start is in the future, use current time as least value.
				// The left of the graph then implicitly depicts the current time.
				earliestStart = new Date();
				drawNow = false;
			} else {
				// If some events started in the past, use earliest start as least value,
				// and draw a line depicting the current time.
				drawNow = true;
			}
			// TODO: drawNow
			w = latestEnd.getTime() - earliestStart.getTime();
			bar.addClass('ganttBar').css({
				left: ((event.getStart().getTime() - earliestStart.getTime()) * 100 / w) + '%',
				width: ((event.getEnd().getTime() - event.getStart().getTime()) * 100 / (latestEnd.getTime() - earliestStart.getTime())) + '%'
			});
			bar.text(event.getName());
			row.append(bar);
			return row;
		},
		refresh: function() {
			var
				that = this,
				earliestStart = this.eventList.getEarliestStarting(),
				latestEnd = this.eventList.getLatestEnding()
			;
			if (earliestStart) {
				earliestStart = earliestStart.getStart();
			}
			if (latestEnd) {
				latestEnd = latestEnd.getEnd();
			}
			this.output.empty();
			this.eventList.each(function(i, event) {
				that.output.append(that.makeRow(earliestStart, latestEnd, event));
			});
		}
	});

})(jQuery);
