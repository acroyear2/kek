import test = require("tape")
import {Lodashify} from "../lodashify"
import {observed, changed, Kek, KekModel} from "../kek"
import {autorun, Atom, transaction} from "mobx"
import lodash = require("lodash")

export interface FooModel extends KekModel {
	name: string
	group: string
}

class FooCollection extends Kek<FooModel> {
}

test("inherits kek", t => {
	const x: any = new FooCollection
	t.equal(x.models.length, 0)
	x.add(5)
	t.equal(x.models.length, 1)
	t.end()
})

test("reports changed", t => {
	const x: any = new FooCollection
	let i = -1

	t.plan(6)

	autorun(r => {
		const g = x.groupBy("group")

		switch(i) {
			case 0:
				t.equal(g.first.length, 1)
				t.notOk(g.second)
				break
			case 1:
				t.equal(g.first.length, 1)
				t.equal(g.second.length, 1)
				break
			case 2:
				t.equal(g.first.length, 2)
				t.equal(g.second.length, 1)
				r.dispose()
		}
	})

	const models: FooModel[] = [
		{ name: 'a', group: 'first' },
		{ name: 'b', group: 'second' },
		{ name: 'c', group: 'first' }
	]

	models.forEach(function(model) {
		++i
		x.add(model)
	})
})

test("transaction", t => {
	const x: any = new Kek
	t.plan(1)
	autorun(r => {
		if (x.models.length) {
			t.deepEqual(x.map(d => { return d * 2 }), [222, 666, 1110])
			t.end()
			r.dispose()
		}
	})
	transaction(() => {
		x.add(111)
		x.add(333)
		x.add(555)
	})
})

test("autorun proxy", t => {
	const x: any = new Kek

	t.plan(2)

	x.observe(r => {
		if (x.models.length) {
			t.equal(x.max(), 5)
			t.ok(typeof r.dispose === "function")
			r.dispose()
		}
	})

	transaction(() => {
		x.add(1)
		x.add(5)
		x.add(3)
	})
})
