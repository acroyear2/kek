import test = require("tape")
import {Lodashify} from "../lodashify"

class Collection extends Lodashify<any> {
	_models = []

	add(model) {
		this._models.push(model)
	}
}

test("inherits lodash", t => {
	const models = [
		{ name: 'a', group: 'first' },
		{ name: 'b', group: 'second' },
		{ name: 'c', group: 'first' }
	]

	const x: any = new Collection

	models.forEach(function(model) {
		x.add(model)
	})

	const grouped = x.groupBy('group')

	t.plan(4)
	t.ok(grouped.first)
	t.ok(grouped.second)
	t.ok(grouped.first.length == 2)
	t.ok(grouped.second.length == 1)
})