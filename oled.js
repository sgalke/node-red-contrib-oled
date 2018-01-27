// das funktioniert jetzt einigermaßen
// scroll und den universellen oled knoten habe ich noch nicht angepasst.

var i2c = require('i2c-bus')
var i2cBus = i2c.openSync(1)
var Oled = require('oled-i2c-bus')
var font = require('oled-font-5x7')

module.exports = function(RED) {
	var displays = {}

	function check(display, node) {
		if (node.clear) {
			display.clearDisplay()
			display.stopScroll(); //*** 
			display.setCursor(1, 1)
			display.update()
		}
	}

	function drawPixel(payload, display, node) {
		//***if (typeof payload !== 'Array') node.error('Payload not of type Array [ [x, y, color] ]')
		display.drawPixel(payload);
	}

	function drawLine(payload, display, node) {
		//***if (typeof payload !== 'Array') {node.error('Payload not of type Array [x0, y0, x1, y1, color]')}
		if (payload.length < 5 || payload.length > 5) {node.error('Payload format not correct [x0, y0, x1, y1, color]')} //*** 5 statt 4
		display.drawLine(payload[0],payload[1],payload[2],payload[3],payload[4]);
	}

	function scroll(payload, display, node) {
		if (typeof payload !== 'undefined') {
			if (typeof payload === 'boolean' && !payload) {
				display.stopScroll(); //*** Scroll statt scroll
			} else if (typeof payload === 'object') {
				var p = payload
				display.startScroll(p.direction || 'left', p.start || 0, p.stop || 128); //*** Scroll statt scroll
			} else {
				var p = JSON.parse(payload)
				if (typeof p !== 'Array') node.error('Payload not of type Array [direction, start, stop] or Boolean')
				if (p.length < 3 || p.length > 3) node.error('Payload format not correct [direction, start, stop]')
				display.startScroll(p[0], p[1], p[2]); //*** Scroll statt scroll
			}
		}
	}

	function OledConfig(config) {
		var self = this
		RED.nodes.createNode(self, config)

		self.config = {
			width: parseInt(config.width),
			height: parseInt(config.height),
			address: parseInt('0x'+config.address)
		}

		displays[self.id] = new Oled(i2cBus, self.config)
		check(displays[self.id], { clear: true })
	}

	RED.nodes.registerType('oled-config', OledConfig)

	function OledFunction(fn) {
		return function(n) {
			var self = this
			RED.nodes.createNode(self, n)

			self.display = displays[n.display]

			self.on('input', function(msg) {
				self.display[fn](msg.payload)
				self.display.update()
			})
		}
	}

	RED.nodes.registerType('oled-clear', OledFunction('clearDisplay'))
	RED.nodes.registerType('oled-dim', OledFunction('dimDisplay'))
	RED.nodes.registerType('oled-invert', OledFunction('invertDisplay'))
	RED.nodes.registerType('oled-turn-off', OledFunction('turnOffDisplay'))
	RED.nodes.registerType('oled-turn-on', OledFunction('turnOnDisplay'))

	function OledDrawPixel(n) {
		var self = this
		RED.nodes.createNode(self, n)
		var node= self; //***

		self.display = displays[n.display]

		self.on('input', function(msg) {
			check(self.display, n)
			try {
				//***var p = JSON.parse(msg.payload)
				var p= msg.payload; //***
				drawPixel(p, self.display, node)
			} catch (err) {
				node.error(err)
			}
		})
	}

	RED.nodes.registerType('oled-draw-pixel', OledDrawPixel)

	function OledDrawLine(n) {
		var self = this
		RED.nodes.createNode(self, n)
		var node= self;	//***

		self.display = displays[n.display]

		self.on('input', function(msg) {
			
			check(self.display, n)
			
			try {
				//var p = JSON.parse(msg.payload)
				var p= msg.payload; //***
				drawLine(p, self.display, node)
			} catch (err) {
				node.error(err)
			}
		})
	}

	RED.nodes.registerType('oled-draw-line', OledDrawLine)

	function OledFillRect(n) {
		var self = this
		RED.nodes.createNode(self, n)
		var node= self; //***

		self.display = displays[n.display]

		self.on('input', function(msg) {
			check(self.display, n)
			try {
				//***var p = JSON.parse(msg.payload)
				var p= msg.payload; //***

				//***if (typeof p !== 'Array') node.error('Payload not of type Array [x0, y0, x1, y1, color]')
				if (p.length < 5 || p.length > 5) node.error('Payload format not correct [x0, y0, x1, y1, color]'); // 5 statt 4
				self.display.fillRect(p[0],p[1],p[2],p[3],p[4]); //***
			} catch (err) {
				node.error(err)
			}
		})
	}

	RED.nodes.registerType('oled-fill-rect', OledFillRect)

	function OledScroll(n) {
		var self = this
		RED.nodes.createNode(self, n)
		var node= this //***

		self.display = displays[n.display]

		self.on('input', function(msg) {
			check(self.display, n)
			try {
				scroll(msg.payload, self.display, node)
			} catch (err) {
				node.error(err)
			}
		})
	}

	RED.nodes.registerType('oled-scroll', OledScroll)

	function OledWriteString(n) {
		var self = this
		RED.nodes.createNode(self, n)

		self.display = displays[n.display]

		self.on('input', function(msg) {
			check(self.display, n)
			try {
				if (typeof msg.payload === 'object') {
					var p = msg.payload
					if (p.x || p.y) {
						self.display.setCursor(p.x || 1, p.y || 1)
					}
					self.display.writeString(
						font,
						p.size || n.size || 1, p.text || '',
						p.color || n.color || 1,
						typeof p.wrapping === 'undefined' ? n.wrapping : p.wrapping
					)
				} else {
					self.display.setCursor(1, 1)
					self.display.writeString(font, 1, msg.payload, 1, true)
				}
			} catch (err) {
				self.error(err)
			}
		})
	}

	RED.nodes.registerType('oled-write-string', OledWriteString)

	function OledIn(n) {
		var self = this
		RED.nodes.createNode(self, n)
		var node= this;

		self.display = displays[n.display]

		var run = function(payload) {
			return function(oled) {
				eval(payload)
			}(self.display)
		}

		self.on('input', function(msg) {
			check(self.display, n)
			if (typeof msg.payload === 'object') {
				var p = msg.payload

				// control
				if (typeof p.invert !== 'undefined') self.display.invertDisplay(p.invert)
				if (typeof p.on !== 'undefined') p.on ? self.display.turnOnDisplay() : self.display.turnOffDisplay()
				if (typeof p.dim !== 'undefined') self.display.dimDisplay(p.dim)

				// plain
				if (typeof p.plain !== 'undefined') run(p.plain)

				// draw
				if (typeof p.drawPixel !== 'undefined') drawPixel(p.drawPixel, self.display, node)
				if (typeof p.drawLine !== 'undefined') drawLine(p.drawLine, self.display, node)

				// scroll
				if (typeof p.scroll !== 'undefined') scroll(p.scroll, self.display, node)
			} else if (typeof msg.payload === 'string') {
				self.display.writeString(font, 1, msg.payload, 1, true)
			} else {
				self.display.turnOffDisplay(msg.payload)
			}
		})
	}
}
