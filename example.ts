import {Kek, changed} from "./src"

class Collection<T extends number> extends Kek<T> {}

const collection = new Collection
collection.add(1)
collection.add(2)
collection.add(3)

const _ = collection as any /* lodash typings are not there yet. prs are welcome */
console.log(_.filter(d => { return d > 2 })) /* outputs: [3] */


collection.observe(r => {
	const models = _.filter(d => {
		return d > 5
	})

	console.log("number of numbers gt 5:", models.length)

	if (models.length) {
		console.log("disposing")
		r.dispose()
	}
})

collection.add(4)
collection.add(5)
collection.add(6)
collection.add(7)
collection.add(8)


export interface NamedModel {
	name: string
}

class Collection2<T extends NamedModel> extends Kek<T> {}

const defaults = [ { name: "foo" }, { name: "bar" } ]

const collection2 = new Collection2(defaults)

const dispose = collection2.observe(() => {
	console.log("num of models", collection2.models.length)
})

collection2.add({ name: "baz" })
dispose()


import {autorun} from "mobx"

function onObserve() {
	console.log("collection21 is being observed now")
}

function onUnobserve() {
	console.log("collection21 is not being observed atm")
}

const collection21 = new Collection2([], onObserve, onUnobserve)

const dispose2 = autorun(r => {
	console.log("collection21 models len:", collection21.models.length)
})

collection21.add(555)
dispose2()


class Collection3<T extends NamedModel & { count: number }> extends Kek<T> {
	@changed increment(name: string) {
		const _ = this as any
		const model = _.find({ name: name })

		if (model) {
			model.count++
		}

	}
}

const collection3 = new Collection3([{ name: "foo", count: 1 }])
collection3.observe(function(r) {
	const _ = collection3 as any
	const res = _.filter(d => { return d.count > 2 })

	if (res.length) {
		console.log("got model with count > 1, disposing")
		r.dispose()
	}

})

collection3.increment("foo")
collection3.increment("foo")
